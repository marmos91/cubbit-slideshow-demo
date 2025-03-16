import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Upload } from '@aws-sdk/lib-storage';
import winston from 'winston';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import retry from 'async-retry';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import http from 'http';

// Helper: Convert a Web ReadableStream to a Node.js Buffer.
async function bufferFromReadable(readable: ReadableStream<Uint8Array>): Promise<Buffer> {
    const reader = readable.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
        const { done: doneReading, value } = await reader.read();
        done = doneReading;
        if (value) {
            chunks.push(value);
        }
    }
    return Buffer.concat(chunks);
}

// Helper: Create a minimal Node.js IncomingMessage-like object from a Request.
function createNodeRequest(request: Request, bodyBuffer: Buffer): http.IncomingMessage {
    const stream = new Readable();
    stream.push(bodyBuffer);
    stream.push(null);
    const nodeReq = stream as unknown as http.IncomingMessage;
    // Assign properties required by formidable.
    nodeReq.headers = Object.fromEntries(request.headers.entries());
    nodeReq.method = request.method;
    nodeReq.url = request.url;
    return nodeReq;
}

// Configure Winston logger.
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

// Allowed image MIME types.
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    'image/heic',
    'image/heif',
];

// Parse MAX_FILE_SIZE from environment, defaulting to 40MB.
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE
    ? parseInt(process.env.MAX_FILE_SIZE, 10)
    : 40 * 1024 * 1024;

// Configure multipart upload threshold from env (default to 5MB).
const MULTIPART_THRESHOLD = process.env.MULTIPART_THRESHOLD
    ? parseInt(process.env.MULTIPART_THRESHOLD, 10)
    : 5 * 1024 * 1024;

// Rate limiting config.
const RATE_LIMIT_POINTS = process.env.RATE_LIMIT_POINTS
    ? parseInt(process.env.RATE_LIMIT_POINTS, 10)
    : 10;
const RATE_LIMIT_DURATION = process.env.RATE_LIMIT_DURATION
    ? parseInt(process.env.RATE_LIMIT_DURATION, 10)
    : 60;

// Create an in-memory rate limiter.
const rateLimiter = new RateLimiterMemory({
    points: RATE_LIMIT_POINTS,
    duration: RATE_LIMIT_DURATION,
});

// Retry config.
const RETRY_COUNT = process.env.RETRY_COUNT ? parseInt(process.env.RETRY_COUNT, 10) : 3;
const RETRY_DELAY_MS = process.env.RETRY_DELAY_MS ? parseInt(process.env.RETRY_DELAY_MS, 10) : 500;

// Validate required S3 environment variables.
if (
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY ||
    !process.env.S3_BUCKET_NAME ||
    !process.env.S3_REGION ||
    !process.env.S3_ENDPOINT
) {
    logger.error('Missing required S3 environment variables');
    throw new Error('Missing required S3 environment variables');
}

// Create a global S3 client instance.
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
});

export async function POST(request: Request) {
    // Extract IP address.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    try {
        await rateLimiter.consume(ip);
    } catch (rejRes: unknown) {
        const rlRes = rejRes as RateLimiterRes;
        const retrySecs = Math.round(rlRes.msBeforeNext / 1000) || 1;
        logger.warn('Rate limit exceeded', { ip, retryAfter: retrySecs });
        return NextResponse.json(
            { message: 'Too Many Requests' },
            { status: 429, headers: { 'Retry-After': String(retrySecs) } }
        );
    }

    // Check if the request has a body.
    if (!request.body) {
        logger.warn('No request body provided');
        return NextResponse.json({ message: 'No request body provided' }, { status: 400 });
    }

    // Convert the Request body to a Buffer.
    const bodyBuffer = await bufferFromReadable(request.body);

    // Create a Node-compatible request for formidable.
    const nodeReq = createNodeRequest(request, bodyBuffer);

    const form = new IncomingForm({ maxFileSize: MAX_FILE_SIZE });
    const { files } = await new Promise<{ files: Files }>((resolve, reject) => {
        form.parse(nodeReq, (err, _fields, files) => {
            if (err) reject(err);
            else resolve({ files });
        });
    }).catch((err: unknown) => {
        logger.error('Error parsing form data', { error: err });
        if (err instanceof Error && err.message.includes('maxFileSize')) {
            throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
        }
        if (err instanceof Error) {
            throw new Error(`Error parsing form data: ${err.message}`);
        }
        throw new Error('Unknown error parsing form data');
    });

    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!file) {
        logger.warn('No file uploaded');
        return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
        logger.warn('Invalid file type', { mimetype: file.mimetype });
        return NextResponse.json(
            {
                message: 'Invalid file type. Only images are allowed.',
                error: `File type ${file.mimetype} is not supported.`,
            },
            { status: 415 }
        );
    }

    try {
        // Create folder structure based on today's date.
        const today = new Date();
        const folderPath = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(
            today.getDate()
        ).padStart(2, '0')}`;
        const fileExtension = path.extname(file.originalFilename || '');
        const fileName = `${uuidv4()}${fileExtension}`;
        const fullPath = `${folderPath}/${fileName}`;

        // Wrap the S3 upload in retry logic.
        await retry(
            async _bail => {
                // Create a new file stream for each retry attempt.
                const fileStream = fs.createReadStream(file.filepath);

                const uploadParams: PutObjectCommandInput = {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fullPath,
                    Body: fileStream,
                    ContentType: file.mimetype || undefined,
                    ContentDisposition: `inline; filename="${encodeURIComponent(
                        file.originalFilename || fileName
                    )}"`,
                    ACL: 'public-read', // Ensure the file is publicly readable.
                };

                if (file.size > MULTIPART_THRESHOLD) {
                    logger.info('Using multipart upload', {
                        fileSize: file.size,
                        threshold: MULTIPART_THRESHOLD,
                    });
                    const multipartUpload = new Upload({
                        client: s3Client,
                        params: uploadParams,
                        leavePartsOnError: false,
                    });
                    await multipartUpload.done();
                } else {
                    logger.info('Using single-part upload', {
                        fileSize: file.size,
                        threshold: MULTIPART_THRESHOLD,
                    });
                    await s3Client.send(new PutObjectCommand(uploadParams));
                }
            },
            { retries: RETRY_COUNT, minTimeout: RETRY_DELAY_MS }
        );

        const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${fullPath}`;
        logger.info('File uploaded successfully', { fileUrl, fileName: fullPath });
        return NextResponse.json({
            message: 'Image uploaded successfully',
            fileUrl,
            fileName: fullPath,
        });
    } catch (uploadError: unknown) {
        logger.error('Error uploading to S3', { error: uploadError });
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
        return NextResponse.json(
            { message: 'Error uploading file', error: errorMessage },
            { status: 500 }
        );
    }
}
