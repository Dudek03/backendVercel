import { getProducts } from '@/lib/repository';
import Image from 'next/image';

export default async function ProductListPage() {
    const products = await getProducts('name');

    if (products.length === 0) {
        return <p>Katalog jest obecnie pusty. Brak produktów do wyświetlenia.</p>;
    }

    return (
        <div>
            <h1>Katalog Produktów</h1>
            <ul style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', listStyle: 'none', padding: 0 }}>
                {products.map((product) => (
                    <li key={product.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Image
                            src={product.image}
                            alt={`Zdjęcie produktu: ${product.name}`}
                            width={150}
                            height={150}
                            style={{ objectFit: 'contain', marginBottom: '1rem' }}
                        />
                        <h2 style={{ fontSize: '1.2rem', textAlign: 'center' }}>{product.name}</h2>
                        <p><strong>Kategoria:</strong> {product.type}</p>
                        <p><strong>Cena:</strong> {(product.price / 100).toFixed(2)} zł</p>
                        <p><strong>Dostępność:</strong> {product.amount > 0 ? `${product.amount} szt.` : 'Brak na stanie'}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
