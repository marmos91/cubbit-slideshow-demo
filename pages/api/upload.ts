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

// Maximum file size (40MB in bytes)
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE
    ? parseInt(process.env.MAX_FILE_SIZE, 10)
    : 40 * 1024 * 1024;

// Disable the default body parser to handle files
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ message: string; fileUrl?: string; fileName?: string; error?: string }>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    return new Promise<void>(resolve => {
        try {
            // Configure formidable with size limits
            const form = new IncomingForm({
                maxFileSize: MAX_FILE_SIZE,
            });

            form.parse(req, async (err, _fields, files: Files) => {
                if (err) {
                    // Check if it's a file size error
                    if (err.message.includes('maxFileSize')) {
                        res.status(413).json({ message: 'File too large. Maximum size is 40MB.' });
                    } else {
                        res.status(500).json({
                            message: `Error parsing form data: ${err.message}`,
                        });
                    }
                    return resolve();
                }

                const fileField = files.file;
                // Handle both single file and array of files
                const file = Array.isArray(fileField) ? fileField[0] : fileField;

                if (!file) {
                    res.status(400).json({ message: 'No file uploaded' });
                    return resolve();
                }

                // Validate file type
                if (!ALLOWED_MIME_TYPES.includes(file.mimetype || '')) {
                    res.status(415).json({
                        message: 'Invalid file type. Only images are allowed.',
                        error: `File type ${file.mimetype} is not supported.`,
                    });
                    return resolve();
                }

                try {
                    // Configure S3 client
                    const s3Client = new S3Client({
                        region: process.env.S3_REGION || 'us-east-1',
                        credentials: {
                            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
                            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
                        },
                        endpoint: process.env.S3_ENDPOINT,
                        forcePathStyle: true,
                    });

                    // Create a folder path based on today's date (YYYY/MM/DD)
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');

                    const folderPath = `${year}/${month}/${day}`;

                    // Generate a unique filename
                    const fileExtension = path.extname(file.originalFilename || '');
                    const fileName = `${uuidv4()}${fileExtension}`;

                    // Full path with folder structure
                    const fullPath = `${folderPath}/${fileName}`;

                    // Read the file
                    const fileContent = fs.readFileSync(file.filepath);

                    // Upload to S3
                    const uploadParams: PutObjectCommandInput = {
                        Bucket: process.env.S3_BUCKET_NAME as string,
                        Key: fullPath,
                        Body: fileContent,
                        ContentType: file.mimetype || undefined,
                        ContentDisposition: `inline; filename="${encodeURIComponent(file.originalFilename || fileName)}"`,
                    };

                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    // Create the file URL with the folder structure
                    const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${fullPath}`;

                    res.status(200).json({
                        message: 'Image uploaded successfully',
                        fileUrl: fileUrl,
                        fileName: fullPath,
                    });
                    return resolve();
                } catch (error) {
                    console.error('Error uploading to S3:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
