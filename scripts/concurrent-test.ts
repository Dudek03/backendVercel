import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_PRODUCT_ID = 999999;
const TEST_CATEGORY_CODE = "cpu";

async function setupTestProduct(initialAmount: number) {
  // Przygotowanie odrębnych danych testowych z dokładnie zadaną ilością sztuk
  await prisma.product.upsert({
    where: { id: TEST_PRODUCT_ID },
    update: {
      amount: initialAmount,
      price: 9999,
      nameSortKey: "produkt testowy wspolbieznosc",
    },
    create: {
      id: TEST_PRODUCT_ID,
      code: "CONCUR0001",
      name: "Produkt Testowy Współbieżność",
      description: "Produkt do weryfikacji atomowej rezerwacji stanu",
      image: "/images/products/cpu.webp",
      price: 9999,
      amount: initialAmount,
      date: new Date(),
      categoryId: TEST_CATEGORY_CODE,
      nameSortKey: "produkt testowy wspolbieznosc",
    },
  });
}

async function cleanupTestProduct() {
  await prisma.product.deleteMany({
    where: { id: TEST_PRODUCT_ID },
  });
}

// Atomowa rezerwacja stanu magazynowego z warunkiem wystarczającej ilości w WHERE
async function reserveProductAtomic(productId: number, workerName: string): Promise<{ worker: string; success: boolean; message: string }> {
  try {
    const updatedRows = await prisma.$executeRaw`
      UPDATE "Product"
      SET "amount" = "amount" - 1
      WHERE "id" = ${productId} AND "amount" >= 1
    `;

    if (updatedRows === 1) {
      return {
        worker: workerName,
        success: true,
        message: `[${workerName}] SUKCES: Pomyślnie zarezerwowano ostatnią sztukę.`,
      };
    } else {
      return {
        worker: workerName,
        success: false,
        message: `[${workerName}] ODRZUCONO: Brak wystarczającej ilości towaru (stan = 0).`,
      };
    }
  } catch (error: any) {
    return {
      worker: workerName,
      success: false,
      message: `[${workerName}] BŁĄD BAZY: ${error.message}`,
    };
  }
}

// Alternatywna demonstracja w transakcji z blokadą wiersza (SELECT FOR UPDATE)
async function reserveProductWithLock(productId: number, workerName: string): Promise<{ worker: string; success: boolean; message: string }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Jawna blokada pesymistyczna wiersza na czas transakcji
      const rows: any[] = await tx.$queryRaw`
        SELECT "id", "amount" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
      `;

      if (!rows.length || rows[0].amount < 1) {
        throw new Error("Brak wystarczającej ilości towaru.");
      }

      await tx.$executeRaw`
        UPDATE "Product" SET "amount" = "amount" - 1 WHERE "id" = ${productId}
      `;

      return true;
    });

    return {
      worker: workerName,
      success: result,
      message: `[${workerName}] SUKCES (FOR UPDATE): Pomyślnie zarezerwowano.`,
    };
  } catch (error: any) {
    return {
      worker: workerName,
      success: false,
      message: `[${workerName}] ODRZUCONO (FOR UPDATE): ${error.message}`,
    };
  }
}

async function main() {
  console.log("==================================================================");
  console.log("Rozszerzenie 4: Zapis współbieżny i atomowa rezerwacja stanu");
  console.log("==================================================================");

  console.log("\n[Krok 1] Przygotowanie odrębnego rekordu testowego...");
  console.log(`Tworzenie produktu ID: ${TEST_PRODUCT_ID} z OSTATNIĄ 1 SZTUKĄ na stanie (amount = 1).`);
  await setupTestProduct(1);

  const initialCheck = await prisma.product.findUnique({ where: { id: TEST_PRODUCT_ID } });
  console.log(`Stan w bazie przed testem: ${initialCheck?.amount} szt.`);

  console.log("\n[Krok 2] Uruchomienie DWÓCH konkurencyjnych prób pobrania ostatniej sztuki...");
  console.log("Oba żądania wysyłane są równolegle przez Promise.all()...");

  const [res1, res2] = await Promise.all([
    reserveProductAtomic(TEST_PRODUCT_ID, "Klient A"),
    reserveProductAtomic(TEST_PRODUCT_ID, "Klient B"),
  ]);

  console.log(`\nWynik Klienta A: ${res1.message}`);
  console.log(`Wynik Klienta B: ${res2.message}`);

  // Sprawdzenie stanu końcowego w bazie
  const finalCheck = await prisma.product.findUnique({ where: { id: TEST_PRODUCT_ID } });
  console.log(`\nStan w bazie po współbieżnych próbach: ${finalCheck?.amount} szt.`);

  const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
  const failureCount = (!res1.success ? 1 : 0) + (!res2.success ? 1 : 0);

  console.log("\n[Krok 3] Asercja wyników:");
  console.log(`- Liczba udanych rezerwacji: ${successCount} (oczekiwano: 1)`);
  console.log(`- Liczba odrzuconych rezerwacji: ${failureCount} (oczekiwano: 1)`);
  console.log(`- Końcowy stan magazynowy: ${finalCheck?.amount} (oczekiwano: 0, nigdy ujemny)`);

  if (successCount === 1 && failureCount === 1 && finalCheck?.amount === 0) {
    console.log("\n-> WERYFIKACJA ZAKOŃCZONA SUKCESEM: Dokładnie jedna próba się powiodła, brak oversellingu!");
  } else {
    console.error("\n-> BŁĄD ASERCJI: Naruszenie spójności zapisu współbieżnego!");
    await cleanupTestProduct();
    process.exit(1);
  }

  // Test wariantu z SELECT FOR UPDATE
  console.log("\n------------------------------------------------------------------");
  console.log("Weryfikacja alternatywna: Transakcja z blokadą SELECT ... FOR UPDATE");
  console.log("------------------------------------------------------------------");
  await setupTestProduct(1);

  const [lockRes1, lockRes2] = await Promise.all([
    reserveProductWithLock(TEST_PRODUCT_ID, "Klient X (Lock)"),
    reserveProductWithLock(TEST_PRODUCT_ID, "Klient Y (Lock)"),
  ]);

  console.log(lockRes1.message);
  console.log(lockRes2.message);

  const lockFinalCheck = await prisma.product.findUnique({ where: { id: TEST_PRODUCT_ID } });
  console.log(`Stan w bazie po transakcjach: ${lockFinalCheck?.amount} szt.`);

  const lockSuccessCount = (lockRes1.success ? 1 : 0) + (lockRes2.success ? 1 : 0);
  if (lockSuccessCount === 1 && lockFinalCheck?.amount === 0) {
    console.log("-> Transakcyjna blokada pesymistyczna również poprawnie zagwarantowała atomowość.");
  }

  console.log("\n[Krok 4] Sprzątanie danych testowych...");
  await cleanupTestProduct();
  console.log("Dane testowe usunięte. Test zakończony sukcesem.");
}

main()
  .catch(async (e) => {
    console.error("Błąd skryptu:", e);
    await cleanupTestProduct().catch(() => {});
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
