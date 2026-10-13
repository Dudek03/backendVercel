'use client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Filters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(key, value);
        router.push(`?${params.toString()}`);
    };

    const clearFilters = () => router.push('/product-list');

    return (
        <div className="flex gap-4 mb-6 p-4 bg-gray-100 rounded text-black">
            <select onChange={(e) => updateFilter('type', e.target.value)} value={searchParams.get('type') || 'all'}>
                <option value="all">Wszystkie</option>
                <option value="cpu">CPU</option>
                <option value="gpu">GPU</option>
                <option value="ram">RAM</option>
                <option value="disk">DISK</option>
            </select>
            <select onChange={(e) => updateFilter('stock', e.target.value)} value={searchParams.get('stock') || 'all'}>
                <option value="all">Wszystkie stany</option>
                <option value="available">Dostępne</option>
                <option value="unavailable">Niedostępne</option>
            </select>
            <select onChange={(e) => updateFilter('sort', e.target.value)} value={searchParams.get('sort') || 'name'}>
                <option value="name">Po nazwie</option>
                <option value="newest">Najnowsze</option>
            </select>
            <button onClick={clearFilters} className="px-4 py-1 bg-red-500 text-white rounded">Wyczyść</button>
        </div>
    );
}
