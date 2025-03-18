'use client';

import styles from './page.module.css';
import { Orbitron } from 'next/font/google';
import InfiniteCarousel from '../components/carousel/InfiniteCarousel';
import Image from 'next/image';

const orbitron = Orbitron({
    weight: '500',
    subsets: ['latin'],
    style: 'normal',
});

const S3_ENDPOINT = process.env.NEXT_PUBLIC_S3_ENDPOINT;
const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;

export default function SlideshowPage() {
    const today = new Date();

    const formattedDate = today.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <main className={[styles.container, orbitron.className].join(' ')}>
            <header className={styles.header}>
                <Image src="/cubbit.png" alt="Cubbit logo" width={30} height={40} priority />
                <Image src="/elemento.png" alt="Elemento logo" width={40} height={40} priority />

                <h1>{formattedDate}</h1>
                {S3_ENDPOINT !== undefined ? (
                    <span>{`URL: ${S3_ENDPOINT}/${S3_BUCKET}`}</span>
                ) : (
                    <></>
                )}
            </header>

            <div className={styles.carouselContainer}>
                <InfiniteCarousel />
            </div>
        </main>
    );
}
