import { S3Client, PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, Files } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

    return new Promise<void>((resolve, reject) => {
        try {
            // Parse the form data with formidable
            const form = new IncomingForm();

            form.parse(req, async (err, _fields, files: Files) => {
                if (err) {
                    res.status(500).json({ message: 'Error parsing form data' });
                    return resolve();
                }

                const fileField = files.file;

                // Handle both single file and array of files
                const file = Array.isArray(fileField) ? fileField[0] : fileField;

                if (!file) {
                    res.status(400).json({ message: 'No file uploaded' });
                    return resolve();
                }

                try {
                    // Configure S3 client (credentials stored securely on the server)
                    const s3Client = new S3Client({
                        region: process.env.S3_REGION || 'us-east-1',
                        credentials: {
                            accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
                            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
                        },
                        endpoint: process.env.S3_ENDPOINT,
                        forcePathStyle: true,
                    });

                    // Generate a unique filename
                    const fileExtension = path.extname(file.originalFilename || '');
                    const fileName = `${uuidv4()}${fileExtension}`;

                    // Read the file
                    const fileContent = fs.readFileSync(file.filepath);

                    // Upload to S3
                    const uploadParams: PutObjectCommandInput = {
                        Bucket: process.env.S3_BUCKET_NAME as string,
                        Key: fileName,
                        Body: fileContent,
                    };

                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    // Create the file URL (adjust based on your S3-compatible service)
                    const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${fileName}`;

                    res.status(200).json({
                        message: 'File uploaded successfully',
                        fileUrl: fileUrl,
                        fileName: fileName,
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
