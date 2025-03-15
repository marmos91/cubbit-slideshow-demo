'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import styles from './UploadForm.module.css';

interface UploadResponse {
    message: string;
    fileUrl: string;
    fileName: string;
}

interface ErrorResponse {
    message: string;
    error?: string;
}

const UploadForm: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadStatus, setUploadStatus] = useState<string>('');

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setUploadStatus('');
        }
    };

    const uploadFile = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!file) {
            setUploadStatus('Please select a file first');
            return;
        }

        try {
            setIsUploading(true);
            setUploadStatus('Uploading...');

            // Create form data to send to Next.js API route
            const formData = new FormData();
            formData.append('file', file);

            // Send file to Next.js API route
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData: ErrorResponse = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            const data: UploadResponse = await response.json();

            setUploadStatus(`File uploaded successfully! URL: ${data.fileUrl}`);
            setFile(null);

            // Reset file input
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                (fileInput as HTMLInputElement).value = '';
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus(
                `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <form className={styles.form} onSubmit={uploadFile}>
                <input type="file" onChange={handleFileChange} disabled={isUploading} />
                <button className={styles.button} type="submit" disabled={isUploading || !file}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                </button>
            </form>
            {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}
        </div>
    );
};

export default UploadForm;
