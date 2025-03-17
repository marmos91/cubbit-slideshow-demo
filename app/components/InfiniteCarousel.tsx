import styles from './InfiniteCarousel.module.css';

interface Photo {
    url: string;
    key: string; // could also be the path
}

interface InfiniteCarouselProps {
    photos: Photo[];
}

const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({ photos }) => {
    // Split photos between two rows (for example, even indices for row 1 and odd for row 2)
    const row1Photos = photos.filter((_, index) => index % 2 === 0);
    const row2Photos = photos.filter((_, index) => index % 2 !== 0);

    // Duplicate images to allow a continuous scroll
    const duplicateImages = (items: Photo[]) => [...items, ...items];

    return (
        <div className={styles.carousel}>
            <div className={styles.row}>
                {duplicateImages(row1Photos).map((photo, index) => (
                    <div key={`row1-${index}`} className={styles.imageContainer}>
                        <img src={photo.url} alt={photo.key} className={styles.image} />
                    </div>
                ))}
            </div>
            <div className={styles.rowReverse}>
                {duplicateImages(row2Photos).map((photo, index) => (
                    <div key={`row2-${index}`} className={styles.imageContainer}>
                        <img src={photo.url} alt={photo.key} className={styles.image} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default InfiniteCarousel;

