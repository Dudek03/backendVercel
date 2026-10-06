import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
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
                <header style={{
                    padding: '1rem',
                    borderBottom: '1px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2rem'
                }}>
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

                    <nav>
                        <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
                            <li><Link href="/">Strona Główna</Link></li>
                            <li><Link href="/product-list">Katalog Produktów</Link></li>
                            <li><Link href="/basket">Koszyk</Link></li>
                            <li><Link href="/order-history">Historia Zamówień</Link></li>
                            <li><Link href="/about">O nas</Link></li>
                        </ul>
                    </nav>
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
