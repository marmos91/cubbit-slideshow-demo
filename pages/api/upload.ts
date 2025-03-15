import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

    return new Promise<void>((resolve, reject) => {
        try {
            const form = new IncomingForm();

            form.parse(req, async (err, _fields, files: Files) => {
                if (err) {
                    res.status(500).json({ message: 'Error parsing form data' });
                    return resolve();
                }

                const fileField = files.file;
                const file = Array.isArray(fileField) ? fileField[0] : fileField;

                if (!file) {
                    res.status(400).json({ message: 'No file uploaded' });
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
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');

                    const folderPath = `${year}/${month}/${day}`;

                    const fileExtension = path.extname(file.originalFilename || '');
                    const fileName = `${uuidv4()}${fileExtension}`;

                    const fullPath = `${folderPath}/${fileName}`;

                    const fileContent = fs.readFileSync(file.filepath);

                    // Upload to S3
                    const uploadParams: PutObjectCommandInput = {
                        Bucket: process.env.S3_BUCKET_NAME as string,
                        Key: fullPath,
                        Body: fileContent,
                        ContentType: file.mimetype || undefined,
                    };

                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    // Create the file URL with the folder structure
                    const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${fullPath}`;

                    res.status(200).json({
                        message: 'File uploaded successfully',
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
