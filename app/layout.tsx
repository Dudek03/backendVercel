import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Navigation from '@/components/Navigation';
import AuthStatus from '@/components/AuthStatus';
import './global.css';

export const metadata: Metadata = {
    title: 'Sklep Komputerowy',
    description: 'Projekt laboratorium - Programowanie BackEnd',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pl">
            <body>
                <header className="p-4 border-b flex items-center gap-8 flex-wrap">
                    <Link href="/">
                        <Image
                            src="/politechnika-krakowska-logo.svg"
                            alt="Logo Politechniki Krakowskiej"
                            width={200}
                            height={60}
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </Link>

                    <Navigation />
                    <AuthStatus />
                </header>
                <main style={{ padding: '2rem' }}>
                    {children}
                </main>
                <footer style={{ padding: '1rem', borderTop: '1px solid #ccc', marginTop: '2rem', textAlign: 'center' }}>
                    <p>&copy; 2026 Sklep Komputerowy. Wszelkie prawa zastrzeżone.</p>
                </footer>
            </body>
        </html>
    );
}
