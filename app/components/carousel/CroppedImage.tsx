import { useState } from 'react';
import Image from 'next/image';
import styles from './CroppedImage.module.css';
import { Photo } from './Photo';

interface CroppedImageProps {
    photo: Photo;
}

const CroppedImage: React.FC<CroppedImageProps> = ({ photo }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className={styles.photoContainer}>
            <Image
                width={500}
                height={500}
                priority
                src={photo.url}
                alt={`Photo ${photo.url}`}
                className={`${styles.photo} ${isLoaded ? styles.loaded : ''}`}
                onLoad={() => setIsLoaded(true)}
            />
        </div>
    );
};

export default CroppedImage;
