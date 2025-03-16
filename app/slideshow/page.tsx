// /app/slideshow/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface Photo {
    key: string;
    url: string;
}

const POLL_INTERVAL = 5000; // Poll every 5 seconds

const Slideshow = () => {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Function to fetch photos
    const fetchPhotos = async () => {
        try {
            const response = await fetch('/api/photos');
            const data = await response.json();
            if (Array.isArray(data)) {
                setPhotos(data);
            } else {
                console.error('Expected an array of photos, got:', data);
            }
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        }
    };

    // Start polling on mount and clear on unmount.
    useEffect(() => {
        fetchPhotos(); // initial fetch
        pollingRef.current = setInterval(fetchPhotos, POLL_INTERVAL);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Rotate the slideshow every 5 seconds if photos are available.
    useEffect(() => {
        if (photos.length === 0) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % photos.length);
        }, POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [photos]);

    // Ensure we have a valid photo to show.
    if (photos.length === 0 || !photos[currentIndex]) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#e0e0e0' }}>No photos uploaded today.</p>
            </div>
        );
    }

    return (
        <div
            style={{
                height: '100vh',
                width: '100vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#121212',
            }}
        >
            <img
                src={photos[currentIndex].url}
                alt="Slideshow"
                style={{
                    maxWidth: '90%',
                    maxHeight: '90%',
                    borderRadius: '8px',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.8)',
                }}
            />
        </div>
    );
};

export default function SlideshowPage() {
    return <Slideshow />;
}
