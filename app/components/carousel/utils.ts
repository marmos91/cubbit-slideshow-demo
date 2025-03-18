import { Photo } from './Photo';

export function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Compare two arrays of Photos by length and keys */
export function photosAreEqual(prev: Photo[], next: Photo[]): boolean {
    if (prev.length !== next.length) return false;

    const prevKeys = new Set(prev.map(p => p.key));
    const nextKeys = new Set(next.map(p => p.key));

    if (prevKeys.size !== nextKeys.size) return false;

    for (const key of prevKeys) {
        if (!nextKeys.has(key)) return false;
    }
    return true;
}
