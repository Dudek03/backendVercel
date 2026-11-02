import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function updateProductStock(id: number, newAmount: number): Promise<{ success: boolean; message: string; updatedCount: number }> {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new Error(`Niepoprawne ID: ${id}. Wymagana liczba całkowita w zakresie 1-2147483647.`);
  }

  if (!Number.isInteger(newAmount)) {
    throw new Error(`Niepoprawny stan magazynowy: ${newAmount}. Wymagana liczba całkowita.`);
  }

  // Weryfikacja istnienia produktu przed próbą aktualizacji
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Produkt o ID ${id} nie istnieje w bazie.`);
  }

  try {
    // Aktualizacja z wymaganiem dokładnie jednego zmodyfikowanego rekordu
    const result = await prisma.product.updateMany({
      where: { id },
      data: { amount: newAmount },
    });

    if (result.count !== 1) {
      throw new Error(`Oczekiwano dokładnie 1 zaktualizowanego rekordu, zaktualizowano: ${result.count}`);
    }

    return {
      success: true,
      message: `Poprawnie zaktualizowano stan produktu ${id} z ${existing.amount} na ${newAmount}.`,
      updatedCount: result.count,
    };
  } catch (error: any) {
    // Sprawdzenie czy błąd wynika z ograniczenia CHECK w bazie (product_amount_nonnegative)
    if (error?.message?.includes("product_amount_nonnegative") || error?.code === "23514") {
      return {
        success: false,
        message: `Baza danych odrzuciła ujemny stan magazynowy (CHECK constraint 'product_amount_nonnegative'): ${error.message}`,
        updatedCount: 0,
      };
    }
    throw error;
  }
}

async function verifyStockPersistence() {
  console.log("=== Weryfikacja kontrolowanej zmiany stanu magazynowego (Lab 08) ===");

  const targetId = 1;
  const initial = await prisma.product.findUnique({ where: { id: targetId } });
  if (!initial) {
    console.error(`Produkt o ID ${targetId} nie istnieje! Uruchom najpierw seed.`);
    process.exit(1);
  }

  console.log(`Stan początkowy produktu [ID: ${targetId}, Nazwa: "${initial.name}"]: ${initial.amount} szt.`);

  // Test 1: Próba zapisu wartości ujemnej (musi zostać odrzucona przez bazę)
  console.log("\n[Test 1] Próba zapisu wartości ujemnej (-5)...");
  const negativeAttempt = await updateProductStock(targetId, -5);
  if (!negativeAttempt.success) {
    console.log("-> SUKCES: Baza poprawnie odrzuciła wartość ujemną!");
    console.log(`   Komunikat bazy: ${negativeAttempt.message}`);
  } else {
    console.error("-> BŁĄD: Baza pozwoliła zapisać ujemny stan magazynowy!");
    process.exit(1);
  }

  // Weryfikacja, że stan nie uległ zmianie
  const afterNegative = await prisma.product.findUnique({ where: { id: targetId } });
  if (afterNegative?.amount !== initial.amount) {
    console.error("-> BŁĄD: Stan magazynowy został zmodyfikowany mimo błędu!");
    process.exit(1);
  }
  console.log(`-> Stan po odrzuconym zapisie pozostał niezmieniony: ${afterNegative?.amount} szt.`);

  // Test 2: Poprawna zmiana stanu na nową wartość (np. initial.amount + 10)
  const newAmount = initial.amount === 15 ? 20 : 15;
  console.log(`\n[Test 2] Zmiana stanu na poprawną wartość: ${newAmount} szt...`);
  const positiveAttempt = await updateProductStock(targetId, newAmount);
  console.log(`-> ${positiveAttempt.message}`);

  // Test 3: Weryfikacja odczytu z bazy
  const afterUpdate = await prisma.product.findUnique({ where: { id: targetId } });
  if (afterUpdate?.amount === newAmount) {
    console.log(`-> SUKCES: Nowy stan ${afterUpdate.amount} szt. jest trwale zapisany w bazie PostgreSQL.`);
  } else {
    console.error(`-> BŁĄD: Stan w bazie (${afterUpdate?.amount}) różni się od oczekiwanego (${newAmount})!`);
    process.exit(1);
  }

  console.log("\n=== Podsumowanie weryfikacji ===");
  console.log("1. Wartość ujemna odrzucona przez ograniczenie SQL CHECK (product_amount_nonnegative): TAK");
  console.log("2. Dokładnie 1 rekord zaktualizowany: TAK");
  console.log(`3. Aktualny stan produktu ID ${targetId} wynosi teraz: ${afterUpdate?.amount} szt.`);
  console.log("Możesz teraz zrestartować aplikację/kontener i sprawdzić trwałość zapisu bez ponownego seeda.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length >= 2) {
    const id = parseInt(args[0], 10);
    const amount = parseInt(args[1], 10);

    console.log(`Modyfikacja stanu magazynowego produktu ID ${id} na ${amount}...`);
    try {
      const res = await updateProductStock(id, amount);
      console.log(res.message);
      if (!res.success) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error("Błąd aktualizacji:", err.message);
      process.exit(1);
    }
  } else {
    await verifyStockPersistence();
  }
}

main()
  .catch((e) => {
    console.error("Nieoczekiwany błąd:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
