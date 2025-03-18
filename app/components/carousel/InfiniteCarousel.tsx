'use client';

import React, { useEffect, useState } from 'react';
import styles from './InfiniteCarousel.module.css';
import { Photo } from './Photo';
import CarouselRow from './CarouselRow';

interface InfiniteCarouselProps {
    pollInterval?: number;
}

const MAX_ROWS = 3;

function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Compare two arrays of Photos by length and keys */
function photosAreEqual(prev: Photo[], next: Photo[]): boolean {
    if (prev.length !== next.length) return false;

    const prevKeys = new Set(prev.map(p => p.key));
    const nextKeys = new Set(next.map(p => p.key));

    if (prevKeys.size !== nextKeys.size) return false;

    for (const key of prevKeys) {
        if (!nextKeys.has(key)) return false;
    }
    return true;
}

const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({ pollInterval = 5000 }) => {
    const [photos, setPhotos] = useState<Photo[]>([]);

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await fetch('/api/photos');
                const newData: Photo[] = await res.json();

                if (!photosAreEqual(photos, newData)) {
                    setPhotos(newData);
                }
            } catch (err) {
                console.error('Failed to fetch photos:', err);
            }
        };

        fetchPhotos();
        const intervalId = setInterval(fetchPhotos, pollInterval);

        return () => clearInterval(intervalId);
    }, [pollInterval, photos]);

    if (photos.length === 0) {
        return <p className={styles.noPhotos}>No photos uploaded today.</p>;
    }

    // Create ROW_COUNT arrays, each a shuffled copy of the full photos
    const rows = Array.from({ length: MAX_ROWS }, () => shuffleArray(photos));

    return (
        <div className={styles.carousel}>
            {rows.map((rowPhotos, rowIndex) => (
                <CarouselRow rowPhotos={rowPhotos} key={rowIndex} />
            ))}
        </div>
    );
};

export default InfiniteCarousel;
