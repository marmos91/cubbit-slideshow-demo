import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Upload } from '@aws-sdk/lib-storage';
import winston from 'winston';

// Configure Winston logger for production-ready logging.
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        // Customize the log format.
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        // Add additional transports for production, e.g. file, remote logging, etc.
        // new winston.transports.File({ filename: 'combined.log' }),
    ],
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

// Validate required environment variables for S3.
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
    if (req.method !== 'POST') {
        logger.warn('Method not allowed', { method: req.method });
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return new Promise<void>((resolve) => {
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

                // Read file content asynchronously.
                const fileContent = await fs.readFile(file.filepath);

                const uploadParams: PutObjectCommandInput = {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: fullPath,
                    Body: fileContent,
                    ContentType: file.mimetype || undefined,
                    ContentDisposition: `inline; filename="${encodeURIComponent(
                        file.originalFilename || fileName
                    )}"`,
                };

                // Use multipart upload for files larger than 5MB.
                if (file.size > 5 * 1024 * 1024) {
                    logger.info('Using multipart upload', { fileSize: file.size });
                    const multipartUpload = new Upload({
                        client: s3Client,
                        params: uploadParams,
                        leavePartsOnError: false,
                    });
                    await multipartUpload.done();
                } else {
                    logger.info('Using single-part upload', { fileSize: file.size });
                    await s3Client.send(new PutObjectCommand(uploadParams));
                }

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
                const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
                res.status(500).json({ message: 'Error uploading file', error: errorMessage });
                return resolve();
            }
        });
    });
}
