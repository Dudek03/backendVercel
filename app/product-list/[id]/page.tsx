import { getProductById } from '@/lib/repository';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { validateId } from '@/lib/validators';
import ProductTile from '@/components/ProductTile';

export async function generateStaticParams() {
    return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProductById(parseInt(id, 10));
    return { title: product ? `Produkt: ${product.name}` : 'Nie znaleziono produktu' };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!validateId(id)) {
        notFound()
    }

    const numericId = parseInt(id, 10);
    if (!Number.isSafeInteger(numericId) || numericId > 2147483647) notFound();

    const product = await getProductById(numericId);
    if (!product) notFound();

    return (
        <div>
            <Link href="/product-list" className="text-blue-500 block mb-4">&larr; Wróć do katalogu</Link>
            <ProductTile product={product} />
        </div>
    );
}
