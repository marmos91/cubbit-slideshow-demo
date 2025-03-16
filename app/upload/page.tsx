import UploadForm from '../components/UploadForm';
import styles from './page.module.css';
import Image from 'next/image';
import { Titillium_Web } from 'next/font/google';

const titillium = Titillium_Web({
    weight: '400',
    subsets: ['latin'],
    style: 'normal',
});

const UploadPage = () => {
    return (
        <main className={[styles.uploadPage, titillium.className].join(' ')}>
            <div className={styles.logo}>
                <Image src="/cubbit.png" alt="Cubbit logo" width={60} height={80} priority />
                <Image src="/elemento.png" alt="Elemento logo" width={80} height={80} priority />
            </div>
            <h1 className={styles.h1}>Upload a photo now to celebrate CloudFest</h1>
            <UploadForm />
        </main>
    );
};

export default UploadPage;
