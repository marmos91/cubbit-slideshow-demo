'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import styles from './UploadForm.module.css';

interface ErrorResponse {
    message: string;
    error?: string;
}

// Parse the environment variable or fallback to 40MB.
const MAX_FILE_SIZE = process.env.NEXT_PUBLIC_MAX_FILE_SIZE
    ? parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE, 10)
    : 40 * 1024 * 1024;

const UploadForm: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    // Auto-clear success status only if not uploading and the status is final (not "Uploading...")
    useEffect(() => {
        if (!isUploading && uploadStatus && uploadStatus !== 'Uploading...') {
            const timer = setTimeout(() => {
                setUploadStatus('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [uploadStatus, isUploading]);

    // Auto-clear error message only if not uploading
    useEffect(() => {
        if (!isUploading && error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, isUploading]);

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
        return file.size <= MAX_FILE_SIZE;
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Clear previous status and errors
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
                setError(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
                e.target.value = '';
                return;
            }

            setFile(selectedFile);
        }
    };

    const uploadFile = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a file first.');
            return;
        }

        try {
            setIsUploading(true);
            setUploadStatus('Uploading...');
            setError(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData: ErrorResponse = await response.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            // We no longer display the file URL in the success message.
            await response.json();
            setUploadStatus('Image uploaded successfully!');
            setFile(null);

            // Reset file input value
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                (fileInput as HTMLInputElement).value = '';
            }
        } catch (err) {
            console.error('Error uploading file:', err);
            setError(
                `Upload failed: ${err instanceof Error ? err.message : 'Unknown error occurred'}`
            );
            setUploadStatus('');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.uploadContainer}>
            <form className={styles.form} onSubmit={uploadFile}>
                <div className={styles.instructions}>
                    <p>Upload an image (max {MAX_FILE_SIZE / (1024 * 1024)}MB)</p>
                    <p>Supported formats: JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, HEIC, HEIF</p>
                </div>

                <input
                    type="file"
                    className={styles.fileInput}
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                />

                <button className={styles.button} type="submit" disabled={isUploading || !file}>
                    {isUploading ? 'Uploading...' : 'Upload Image'}
                </button>
            </form>

            {error && <div className={styles.error}>{error}</div>}
            {uploadStatus && <div className={styles.status}>{uploadStatus}</div>}
        </div>
    );
};

export default UploadForm;
