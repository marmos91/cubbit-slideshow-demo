import UploadForm from '../components/UploadForm';
import styles from './page.module.css';

const UploadPage = () => {
    return (
        <main className={styles.uploadPage}>
            <div className={styles.logo}>
                <img src="/cubbit.png" alt="Cubbit logo" />
                <img src="/elemento.png" alt="Cubbit logo" />
            </div>
            <h1 className={styles.h1}>Upload a photo now to celebrate CloudFest</h1>
            <UploadForm />
        </main>
    );
};

export default UploadPage;
