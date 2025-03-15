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
    const [error, setError] = useState<string | null>(null);

    const isValidFileType = (file: File): boolean => {
        const validImageTypes = [
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
        return validImageTypes.includes(file.type);
    };

    const isValidFileSize = (file: File): boolean => {
        const maxSize = 40 * 1024 * 1024; // 40MB
        return file.size <= maxSize;
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Clear previous status
            setUploadStatus('');
            setError(null);

            // Validate file type
            if (!isValidFileType(selectedFile)) {
                setError('Invalid file type. Only images are allowed.');
                e.target.value = '';
                return;
            }

            // Validate file size
            if (!isValidFileSize(selectedFile)) {
                setError('File too large. Maximum size is 40MB.');
                e.target.value = '';
                return;
            }

            setFile(selectedFile);
        }
    };

    const uploadFile = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file first');
            return;
        }

        try {
            setIsUploading(true);
            setUploadStatus('Uploading...');
            setError(null);

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

            setUploadStatus(`Image uploaded successfully! URL: ${data.fileUrl}`);
            setFile(null);

            // Reset file input
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                (fileInput as HTMLInputElement).value = '';
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setUploadStatus('');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div>
            <form className={styles.form} onSubmit={uploadFile}>
                <div className={styles.instructions}>
                    <p>Upload an image (max 40MB)</p>
                    <p>Supported formats: JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, HEIC, HEIF</p>
                </div>

                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />

                <button className={styles.button} type="submit" disabled={isUploading || !file}>
                    {isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
            </form>

            {error && <p className={styles.error}>{error}</p>}
            {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}
        </div>
    );
};

export default UploadForm;
