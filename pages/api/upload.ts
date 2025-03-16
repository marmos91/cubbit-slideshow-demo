import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Upload } from '@aws-sdk/lib-storage';
import winston from 'winston';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import retry from 'async-retry';

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

// Rate limiting config from environment.
const RATE_LIMIT_POINTS = process.env.RATE_LIMIT_POINTS
    ? parseInt(process.env.RATE_LIMIT_POINTS, 10)
    : 10; // max requests per window
const RATE_LIMIT_DURATION = process.env.RATE_LIMIT_DURATION
    ? parseInt(process.env.RATE_LIMIT_DURATION, 10)
    : 60; // window in seconds

// Create an in-memory rate limiter. For production, consider using a Redis store.
const rateLimiter = new RateLimiterMemory({
    points: RATE_LIMIT_POINTS,
    duration: RATE_LIMIT_DURATION,
});

// Retry config from environment.
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

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{
        message: string;
        fileUrl?: string;
        fileName?: string;
        error?: string;
    }>
) {
    // Use req.socket.remoteAddress instead of req.connection.remoteAddress.
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    try {
        await rateLimiter.consume(ip);
    } catch (rejRes: unknown) {
        const rlRes = rejRes as RateLimiterRes;
        const retrySecs = Math.round(rlRes.msBeforeNext / 1000) || 1;
        res.setHeader('Retry-After', String(retrySecs));
        logger.warn('Rate limit exceeded', { ip, retryAfter: retrySecs });
        return res.status(429).json({ message: 'Too Many Requests' });
    }

    if (req.method !== 'POST') {
        logger.warn('Method not allowed', { method: req.method });
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return new Promise<void>(resolve => {
        const form = new IncomingForm({ maxFileSize: MAX_FILE_SIZE });
        form.parse(req, async (err, _fields, files: Files) => {
            if (err) {
                logger.error('Error parsing form data', { error: err });
                if (err.message.includes('maxFileSize')) {
                    res.status(413).json({
                        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
                    });
                } else {
                    res.status(500).json({ message: `Error parsing form data: ${err.message}` });
                }
                return resolve();
            }

            const fileField = files.file;
            const file = Array.isArray(fileField) ? fileField[0] : fileField;
            if (!file) {
                logger.warn('No file uploaded');
                res.status(400).json({ message: 'No file uploaded' });
                return resolve();
            }

            if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
                logger.warn('Invalid file type', { mimetype: file.mimetype });
                res.status(415).json({
                    message: 'Invalid file type. Only images are allowed.',
                    error: `File type ${file.mimetype} is not supported.`,
                });
                return resolve();
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
                res.status(200).json({
                    message: 'Image uploaded successfully',
                    fileUrl,
                    fileName: fullPath,
                });
                return resolve();
            } catch (uploadError) {
                logger.error('Error uploading to S3', { error: uploadError });
                const errorMessage =
                    uploadError instanceof Error ? uploadError.message : 'Unknown error';
                res.status(500).json({ message: 'Error uploading file', error: errorMessage });
                return resolve();
            }
        });
    });
}
