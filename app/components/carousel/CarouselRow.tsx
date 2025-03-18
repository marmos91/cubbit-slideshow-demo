import styles from './CarouselRow.module.css';
import CroppedImage from './CroppedImage';
import { Photo } from './Photo';

interface CarouselRowProps {
    rowPhotos: Photo[];
}

const CarouselRow: React.FC<CarouselRowProps> = ({ rowPhotos }) => {
    return (
        <div className={styles.carouselRow}>
            {rowPhotos.map(photo => (
                <CroppedImage src={photo.url} imageKey={photo.key} key={photo.key} />
            ))}
        </div>
    );
};

export default CarouselRow;
