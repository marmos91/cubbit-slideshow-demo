import styles from './UploadForm.module.css';

const UploadForm = () => {
    return (
        <form className={styles.form}>
            <input type="file" />
            <button className={styles.button}>Upload</button>
        </form>
    );
};

export default UploadForm;
