'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/' && pathname === '/') return true;
        if (path !== '/' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <nav>
            <ul className="flex flex-wrap gap-4 list-none m-0 p-0">
                <li><Link
                    href="/" aria-current={isActive('/') ? 'page' : undefined}
                    className={isActive('/') ? 'font-bold text-blue-600' : ''}>
                    Strona Główna
                </Link></li>
                <li><Link href="/product-list"
                    aria-current={isActive('/product-list') ? 'page' : undefined}
                    className={isActive('/product-list') ? 'font-bold text-blue-600' : ''}>
                    Katalog
                </Link></li>
                <li><Link href="/catalog"
                    aria-current={isActive('/catalog') ? 'page' : undefined}
                    className={isActive('/catalog') ? 'font-bold text-blue-600' : ''}>
                    Katalog (Catch-all)
                </Link></li>
                <li><Link href="/basket"
                    aria-current={isActive('/basket') ? 'page' : undefined}
                    className={isActive('/basket') ? 'font-bold text-blue-600' : ''}>
                    Koszyk
                </Link></li>
                <li><Link href="/order-history"
                    aria-current={isActive('/order-history') ? 'page' : undefined}
                    className={isActive('/order-history') ? 'font-bold text-blue-600' : ''}>
                    Historia Zamówień
                </Link></li>
                <li><Link href="/about"
                    aria-current={isActive('/about') ? 'page' : undefined}
                    className={isActive('/about') ? 'font-bold text-blue-600' : ''}>
                    O nas
                </Link></li>
            </ul>
        </nav>
    );
}
