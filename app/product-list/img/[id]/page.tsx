import { getProductById } from '@/lib/repository';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function FullScreenPhoto({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProductById(parseInt(id, 10));

    if (!product) notFound();

    return (
        <div className="max-w-4xl mx-auto text-center">
            <Link href={`/product-list/${product.id}`} className="text-blue-500 mb-8 block">&larr; Powrót do szczegółów</Link>
            <h1 className="text-2xl mb-4 font-bold">Pełny rozmiar: {product.name}</h1>
            <Image
                src={product.image}
                alt={product.name}
                width={1000}
                height={1000}
                className="object-contain mx-auto border shadow-lg"
            />
        </div>
    );
}
