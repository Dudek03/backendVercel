import "server-only";
import { prisma } from "./db";
import type { Product } from "./types";

export const getProducts = async (
  sortBy: "name" | "newest" = "name",
  stock: "all" | "available" | "unavailable" = "all",
  category: "all" | string = "all",
): Promise<Product[]> => {
  const where: any = {};
  if (stock === "available") where.amount = { gt: 0 };
  if (stock === "unavailable") where.amount = { equals: 0 };
  if (category !== "all") where.categoryId = category;

  const orderBy =
    sortBy === "newest"
      ? [{ date: "desc" as const }, { id: "asc" as const }]
      : [{ nameSortKey: "asc" as const }, { id: "asc" as const }];

  const products = await prisma.product.findMany({
    where,
    orderBy,
  });

  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    image: p.image,
    price: p.price,
    amount: p.amount,
    type: p.categoryId,
    date: p.date.toISOString(),
  })) as Product[];
};

export const getProductById = async (id: number): Promise<Product | null> => {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return null;

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) return null;

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    amount: product.amount,
    type: product.categoryId,
    date: product.date.toISOString(),
  } as Product;
};
