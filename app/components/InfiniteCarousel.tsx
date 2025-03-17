'use client';

import React, { useEffect, useState } from 'react';
import styles from './InfiniteCarousel.module.css';
import Image from 'next/image';

export interface Photo {
    url: string;
    key: string;
}

interface InfiniteCarouselProps {
    pollInterval?: number;
}

interface CroppedImageProps {
    imageKey: string;
    src: string;
}

interface CarouselRowProps {
    rowPhotos: Photo[];
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

const CroppedImage: React.FC<CroppedImageProps> = ({ src }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className={styles.photoContainer}>
            <Image
                width={500}
                height={500}
                priority
                src={src}
                alt={`Photo ${src}`}
                className={`${styles.photo} ${isLoaded ? styles.loaded : ''}`}
                onLoad={() => setIsLoaded(true)}
            />
        </div>
    );
};

const CarouselRow: React.FC<CarouselRowProps> = ({ rowPhotos }) => {
    return (
        <div className={styles.carouselRow}>
            {rowPhotos.map(photo => (
                <CroppedImage src={photo.url} imageKey={photo.key} key={photo.key} />
            ))}
        </div>
    );
};

const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({ pollInterval = 5000 }) => {
    const [photos, setPhotos] = useState<Photo[]>([]);

    useEffect(() => {
        // Example fetch
        const fetchPhotos = async () => {
            try {
                const res = await fetch('/api/photos');
                const newData: Photo[] = await res.json();

                // Only update if newData is actually different
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
