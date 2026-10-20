import { getProductById } from '@/lib/repository';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function ModalPhoto({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProductById(parseInt(id, 10));

    if (!product) notFound();

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <Link
                href={`/product-list/${product.id}`}
                style={{
                    backgroundColor: '#ef4444',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    marginBottom: '20px',
                    fontWeight: 'bold',
                    textDecoration: 'none'
                }}
            >
                Zamknij [X]
            </Link>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px' }}>
                <Image
                    src={product.image}
                    alt={product.name}
                    width={600}
                    height={600}
                    style={{ objectFit: 'contain', maxHeight: '75vh' }}
                />
            </div>
        </div>
    );
}
