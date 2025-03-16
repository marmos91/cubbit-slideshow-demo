// /app/slideshow/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './page.module.css';

interface Photo {
    key: string;
    url: string;
}

interface PhotoStyle {
    translateX: number; // in percentage
    translateY: number; // in percentage
    duration: number; // in seconds
}

const POLL_INTERVAL = 5000; // Poll every 5 seconds
const SWAP_INTERVAL = 3000; // Swap every 3 seconds
const MAX_IMAGES = 9; // Maximum photos on screen

/**
 * CrossfadeImage Component
 * Crossfades from the previous image to the new image over 1 second.
 */
function CrossfadeImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
    const [currentSrc, setCurrentSrc] = useState(src);
    const [prevSrc, setPrevSrc] = useState<string | null>(null);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        if (src !== currentSrc) {
            setPrevSrc(currentSrc);
            setCurrentSrc(src);
            setFade(true);
            const timeout = setTimeout(() => {
                setPrevSrc(null);
                setFade(false);
            }, 1000); // 1 second crossfade
            return () => clearTimeout(timeout);
        }
    }, [src, currentSrc]);

    return (
        <div className={styles.crossfadeWrapper}>
            {prevSrc && (
                <div className={styles.crossfadeImage} style={{ opacity: fade ? 0 : 1 }}>
                    <Image src={prevSrc} alt={alt} fill sizes={sizes} />
                </div>
            )}
            <div className={styles.crossfadeImage} style={{ opacity: 1 }}>
                <Image src={currentSrc} alt={alt} fill sizes={sizes} />
            </div>
        </div>
    );
}

export default function SlideshowPage() {
    // Full pool of photos fetched from the API.
    const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
    // Subset of photos currently displayed.
    const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
    // Mapping from photo key to its animation style.
    const [cellStyles, setCellStyles] = useState<Record<string, PhotoStyle>>({});
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch photos from the API.
    const fetchPhotos = async () => {
        try {
            const res = await fetch('/api/photos');
            const data = await res.json();
            if (Array.isArray(data)) {
                setAllPhotos(data);
            } else {
                console.error('Expected an array, got:', data);
            }
        } catch (error) {
            console.error('Error fetching photos:', error);
        }
    };

    useEffect(() => {
        fetchPhotos();
        pollingRef.current = setInterval(fetchPhotos, POLL_INTERVAL);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    // Initialize or update displayedPhotos.
    useEffect(() => {
        if (allPhotos.length <= MAX_IMAGES) {
            setDisplayedPhotos(allPhotos);
        } else {
            if (displayedPhotos.length === 0) {
                // Initialize with a random sample of MAX_IMAGES.
                const copy = [...allPhotos];
                const initial: Photo[] = [];
                for (let i = 0; i < MAX_IMAGES; i++) {
                    const idx = Math.floor(Math.random() * copy.length);
                    initial.push(copy.splice(idx, 1)[0]);
                }
                setDisplayedPhotos(initial);
            }
        }
    }, [allPhotos]);

    // Swap one random displayed photo with a new one from the full pool.
    useEffect(() => {
        if (allPhotos.length > MAX_IMAGES) {
            const swapInterval = setInterval(() => {
                setDisplayedPhotos(prevDisplayed => {
                    if (prevDisplayed.length === 0) return prevDisplayed;
                    const notDisplayed = allPhotos.filter(
                        photo => !prevDisplayed.find(p => p.key === photo.key)
                    );
                    if (notDisplayed.length === 0) return prevDisplayed;
                    const swapIndex = Math.floor(Math.random() * prevDisplayed.length);
                    const newPhoto = notDisplayed[Math.floor(Math.random() * notDisplayed.length)];
                    const newDisplayed = [...prevDisplayed];
                    newDisplayed[swapIndex] = newPhoto;
                    return newDisplayed;
                });
            }, SWAP_INTERVAL);
            return () => clearInterval(swapInterval);
        }
    }, [allPhotos]);

    // Preserve existing cellStyles and add styles for any new displayed photo.
    useEffect(() => {
        setCellStyles(prevStyles => {
            const newStyles = { ...prevStyles };
            displayedPhotos.forEach(photo => {
                if (!newStyles[photo.key]) {
                    const translateX = Math.random() * 20 - 10; // ±10%
                    const translateY = Math.random() * 20 - 10; // ±10%
                    const duration = 3 + Math.random() * 2; // 3 to 5 seconds
                    newStyles[photo.key] = { translateX, translateY, duration };
                }
            });
            return newStyles;
        });
    }, [displayedPhotos]);

    // Compute grid dimensions for non-overlapping display.
    const count = displayedPhotos.length;
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const cellWidth = 100 / columns; // in percentage
    const cellHeight = 100 / rows; // in percentage

    return (
        <div className={styles.container}>
            {count === 0 && (
                <div className={styles.noPhotos}>
                    <p>No photos uploaded today.</p>
                </div>
            )}
            {displayedPhotos.map((photo, index) => {
                // Calculate grid cell position.
                const col = index % columns;
                const row = Math.floor(index / columns);
                const left = col * cellWidth;
                const top = row * cellHeight;
                const styleForPhoto = cellStyles[photo.key];
                if (!styleForPhoto) return null;
                const { translateX, translateY, duration } = styleForPhoto;

                return (
                    <div
                        key={photo.key}
                        className={styles.gridCell}
                        style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${cellWidth}%`,
                            height: `${cellHeight}%`,
                        }}
                    >
                        <div
                            className={styles.innerContainer}
                            style={
                                {
                                    '--tx': `${translateX}%`,
                                    '--ty': `${translateY}%`,
                                    '--duration': `${duration}s`,
                                } as React.CSSProperties
                            }
                        >
                            <CrossfadeImage
                                src={photo.url}
                                alt="Floating Photo"
                                sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 20vw"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
