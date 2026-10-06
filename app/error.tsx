'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div style={{ padding: '2rem', border: '1px solid red', backgroundColor: '#ffe6e6', color: 'black' }}>
            <h2>Wystąpił nieoczekiwany problem z pobieraniem danych!</h2>
            <p>Przepraszamy za usterki. Zespół techniczny został powiadomiony.</p>
            <button
                onClick={() => reset()}
                style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}
            >
                Spróbuj ponownie
            </button>
        </div>
    );
}
