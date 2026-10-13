import "server-only";
import { Product } from "./types";
import productsData from "./data.json";

export const validateProducts = (data: Product[]) => {
  const ids = new Set<number>();
  const codes = new Set<string>();

  for (const product of data) {
    if (product.price < 0)
      throw new Error(
        `Cena nie może być ujemna. Błąd w produkcie ID: ${product.id}`,
      );
    if (ids.has(product.id)) throw new Error(`Duplikat ID: ${product.id}`);
    if (codes.has(product.code))
      throw new Error(`Duplikat kodu: ${product.code}`);

    ids.add(product.id);
    codes.add(product.code);
  }
  return true;
};

const products: Product[] = productsData as Product[];
validateProducts(products);

export const getProducts = async (
  sortBy: "name" | "newest" = "name",
  stock: "all" | "available" | "unavailable" = "all",
  category: "all" | string = "all",
): Promise<Product[]> => {
  let result = [...products];

  if (stock === "available") result = result.filter((p) => p.amount > 0);
  if (stock === "unavailable") result = result.filter((p) => p.amount === 0);
  if (category !== "all") result = result.filter((p) => p.type === category);

  result.sort((a, b) => {
    if (sortBy === "newest") {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : a.id - b.id; // remis po ID
    }
    const nameDiff = a.name.localeCompare(b.name);
    return nameDiff !== 0 ? nameDiff : a.id - b.id; // remis po ID
  });

  return result;
};

export const getProductById = async (id: number): Promise<Product | null> => {
  const product = products.find((p) => p.id === id);
  return product || null;
};
