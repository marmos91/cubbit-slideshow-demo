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

const CroppedImage: React.FC<CroppedImageProps> = props => {
    return (
        <div className={styles.photoContainer}>
            <Image
                width={500}
                height={500}
                priority
                src={props.src}
                alt={`Photo ${props.src}`}
                className={styles.photo}
            />
        </div>
    );
};

const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({ pollInterval = 5000 }) => {
    const [allPhotos, setAllPhotos] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await fetch('/api/photos');
                const data: Photo[] = await res.json();

                if (Array.isArray(data)) {
                    setAllPhotos(prevPhotos => {
                        const currentPictures = { ...prevPhotos };

                        for (const photo of data) {
                            if (!(photo.key in currentPictures)) {
                                currentPictures[photo.key] = photo.url;
                            }
                        }
                        return currentPictures;
                    });
                } else {
                    console.error('Expected an array, got:', data);
                }
            } catch (error) {
                console.error('Error fetching photos:', error);
            }
        };

        fetchPhotos();
        const intervalId = setInterval(fetchPhotos, pollInterval);

        return () => clearInterval(intervalId);
    }, [pollInterval]);

    if (Object.keys(allPhotos).length === 0) {
        return <p className={styles.noPhotos}>No photos uploaded today.</p>;
    }

    return (
        <div className={styles.container}>
            {Object.entries(allPhotos).map(([key, url]) => (
                <CroppedImage src={url} imageKey={key} key={key} />
            ))}
        </div>
    );
};

export default InfiniteCarousel;
