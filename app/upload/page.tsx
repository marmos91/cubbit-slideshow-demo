import UploadForm from '../components/UploadForm';
import styles from './page.module.css';
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
                <img src="/cubbit.png" alt="Cubbit logo" />
                <img src="/elemento.png" alt="Elemento logo" />
            </div>
            <h1 className={styles.h1}>Upload a photo now to celebrate CloudFest</h1>
            <UploadForm />
        </main>
    );
};

export default UploadPage;
