export default async function CatalogCatchAll({ params }: { params: Promise<{ slug?: string[] }> }) {
    const { slug } = await params;
    if (!slug) return <h1>Główny Katalog</h1>;
    if (slug.length === 1) return <h1>Kategoria: {slug[0]}</h1>;
    if (slug.length === 2) return <h1>Kategoria: {slug[0]}, Produkt ID: {slug[1]}</h1>;
    return <h1>Zbyt wiele segmentów!</h1>;
}
