import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Allowed image MIME types
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

// Parse MAX_FILE_SIZE from the environment, defaulting to 40MB
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE
    ? parseInt(process.env.MAX_FILE_SIZE, 10)
    : 40 * 1024 * 1024;

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
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return new Promise<void>(resolve => {
        try {
            const form = new IncomingForm({ maxFileSize: MAX_FILE_SIZE });
            form.parse(req, async (err, _fields, files: Files) => {
                if (err) {
                    if (err.message.includes('maxFileSize')) {
                        res.status(413).json({
                            message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
                        });
                    } else {
                        res.status(500).json({
                            message: `Error parsing form data: ${err.message}`,
                        });
                    }
                    return resolve();
                }

                const fileField = files.file;
                const file = Array.isArray(fileField) ? fileField[0] : fileField;
                if (!file) {
                    res.status(400).json({ message: 'No file uploaded' });
                    return resolve();
                }

                if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
                    res.status(415).json({
                        message: 'Invalid file type. Only images are allowed.',
                        error: `File type ${file.mimetype} is not supported.`,
                    });
                    return resolve();
                }

                try {
                    const s3Client = new S3Client({
                        region: process.env.S3_REGION || 'us-east-1',
                        credentials: {
                            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
                            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
                        },
                        endpoint: process.env.S3_ENDPOINT,
                        forcePathStyle: true,
                    });

                    const today = new Date();
                    const folderPath = `${today.getFullYear()}/${String(
                        today.getMonth() + 1
                    ).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
                    const fileExtension = path.extname(file.originalFilename || '');
                    const fileName = `${uuidv4()}${fileExtension}`;
                    const fullPath = `${folderPath}/${fileName}`;

                    const fileContent = fs.readFileSync(file.filepath);

                    const uploadParams: PutObjectCommandInput = {
                        Bucket: process.env.S3_BUCKET_NAME as string,
                        Key: fullPath,
                        Body: fileContent,
                        ContentType: file.mimetype || undefined,
                        ContentDisposition: `inline; filename="${encodeURIComponent(
                            file.originalFilename || fileName
                        )}"`,
                    };

                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${fullPath}`;
                    res.status(200).json({
                        message: 'Image uploaded successfully',
                        fileUrl,
                        fileName: fullPath,
                    });
                    return resolve();
                } catch (uploadError) {
                    console.error('Error uploading to S3:', uploadError);
                    const errorMessage =
                        uploadError instanceof Error ? uploadError.message : 'Unknown error';
                    res.status(500).json({ message: 'Error uploading file', error: errorMessage });
                    return resolve();
                }
            });
        } catch (error) {
            console.error('Form parsing error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ message: 'Server error', error: errorMessage });
            return resolve();
        }
    });
}
