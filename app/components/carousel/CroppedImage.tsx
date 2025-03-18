import { useState } from 'react';
import Image from 'next/image';
import styles from './CroppedImage.module.css';

interface CroppedImageProps {
    imageKey: string;
    src: string;
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

export default CroppedImage;
