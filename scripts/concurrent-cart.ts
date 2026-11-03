import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_USER_ID = "usr-cart-concurrency-test";
const TEST_PRODUCT_ID = 888888;

async function setupTestData() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: "Concurrency Tester",
      email: "concur_cart@example.com",
      emailVerified: true,
    },
  });

  await prisma.product.upsert({
    where: { id: TEST_PRODUCT_ID },
    update: {
      amount: 2, // 2 sztuki na magazynie
      price: 25000,
    },
    create: {
      id: TEST_PRODUCT_ID,
      code: "CARTCONC01",
      name: "Produkt Testowy Koszyka",
      description: "Test współbieżności operacji na koszyku",
      image: "/images/products/cpu.webp",
      price: 25000,
      amount: 2,
      date: new Date(),
      categoryId: "cpu",
      nameSortKey: "produkt testowy koszyka",
    },
  });

  // Wyczyść ewentualny stary koszyk
  const oldCart = await prisma.cart.findUnique({ where: { userId: TEST_USER_ID } });
  if (oldCart) {
    await prisma.cartItem.deleteMany({ where: { cartId: oldCart.id } });
  }
}

async function cleanupTestData() {
  const cart = await prisma.cart.findUnique({ where: { userId: TEST_USER_ID } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.delete({ where: { id: cart.id } });
  }
  await prisma.product.deleteMany({ where: { id: TEST_PRODUCT_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
}

// Atomowe dodanie do koszyka z obsługą konfliktu tworzenia koszyka/pozycji
async function addProductAtomic(userId: string, productId: number): Promise<{ success: boolean; message: string }> {
  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.amount <= 0) {
      return { success: false, message: "Brak towaru na magazynie." };
    }

    // Obsługa współbieżnego tworzenia koszyka
    let cart = await tx.cart.findUnique({ where: { userId } });
    if (!cart) {
      try {
        cart = await tx.cart.create({ data: { userId } });
      } catch (err: any) {
        if (err.code === "P2002") {
          cart = (await tx.cart.findUnique({ where: { userId } }))!;
        } else {
          throw err;
        }
      }
    }

    const existing = await tx.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existing) {
      if (existing.quantity >= product.amount || existing.quantity >= 99) {
        return { success: false, message: "Osiągnięto limit magazynowy lub koszyka." };
      }

      const updated = await tx.$executeRaw`
        UPDATE "CartItem"
        SET "quantity" = "quantity" + 1
        WHERE "id" = ${existing.id}
          AND "quantity" < 99
          AND "quantity" < ${product.amount}
      `;

      if (updated === 0) {
        return { success: false, message: "Konflikt stanu magazynowego." };
      }
      return { success: true, message: "Zwiększono ilość o 1." };
    } else {
      try {
        await tx.cartItem.create({
          data: { cartId: cart.id, productId, quantity: 1 },
        });
        return { success: true, message: "Utworzono pozycję w koszyku." };
      } catch (err: any) {
        if (err.code === "P2002") {
          const updated = await tx.$executeRaw`
            UPDATE "CartItem"
            SET "quantity" = "quantity" + 1
            WHERE "cartId" = ${cart.id} AND "productId" = ${productId}
              AND "quantity" < 99 AND "quantity" < ${product.amount}
          `;
          if (updated === 1) return { success: true, message: "Zwiększono ilość o 1 (po konflikcie unikalności)." };
        }
        throw err;
      }
    }
  });
}

async function setQuantityAtomic(userId: string, itemId: string, qty: number): Promise<{ success: boolean; message: string }> {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: true },
    });
    if (!item) return { success: false, message: "Pozycja nie istnieje." };
    if (qty > item.product.amount) return { success: false, message: "Przekroczono stan magazynowy." };

    try {
      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity: qty },
      });
      return { success: true, message: `Ustawiono ilość na ${qty}.` };
    } catch (err: any) {
      if (err.code === "P2025") {
        return { success: false, message: "Pozycja została usunięta w trakcie modyfikacji." };
      }
      throw err;
    }
  });
}

async function removeItemAtomic(userId: string, itemId: string): Promise<{ success: boolean; message: string }> {
  const deleted = await prisma.cartItem.deleteMany({
    where: { id: itemId, cart: { userId } },
  });
  return {
    success: deleted.count > 0,
    message: deleted.count > 0 ? "Usunięto pozycję." : "Pozycja nie istniała.",
  };
}

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 4 (Lab 09): Zapis współbieżny na koszyku i polityka konfliktów");
  console.log("===============================================================================");

  await setupTestData();

  // Test 1: Równoległe dodawanie do koszyka (2 żądania na 2 dostępne sztuki)
  console.log("\n[Test 1] Dwa równoległe wywołania addProductAtomic na 2 sztuki towaru...");
  const [addRes1, addRes2] = await Promise.all([
    addProductAtomic(TEST_USER_ID, TEST_PRODUCT_ID),
    addProductAtomic(TEST_USER_ID, TEST_PRODUCT_ID),
  ]);

  console.log(`- Wynik żądania 1: ${addRes1.message} (sukces: ${addRes1.success})`);
  console.log(`- Wynik żądania 2: ${addRes2.message} (sukces: ${addRes2.success})`);

  let cart = await prisma.cart.findUnique({
    where: { userId: TEST_USER_ID },
    include: { items: true },
  });
  console.log(`-> Stan koszyka po obu dodaniach: ${cart?.items[0]?.quantity} szt. (oczekiwano: 2)`);

  // Próba trzeciego dodania przy stanie magazynowym = 2 (musi zostać odrzucona!)
  console.log("\n[Test 1b] Próba dodania 3. sztuki przy stanie magazynowym = 2...");
  const addRes3 = await addProductAtomic(TEST_USER_ID, TEST_PRODUCT_ID);
  console.log(`-> Wynik 3. dodania: ${addRes3.message} (sukces: ${addRes3.success})`);

  // Test 2: Równoległe setQuantity / setQuantity
  console.log("\n[Test 2] Równoległe setQuantity(1) i setQuantity(2) z dwóch sesji...");
  const itemId = cart!.items[0].id;
  await Promise.all([
    setQuantityAtomic(TEST_USER_ID, itemId, 1),
    setQuantityAtomic(TEST_USER_ID, itemId, 2),
  ]);

  cart = await prisma.cart.findUnique({
    where: { userId: TEST_USER_ID },
    include: { items: true },
  });
  console.log(`-> Ostateczna ilość w koszyku: ${cart?.items[0]?.quantity} szt. (jedna ze spójnych wartości)`);

  // Test 3: Równoległe setQuantity i removeItem
  console.log("\n[Test 3] Równoległe setQuantity(2) i removeItem() w tym samym momencie...");
  const [setRes, removeRes] = await Promise.all([
    setQuantityAtomic(TEST_USER_ID, itemId, 2),
    removeItemAtomic(TEST_USER_ID, itemId),
  ]);

  console.log(`- Wynik setQuantity: ${setRes.message} (sukces: ${setRes.success})`);
  console.log(`- Wynik removeItem:  ${removeRes.message} (sukces: ${removeRes.success})`);

  cart = await prisma.cart.findUnique({
    where: { userId: TEST_USER_ID },
    include: { items: true },
  });
  console.log(`-> Liczba pozycji w koszyku po wyścigu: ${cart?.items.length ?? 0} pozycji.`);

  // Wyjaśnienie architektoniczne
  console.log("\n===============================================================================");
  console.log("UZASADNIENIE ARCHITEKTONICZNE: Dlaczego blokada przycisku w UI nie wystarcza?");
  console.log("===============================================================================");
  console.log("1. Wielosesyjność: Użytkownik może otworzyć koszyk w dwóch kartach tej samej przeglądarki");
  console.log("   lub na dwóch różnych urządzeniach (telefon + laptop). Blokada przycisku w karcie A");
  console.log("   nie blokuje interfejsu w karcie B.");
  console.log("2. Ominięcie UI: Żądania HTTP (Server Actions / fetch) mogą być wysłane bezpośrednio");
  console.log("   za pomocą skryptów, rozszerzeń przeglądarki lub narzędzi cURL/Postman.");
  console.log("3. Opóźnienia sieciowe i asynchroniczność: Pakiety mogą dotrzeć na serwer w odwrotnej kolejności.");
  console.log("Dlatego JEDYNYM skutecznym zabezpieczeniem spójności jest kontrola na poziomie bazy danych");
  console.log("(klauzule WHERE z warunkiem ilości, ograniczenia CHECK, unikalne indeksy i transakcje ACID).");
  console.log("===============================================================================\n");

  await cleanupTestData();
  console.log("Sprzątanie zakończone.");
}

main()
  .catch((e) => {
    console.error("Błąd testu współbieżności koszyka:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
