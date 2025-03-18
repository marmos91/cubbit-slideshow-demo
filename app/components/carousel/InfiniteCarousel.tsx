'use client';

import React, { useEffect, useState } from 'react';
import styles from './InfiniteCarousel.module.css';
import { Photo } from './Photo';
import CarouselRow from './CarouselRow';
import { photosAreEqual, shuffleArray } from './utils';

interface InfiniteCarouselProps {
    pollInterval?: number;
}

const ROW_COUNT = 3;

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

    const rows = Array.from({ length: ROW_COUNT }, () => shuffleArray(photos));

    return (
        <div className={styles.carousel}>
            {rows.map((rowPhotos, rowIndex) => {
                const direction = rowIndex % 2 === 0 ? 'left' : 'right';

                return (
                    <CarouselRow
                        rowPhotos={rowPhotos}
                        key={rowIndex}
                        direction={direction}
                        rowIndex={rowIndex}
                    />
                );
            })}
        </div>
    );
};

export default InfiniteCarousel;
