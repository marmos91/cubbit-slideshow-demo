import UploadForm from '../components/upload/UploadForm';
import styles from './page.module.css';
import Image from 'next/image';
import { Orbitron } from 'next/font/google';

const orbitron = Orbitron({
    weight: '400',
    subsets: ['latin'],
    style: 'normal',
});

const h1Copy = 'Upload a photo to Cubbit DS3 Powered by Elemento';

const UploadPage = () => {
    return (
        <main className={[styles.uploadPage, orbitron.className].join(' ')}>
            <div className={styles.logo}>
                <Image src="/cubbit.png" alt="Cubbit logo" width={60} height={80} priority />
                <Image src="/elemento.png" alt="Elemento logo" width={80} height={80} priority />
            </div>
            <h1 className={styles.h1}>{h1Copy}</h1>
            <UploadForm />
        </main>
    );
};

export default UploadPage;
