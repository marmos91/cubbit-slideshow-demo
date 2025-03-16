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
const MAX_IMAGES = 12; // Maximum photos on screen

/**
 * CrossfadeImage Component
 * Waits until the new image is fully loaded (using onLoad)
 * then crossfades from the previous image to the new one over 1 second.
 */
function CrossfadeImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
    const [currentSrc, setCurrentSrc] = useState(src);
    const [prevSrc, setPrevSrc] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (src !== currentSrc) {
            setPrevSrc(currentSrc);
            setCurrentSrc(src);
            setIsLoaded(false);
        }
    }, [src, currentSrc]);

    return (
        <div className={styles.crossfadeWrapper}>
            <div className={styles.imageWrapper}>
                {prevSrc && (
                    <div className={styles.crossfadeImage} style={{ opacity: isLoaded ? 0 : 1 }}>
                        <Image src={prevSrc} alt={alt} fill sizes={sizes} />
                    </div>
                )}
                <div className={styles.crossfadeImage} style={{ opacity: isLoaded ? 1 : 0 }}>
                    <Image
                        src={currentSrc}
                        alt={alt}
                        fill
                        sizes={sizes}
                        onLoad={() => setIsLoaded(true)}
                    />
                </div>
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

    // Define a function to refresh the photo pool.
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

    // Poll for photos on mount.
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

    // Compute grid dimensions dynamically.
    const count = displayedPhotos.length;
    let columns: number;
    if (count <= 3) {
        // For 1 to 3 photos, display them in a single row.
        columns = count;
    } else {
        columns = Math.ceil(Math.sqrt(count));
    }
    const rows = Math.ceil(count / columns);
    const cellWidth = 100 / columns; // percentage
    const cellHeight = 100 / rows; // percentage

    // Format today's date.
    const today = new Date();
    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className={styles.container}>
            {/* Header Section */}
            <header className={styles.header}>
                <h1>{formattedDate}</h1>
                <button
                    className={styles.refreshButton}
                    onClick={fetchPhotos}
                    title="Refresh Photos"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1l-4 4 4 4V6c1.27 0 2.49.49 3.4 1.4a4.78 4.78 0 0 1 0 6.8 4.78 4.78 0 0 1-6.8 0A4.78 4.78 0 0 1 7.6 10H6.16a6.24 6.24 0 0 0 1.82 4.43 6.28 6.28 0 0 0 8.88 0 6.28 6.28 0 0 0 0-8.88A6.24 6.24 0 0 0 12 2.84V2l.07-.07L17.65 6.35z" />
                    </svg>
                </button>
            </header>
            {/* Grid Container */}
            <div className={styles.gridContainer}>
                {count === 0 && (
                    <div className={styles.noPhotos}>
                        <p>No photos uploaded today.</p>
                    </div>
                )}
                {displayedPhotos.map((photo, index) => {
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
        </div>
    );
}
