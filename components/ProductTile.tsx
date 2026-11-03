import type { Product } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';

export default function ProductTile({ product }: { product: Product }) {
    return (
        <li key={product.id} style={{
            border: '1px solid #ccc',
            padding: '1rem',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: 'black'
        }}>
            <Link href={`/product-list/img/${product.id}`}>
                <Image
                    src={product.image}
                    alt={`Zdjęcie produktu: ${product.name}`}
                    width={150}
                    height={150}
                    style={{ objectFit: 'contain', marginBottom: '1rem', cursor: 'pointer' }}
                />
            </Link>

            <Link
                href={`/product-list/${product.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
                <h2 style={{ fontSize: '1.2rem', textAlign: 'center' }}>{product.name}</h2>
                <p><strong>Kategoria:</strong> {product.type}</p>
                <p><strong>Cena:</strong> {(product.price / 100).toFixed(2)} zł</p>
                <p><strong>Dostępność:</strong> {product.amount > 0 ? `${product.amount} szt.` : 'Brak na stanie'}</p>
            </Link>
        </li>
    )
}
