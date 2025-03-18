import styles from './CarouselRow.module.css';
import CroppedImage from './CroppedImage';
import { Photo } from './Photo';

interface CarouselRowProps {
    rowPhotos: Photo[];
    direction: 'left' | 'right';
    rowIndex: number;
    minCountForMarquee?: number;
}

const CarouselRow: React.FC<CarouselRowProps> = ({
    rowPhotos,
    direction,
    minCountForMarquee = 6,
}) => {
    // Enable Marquee only after threshold
    if (rowPhotos.length < minCountForMarquee) {
        return (
            <div className={styles.staticRow}>
                {rowPhotos.map((photo, i) => (
                    <CroppedImage photo={photo} key={`${photo.key}-${i}`} />
                ))}
            </div>
        );
    }

    const doubled = [...rowPhotos, ...rowPhotos];

    const containerWidth = 15 * 16;
    const gapWidth = 16;
    const itemWidth = containerWidth + gapWidth;
    const uniqueWidth = rowPhotos.length * itemWidth;

    const rowStyle: React.CSSProperties = {
        ['--translate' as string]: `${uniqueWidth}px`,
    };

    const rowClass = direction === 'left' ? styles.scrollLeftRow : styles.scrollRightRow;

    return (
        <div className={`${styles.staticRow} ${rowClass}`} style={rowStyle}>
            {doubled.map((photo, i) => (
                <CroppedImage photo={photo} key={`${photo.key}-${i}`} />
            ))}
        </div>
    );
};

export default CarouselRow;
