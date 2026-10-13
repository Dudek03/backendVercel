import { getProductById } from '@/lib/repository';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ModalPhoto({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProductById(parseInt(id, 10));

    if (!product) notFound();

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
            <Link href={`/product-list/${product.id}`} className="text-white mb-4 text-xl font-bold bg-red-600 px-4 py-2 rounded">
                Zamknij [X]
            </Link>
            <div className="bg-white p-4 rounded">
                <Image
                    src={product.image}
                    alt={product.name}
                    width={600}
                    height={600}
                    className="object-contain max-h-[80vh]"
                />
            </div>
        </div>
    );
}
