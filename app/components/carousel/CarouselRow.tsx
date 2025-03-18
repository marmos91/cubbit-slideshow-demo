import styles from './CarouselRow.module.css';
import CroppedImage from './CroppedImage';
import { Photo } from './Photo';

interface CarouselRowProps {
    rowPhotos: Photo[];
    direction: 'left' | 'right';
    rowIndex: number;
}

const CarouselRow: React.FC<CarouselRowProps> = ({ rowPhotos, direction }) => {
    const doubled = [...rowPhotos, ...rowPhotos];

    const containerWidth = 15 * 16; // e.g. 15rem => 240px
    const gapWidth = 16; // 1rem => 16px
    const itemWidth = containerWidth + gapWidth; // ~256px each
    const uniqueWidth = rowPhotos.length * itemWidth;

    const rowStyle: React.CSSProperties = {
        ['--translate' as string]: `${uniqueWidth}px`,
    };

    const rowClass = direction === 'left' ? styles.scrollLeftRow : styles.scrollRightRow;

    return (
        <div className={`${styles.animatedRow} ${rowClass}`} style={rowStyle}>
            {doubled.map((photo, i) => (
                <CroppedImage photo={photo} key={`${photo.key}-${i}`} />
            ))}
        </div>
    );
};

export default CarouselRow;
