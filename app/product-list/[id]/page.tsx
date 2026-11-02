import { getProductById } from "@/lib/repository";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import AddToCartButton from "@/components/AddToCartButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const product = await getProductById(parseInt(id, 10));
  return {
    title: product ? `Produkt: ${product.name}` : "Nie znaleziono produktu",
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const numericId = parseInt(id, 10);
  const product = await getProductById(numericId);

  if (!product) notFound();

  return (
    <div className="max-w-2xl mx-auto p-4 border rounded shadow">
      <Link href="/product-list" className="text-blue-500 block mb-4">
        &larr; Wróć do katalogu
      </Link>

      <h1 className="text-2xl font-bold">{product.name}</h1>

      <Link href={`/product-list/img/${product.id}`}>
        <Image
          src={product.image}
          alt={product.name}
          width={300}
          height={300}
          className="my-4 cursor-pointer hover:opacity-80 transition"
        />
      </Link>

      <div className="my-4 p-4 bg-gray-50 rounded">
        <h3 className="font-bold">Opis produktu:</h3>
        <p className="font-black">{product.description}</p>
      </div>

      <p>
        <strong>Cena:</strong> {(product.price / 100).toFixed(2)} PLN
      </p>
      <p>
        <strong>Kategoria:</strong> {product.type}
      </p>
      <p>
        <strong>Stan magazynowy:</strong>{" "}
        {product.amount > 0 ? `${product.amount} szt.` : "Brak"}
      </p>

      <div className="mt-4">
        <AddToCartButton productId={product.id} stock={product.amount} />
      </div>
    </div>
  );
}
