import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { generateNameSortKey } from "../lib/sort";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface RawProduct {
  id: number;
  code: string;
  name: string;
  type: string;
  price: number;
  amount: number;
  description: string;
  date: string;
  image: string;
}

function validateDataset(products: unknown): RawProduct[] {
  if (!Array.isArray(products)) {
    throw new Error("Dane wejściowe nie są tablicą!");
  }

  if (products.length !== 100) {
    throw new Error(`Oczekiwano dokładnie 100 produktów w pliku wejściowym, znaleziono: ${products.length}`);
  }

  const validTypes = new Set(["cpu", "gpu", "ram", "disk"]);
  const seenIds = new Set<number>();
  const seenCodes = new Set<string>();

  const validated: RawProduct[] = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i] as any;

    if (!Number.isInteger(p.id) || p.id < 1 || p.id > 2147483647) {
      throw new Error(`Produkt #${i}: niepoprawne ID (${p.id}). Wymagana liczba z zakresu 1-2147483647.`);
    }
    if (seenIds.has(p.id)) {
      throw new Error(`Produkt #${i}: zduplikowane ID (${p.id}).`);
    }
    seenIds.add(p.id);

    if (typeof p.code !== "string" || !/^[A-Z0-9]{10}$/.test(p.code)) {
      throw new Error(`Produkt #${i} (ID ${p.id}): niepoprawny kod '${p.code}'. Wymagane dokładnie 10 wielkich liter ASCII lub cyfr.`);
    }
    if (seenCodes.has(p.code)) {
      throw new Error(`Produkt #${i}: zduplikowany unikalny kod (${p.code}).`);
    }
    seenCodes.add(p.code);

    if (typeof p.name !== "string" || p.name.trim().length === 0) {
      throw new Error(`Produkt #${i} (ID ${p.id}): pusta nazwa produktu.`);
    }

    if (!validTypes.has(p.type)) {
      throw new Error(`Produkt #${i} (ID ${p.id}): nieznana kategoria '${p.type}'.`);
    }

    if (!Number.isInteger(p.price) || p.price < 0 || p.price > 2147483647) {
      throw new Error(`Produkt #${i} (ID ${p.id}): niepoprawna cena (${p.price}).`);
    }

    if (!Number.isInteger(p.amount) || p.amount < 0 || p.amount > 2147483647) {
      throw new Error(`Produkt #${i} (ID ${p.id}): niepoprawny stan magazynowy (${p.amount}).`);
    }

    if (typeof p.description !== "string") {
      throw new Error(`Produkt #${i} (ID ${p.id}): brak opisu.`);
    }

    if (isNaN(Date.parse(p.date))) {
      throw new Error(`Produkt #${i} (ID ${p.id}): niepoprawny format daty '${p.date}'.`);
    }

    if (typeof p.image !== "string" || p.image.length === 0) {
      throw new Error(`Produkt #${i} (ID ${p.id}): brak ścieżki do obrazka.`);
    }

    validated.push(p);
  }

  return validated;
}

async function main() {
  console.log("Rozpoczynanie procesu seedowania bazy danych...");

  const dataPath = path.resolve("./lib/data.json");
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Nie znaleziono pliku ${dataPath}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log("Walidacja 100 produktów z pliku wejściowego...");
  const validatedProducts = validateDataset(rawJson);
  console.log("Walidacja pliku zakończona pomyślnie.");

  const categories = [
    { code: "cpu", name: "Procesory" },
    { code: "gpu", name: "Karty Graficzne" },
    { code: "ram", name: "Pamięci RAM" },
    { code: "disk", name: "Dyski" },
  ];

  await prisma.$transaction(async (tx) => {
    // 1. Zapis 4 kategorii
    for (const cat of categories) {
      await tx.category.upsert({
        where: { code: cat.code },
        update: { name: cat.name },
        create: cat,
      });
    }

    // 2. Zapis 100 zwalidowanych produktów z obliczeniem nameSortKey wspólną funkcją
    for (const p of validatedProducts) {
      const sortKey = generateNameSortKey(p.name);
      await tx.product.upsert({
        where: { id: p.id },
        update: {
          code: p.code,
          name: p.name,
          description: p.description,
          image: p.image,
          price: p.price,
          amount: p.amount,
          date: new Date(p.date),
          categoryId: p.type,
          nameSortKey: sortKey,
        },
        create: {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description,
          image: p.image,
          price: p.price,
          amount: p.amount,
          date: new Date(p.date),
          categoryId: p.type,
          nameSortKey: sortKey,
        },
      });
    }

    // 3. Fikcyjne konta użytkowników
    const adminUser = await tx.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        id: "usr-admin-1",
        name: "Administrator",
        email: "admin@example.com",
        emailVerified: true,
      },
    });

    const regularUser = await tx.user.upsert({
      where: { email: "jan.kowalski@example.com" },
      update: {},
      create: {
        id: "usr-regular-2",
        name: "Jan Kowalski",
        email: "jan.kowalski@example.com",
        emailVerified: true,
      },
    });

    // 4. Cztery deterministyczne zamówienia ze snapshotem cen i kodów
    const deterministicOrders = [
      {
        number: "ORD-2026-0001",
        status: "COMPLETED",
        userId: adminUser.id,
        totalAmount: 141556,
        items: [
          {
            productId: 1,
            productName: "Produkt GPU Model 1",
            productCode: "MHJHZAALYI",
            quantity: 1,
            unitPrice: 141556,
          },
        ],
      },
      {
        number: "ORD-2026-0002",
        status: "COMPLETED",
        userId: adminUser.id,
        totalAmount: 400208,
        items: [
          {
            productId: 2,
            productName: "Produkt CPU Model 2",
            productCode: "OR9LMG3JVK",
            quantity: 2,
            unitPrice: 200104,
          },
        ],
      },
      {
        number: "ORD-2026-0003",
        status: "COMPLETED",
        userId: regularUser.id,
        totalAmount: 341660,
        items: [
          {
            productId: 1,
            productName: "Produkt GPU Model 1",
            productCode: "MHJHZAALYI",
            quantity: 1,
            unitPrice: 141556,
          },
          {
            productId: 2,
            productName: "Produkt CPU Model 2",
            productCode: "OR9LMG3JVK",
            quantity: 1,
            unitPrice: 200104,
          },
        ],
      },
      {
        number: "ORD-2026-0004",
        status: "NEW",
        userId: regularUser.id,
        totalAmount: 200104,
        items: [
          {
            productId: 2,
            productName: "Produkt CPU Model 2",
            productCode: "OR9LMG3JVK",
            quantity: 1,
            unitPrice: 200104,
          },
        ],
      },
    ];

    for (const ord of deterministicOrders) {
      await tx.order.upsert({
        where: { number: ord.number },
        update: {
          status: ord.status,
          totalAmount: ord.totalAmount,
        },
        create: {
          number: ord.number,
          status: ord.status,
          userId: ord.userId,
          totalAmount: ord.totalAmount,
          items: {
            create: ord.items,
          },
        },
      });
    }
  }, { maxWait: 20000, timeout: 90000 });

  console.log("Seedowanie zakończone pomyślnie (4 kategorie, 100 produktów, 2 użytkowników, 4 deterministyczne zamówienia).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Błąd podczas seedowania:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
