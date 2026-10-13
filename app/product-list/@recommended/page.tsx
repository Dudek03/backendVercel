import { getProducts } from '@/lib/repository';
import ProductTile from '@/components/ProductTile';

export default async function Recommended() {
    const products = await getProducts();
    const subset = products.slice(0, 3);
    return (
        <div>
            <h3 className="font-bold mb-4 text-black">Polecane</h3>
            <ul>{subset.map(p => <li key={p.id}>
                <ProductTile product={p} />
            </li>)}</ul>
        </div>
    );
}
