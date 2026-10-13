import { getProducts } from '@/lib/repository';
import ProductTile from '@/components/ProductTile';

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
                    <ProductTile key={product.id} product={product} />
                ))}
            </ul>
        </div>
    );
}
