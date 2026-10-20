import { getProducts } from '@/lib/repository';
import Filters from '@/components/Filters';
import { parseCatalogParams } from '@/lib/validators';
import ProductTile from '@/components/ProductTile';

export default async function ProductListPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    const { type, stock, sort, isTypeInvalid } = parseCatalogParams(params)

    const products = await getProducts(sort, stock, type);

    return (
        <div>
            <Filters />
            {isTypeInvalid && <p className="text-red-500">Pominięto błędny parametr kategorii.</p>}
            {products.length === 0 ? (
                <p>Brak wyników spełniających kryteria.</p>
            ) : (
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {products.map(p => (
                        <li key={p.id} className="border p-4 rounded">
                            <ProductTile product={p} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
