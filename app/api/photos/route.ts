import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';

// Validate required environment variables.
const {
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    NEXT_PUBLIC_S3_BUCKET_NAME,
    S3_REGION,
    NEXT_PUBLIC_S3_ENDPOINT,
} = process.env;

if (
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY ||
    !NEXT_PUBLIC_S3_BUCKET_NAME ||
    !S3_REGION ||
    !NEXT_PUBLIC_S3_ENDPOINT
) {
    throw new Error('Missing required S3 environment variables');
}

// Create the S3 client with s3-compatible service settings.
const s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    endpoint: NEXT_PUBLIC_S3_ENDPOINT,
    forcePathStyle: true,
});

export async function GET() {
    // Construct prefix using today's date and the pattern <year>/<month>/<day>/
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `${year}/${month}/${day}/`;

    try {
        const command = new ListObjectsV2Command({
            Bucket: NEXT_PUBLIC_S3_BUCKET_NAME,
            Prefix: prefix,
        });
        const response = await s3Client.send(command);
        const objects = response.Contents || [];

        // Map each S3 object to an object containing its key and a public URL.
        // Since you're using an s3-compatible service, we use the S3_ENDPOINT to construct the URL.
        const images = objects.map(obj => ({
            key: obj.Key,
            url: `${NEXT_PUBLIC_S3_ENDPOINT}/${NEXT_PUBLIC_S3_BUCKET_NAME}/${obj.Key}`,
        }));

        return NextResponse.json(images);
    } catch (error) {
        console.error('Error listing S3 objects:', error);
        return NextResponse.json({ error: 'Error listing photos' }, { status: 500 });
    }
}
