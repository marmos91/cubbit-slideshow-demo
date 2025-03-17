'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { Orbitron } from 'next/font/google';
import InfiniteCarousel, { Photo } from '../components/InfiniteCarousel';

const POLL_INTERVAL = 5000; // Poll every 5 seconds
const MAX_IMAGES = 12; // Maximum photos on screen

const orbitron = Orbitron({
    weight: '500',
    subsets: ['latin'],
    style: 'normal',
});

export default function SlideshowPage() {
    const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
    const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch photos from the API route
    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos');
            const data = await res.json();

            if (Array.isArray(data)) {
                console.log('Setting photos', data);
                setAllPhotos(data);
            } else {
                console.error('Expected an array, got:', data);
            }
        } catch (error) {
            console.error('Error fetching photos:', error);
        }
    };

    // Initial load + polling
    useEffect(() => {
        fetchPhotos();

        pollingRef.current = setInterval(fetchPhotos, POLL_INTERVAL);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Setup displayedPhotos
    useEffect(() => {
        if (allPhotos.length <= MAX_IMAGES) {
            setDisplayedPhotos(allPhotos);
        }
    }, [allPhotos]);

    // Format today's date for the header
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <main className={[styles.container, orbitron.className].join(' ')}>
            <header className={styles.header}>
                <h1>{formattedDate}</h1>
            </header>

            <div className={styles.masonry}>
                {displayedPhotos.length === 0 && (
                    <p className={styles.noPhotos}>No photos uploaded today.</p>
                )}

                <InfiniteCarousel photos={displayedPhotos} />
            </div>
        </main>
    );
}
