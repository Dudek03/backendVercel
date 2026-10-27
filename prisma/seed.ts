import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const generateNameSortKey = (name: string) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

async function main() {
  const dataPath = path.resolve("./lib/data.json");
  const products = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const categories = [
    { code: "cpu", name: "Procesory" },
    { code: "gpu", name: "Karty Graficzne" },
    { code: "ram", name: "Pamięci RAM" },
    { code: "disk", name: "Dyski" },
  ];

  await prisma.$transaction(async (tx) => {
    for (const cat of categories) {
      await tx.category.upsert({
        where: { code: cat.code },
        update: { name: cat.name },
        create: cat,
      });
    }

    for (const p of products) {
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
          nameSortKey: generateNameSortKey(p.name),
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
          nameSortKey: generateNameSortKey(p.name),
        },
      });
    }

    const user = await tx.user.upsert({
      where: { email: "admin@example.com" },
      update: {},
      create: {
        id: "usr-1",
        name: "Admin",
        email: "admin@example.com",
        emailVerified: true,
      },
    });

    await tx.order.upsert({
      where: { number: "ORD-0001" },
      update: {},
      create: {
        number: "ORD-0001",
        status: "NEW",
        userId: user.id,
        items: {
          create: [
            {
              productId: 1,
              productName: "Test",
              productCode: "TST1",
              quantity: 1,
              unitPrice: 1000,
            },
          ],
        },
      },
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
