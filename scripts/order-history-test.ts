import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const USER_A_ID = "usr-order-test-a";
const USER_B_ID = "usr-order-test-b";
const TEST_PRODUCT_ID = 777777;

async function setupFixtures() {
  // 1. Dwa konta użytkowników
  await prisma.user.upsert({
    where: { id: USER_A_ID },
    update: {},
    create: {
      id: USER_A_ID,
      name: "Użytkownik A",
      email: "user_a_orders@example.com",
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { id: USER_B_ID },
    update: {},
    create: {
      id: USER_B_ID,
      name: "Użytkownik B",
      email: "user_b_orders@example.com",
      emailVerified: true,
    },
  });

  // 2. Produkt testowy
  await prisma.product.upsert({
    where: { id: TEST_PRODUCT_ID },
    update: {
      price: 15000, // 150 zł
      name: "Dysk SSD Snapshot 1TB",
    },
    create: {
      id: TEST_PRODUCT_ID,
      code: "SNAPSSD001",
      name: "Dysk SSD Snapshot 1TB",
      description: "Test snapshotu zamówienia",
      image: "/images/products/disk.webp",
      price: 15000,
      amount: 10,
      date: new Date(),
      categoryId: "disk",
      nameSortKey: "dysk ssd snapshot 1tb",
    },
  });

  // 3. Zamówienie dla Użytkownika B
  await prisma.order.deleteMany({ where: { userId: USER_B_ID } });
  const orderB = await prisma.order.create({
    data: {
      id: "ord-user-b-secret",
      number: "ORD-B-9999",
      status: "COMPLETED",
      userId: USER_B_ID,
      totalAmount: 15000,
      items: {
        create: [
          {
            productId: TEST_PRODUCT_ID,
            productName: "Dysk SSD Snapshot 1TB",
            productCode: "SNAPSSD001",
            quantity: 1,
            unitPrice: 15000,
          },
        ],
      },
    },
  });

  // 4. Zamówienie dla Użytkownika A
  await prisma.order.deleteMany({ where: { userId: USER_A_ID } });
  const orderA = await prisma.order.create({
    data: {
      id: "ord-user-a-public",
      number: "ORD-A-1111",
      status: "COMPLETED",
      userId: USER_A_ID,
      totalAmount: 15000,
      items: {
        create: [
          {
            productId: TEST_PRODUCT_ID,
            productName: "Dysk SSD Snapshot 1TB",
            productCode: "SNAPSSD001",
            quantity: 1,
            unitPrice: 15000,
          },
        ],
      },
    },
  });

  return { orderA, orderB };
}

async function cleanupFixtures() {
  await prisma.orderItem.deleteMany({
    where: { order: { userId: { in: [USER_A_ID, USER_B_ID] } } },
  });
  await prisma.order.deleteMany({
    where: { userId: { in: [USER_A_ID, USER_B_ID] } },
  });
  await prisma.product.deleteMany({ where: { id: TEST_PRODUCT_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A_ID, USER_B_ID] } } });
}

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 2 (Lab 09): Historia użytkownika, izolacja i niezmienność danych");
  console.log("===============================================================================");

  const { orderA, orderB } = await setupFixtures();
  console.log(`\n[Krok 1] Przygotowano fixture:`);
  console.log(`- Zamówienie A (ID: ${orderA.id}, właściciel: ${USER_A_ID})`);
  console.log(`- Zamówienie B (ID: ${orderB.id}, właściciel: ${USER_B_ID})`);

  // Test 1: Sprawdzenie podmiany ID - Użytkownik A próbuje odczytać zamówienie B
  console.log("\n[Test 1] Próba dostępu Użytkownika A do zamówienia Użytkownika B:");
  const attempt = await prisma.order.findFirst({
    where: {
      id: orderB.id,
      userId: USER_A_ID, // Weryfikacja tożsamości z sesji
    },
  });

  console.log(`- Wynik zapytania: ${attempt ? "WYCIEK DANYCH!" : "NULL (bezpieczna odmowa dostępu)"}`);
  if (!attempt) {
    console.log("-> SUKCES: Podmiana ID zamówienia na rekord innego użytkownika nie ujawnia danych.");
  } else {
    console.error("-> KRYTYCZNY BŁĄD AUTORYZACJI!");
    process.exit(1);
  }

  // Test 2: Niezmienność historii po zmianie ceny produktu w katalogu
  console.log("\n[Test 2] Drastyczna zmiana ceny produktu w sklepie (z 150 zł na 999 zł)...");
  await prisma.product.update({
    where: { id: TEST_PRODUCT_ID },
    data: { price: 99900 },
  });

  const verifiedOrderA = await prisma.order.findUnique({
    where: { id: orderA.id },
    include: { items: true },
  });

  console.log(`- Aktualna cena w tabeli Product: 999.00 zł`);
  console.log(`- Zachowana cena w OrderItem (snapshot): ${(verifiedOrderA!.items[0].unitPrice / 100).toFixed(2)} zł`);
  console.log(`- Zachowana suma zamówienia (totalAmount): ${(verifiedOrderA!.totalAmount / 100).toFixed(2)} zł`);

  if (verifiedOrderA!.items[0].unitPrice === 15000 && verifiedOrderA!.totalAmount === 15000) {
    console.log("-> SUKCES: Snapshot cen w zamówieniu jest całkowicie odporny na późniejsze zmiany cen w sklepie!");
  } else {
    console.error("-> BŁĄD: Cena w zamówieniu uległa mutacji!");
    process.exit(1);
  }

  // Test 3: Usunięcie produktu a relacja SetNull
  console.log("\n[Test 3] Usunięcie produktu z oferty sklepu (relacja SetNull)...");
  await prisma.product.delete({
    where: { id: TEST_PRODUCT_ID },
  });

  const orderAfterProductDelete = await prisma.order.findUnique({
    where: { id: orderA.id },
    include: { items: true },
  });

  console.log(`- Liczba pozycji zamówienia: ${orderAfterProductDelete!.items.length}`);
  console.log(`- productId pozycji:        ${orderAfterProductDelete!.items[0].productId} (oczekiwano: null)`);
  console.log(`- productName pozycji:      "${orderAfterProductDelete!.items[0].productName}"`);
  console.log(`- productCode pozycji:      "${orderAfterProductDelete!.items[0].productCode}"`);

  if (
    orderAfterProductDelete!.items[0].productId === null &&
    orderAfterProductDelete!.items[0].productName === "Dysk SSD Snapshot 1TB"
  ) {
    console.log("-> SUKCES: Usunięcie produktu nie skasowało historii zamówień, zachowano snapshot nazwy i kodu!");
  } else {
    console.error("-> BŁĄD: Historia zamówień została uszkodzona po usunięciu produktu!");
    process.exit(1);
  }

  await cleanupFixtures();
  console.log("\nTest zakończony sukcesem.");
}

main()
  .catch((e) => {
    console.error("Błąd testu historii:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
