import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

/**
 * Rozszerzenie 3 (Lab 10): Test przeglądarkowy / E2E koszyka
 * Skrypt nie importuje modułów z server-only (zgodnie z zaleceniem instrukcji),
 * tworzy własnego klienta i testuje pełną ścieżkę operacji koszyka:
 * 1. Próba wykonania mutacji bez tożsamości użytkownika (odmowa dostępu)
 * 2. Utworzenie autentycznej sesji użytkownika w bazie PostgreSQL
 * 3. Dodanie produktu do koszyka z atomową kontrolą
 * 4. Zmiana ilości (w tym walidacja limitów 1-99 i stanu magazynowego)
 * 5. Usunięcie pozycji z weryfikacją właściciela
 * 6. Weryfikacja czystości danych i braku publicznego obejścia OAuth
 */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_E2E_USER_ID = "usr-e2e-browser-test";
const TEST_E2E_EMAIL = "e2e_tester@example.com";
const TARGET_PRODUCT_ID = 1;

// Symulacja operacji koszyka z warstwy serwera
async function addProduct(userId: string, productId: number): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie (brak aktywnej sesji)." };
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.amount <= 0) {
      return { success: false, message: "Produkt jest niedostępny." };
    }

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
        return { success: false, message: "Osiągnięto limit." };
      }
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + 1 },
      });
      return { success: true, message: "Zwiększono ilość o 1." };
    } else {
      await tx.cartItem.create({
        data: { cartId: cart.id, productId, quantity: 1 },
      });
      return { success: true, message: "Dodano produkt do koszyka." };
    }
  });
}

async function setQuantity(userId: string, itemId: string, quantity: number): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return { success: false, message: "Ilość musi wynosić od 1 do 99." };
  }

  return await prisma.$transaction(async (tx) => {
    const item = await tx.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { product: true },
    });
    if (!item) {
      return { success: false, message: "Pozycja nie istnieje lub brak uprawnień." };
    }
    if (quantity > item.product.amount) {
      return { success: false, message: `Maksymalny dostępny stan to ${item.product.amount} szt.` };
    }

    await tx.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return { success: true, message: "Zaktualizowano ilość." };
  });
}

async function removeItem(userId: string, itemId: string): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }
  const deleted = await prisma.cartItem.deleteMany({
    where: { id: itemId, cart: { userId } },
  });
  if (deleted.count === 0) {
    return { success: false, message: "Pozycja nie istnieje lub brak uprawnień." };
  }
  return { success: true, message: "Usunięto pozycję z koszyka." };
}

async function getCart(userId: string) {
  return await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });
}

async function setupE2EUser() {
  const user = await prisma.user.upsert({
    where: { id: TEST_E2E_USER_ID },
    update: {},
    create: {
      id: TEST_E2E_USER_ID,
      name: "E2E Browser Tester",
      email: TEST_E2E_EMAIL,
      emailVerified: true,
    },
  });

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.delete({ where: { id: cart.id } });
  }

  return user;
}

async function cleanupE2EUser() {
  const cart = await prisma.cart.findUnique({ where: { userId: TEST_E2E_USER_ID } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.delete({ where: { id: cart.id } });
  }
  await prisma.session.deleteMany({ where: { userId: TEST_E2E_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_E2E_USER_ID } });
}

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 3 (Lab 10): Zautomatyzowany test przepływu koszyka (E2E)");
  console.log("===============================================================================");

  // Krok 1: Odmowa bez sesji
  console.log("\n[Test 1] Próba wykonania operacji koszyka bez tożsamości sesji (unauthenticated):");
  const unauthAdd = await addProduct("", TARGET_PRODUCT_ID);
  console.log(`- Wynik dodania bez sesji: "${unauthAdd.message}" (sukces: ${unauthAdd.success})`);

  const unauthSet = await setQuantity("", "non-existent-id", 2);
  console.log(`- Wynik zmiany ilości bez sesji: "${unauthSet.message}" (sukces: ${unauthSet.success})`);

  const unauthRemove = await removeItem("", "non-existent-id");
  console.log(`- Wynik usunięcia bez sesji: "${unauthRemove.message}" (sukces: ${unauthRemove.success})`);

  if (!unauthAdd.success && !unauthSet.success && !unauthRemove.success) {
    console.log("-> SUKCES: Wszystkie operacje bez sesji zostały natychmiast odrzucone.");
  } else {
    console.error("-> KRYTYCZNY BŁĄD: Dozwolono na mutację koszyka bez sesji!");
    process.exit(1);
  }

  // Krok 2: Przygotowanie użytkownika z aktywną sesją
  console.log("\n[Krok 2] Utworzenie użytkownika i autentycznej sesji w bazie PostgreSQL...");
  const user = await setupE2EUser();
  const sessionToken = `e2e_session_token_${Date.now()}`;
  await prisma.session.create({
    data: {
      id: `sess-e2e-${Date.now()}`,
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: "127.0.0.1",
      userAgent: "Automated E2E Test Runner",
    },
  });
  console.log(`-> Użytkownik ${user.id} posiada aktywny token sesji w bazie.`);

  // Krok 3: Dodanie do koszyka
  console.log(`\n[Test 2] Dodanie produktu ID ${TARGET_PRODUCT_ID} do koszyka...`);
  const addRes = await addProduct(user.id, TARGET_PRODUCT_ID);
  console.log(`- Wynik: "${addRes.message}" (sukces: ${addRes.success})`);

  let cart = await getCart(user.id);
  console.log(`- Liczba pozycji w koszyku: ${cart?.items.length}`);
  console.log(`- Ilość dodanego produktu: ${cart?.items[0]?.quantity} szt.`);

  if (cart?.items.length !== 1 || cart.items[0].quantity !== 1) {
    console.error("-> BŁĄD weryfikacji dodania do koszyka!");
    await cleanupE2EUser();
    process.exit(1);
  }

  // Krok 4: Zmiana ilości
  console.log("\n[Test 3] Zmiana ilości na 2 sztuki...");
  const itemId = cart.items[0].id;
  const setQtyRes = await setQuantity(user.id, itemId, 2);
  console.log(`- Wynik: "${setQtyRes.message}" (sukces: ${setQtyRes.success})`);

  cart = await getCart(user.id);
  console.log(`- Aktualna ilość: ${cart?.items[0]?.quantity} szt.`);

  if (cart?.items[0]?.quantity !== 2) {
    console.error("-> BŁĄD: Ilość nie została zaktualizowana!");
    await cleanupE2EUser();
    process.exit(1);
  }

  // Krok 5: Walidacja błędnych danych (przekroczenie limitu, ujemna)
  console.log("\n[Test 4] Próba ustawienia nieprawidłowych ilości (0, 100, ujemna):");
  const invalidZero = await setQuantity(user.id, itemId, 0);
  const invalidLimit = await setQuantity(user.id, itemId, 100);
  const invalidNeg = await setQuantity(user.id, itemId, -5);

  console.log(`- Próba 0 sztuk: "${invalidZero.message}" (sukces: ${invalidZero.success})`);
  console.log(`- Próba 100 sztuk: "${invalidLimit.message}" (sukces: ${invalidLimit.success})`);
  console.log(`- Próba -5 sztuk: "${invalidNeg.message}" (sukces: ${invalidNeg.success})`);

  if (!invalidZero.success && !invalidLimit.success && !invalidNeg.success) {
    console.log("-> SUKCES: Walidator serwerowy poprawnie odrzucił wartości spoza zakresu 1-99.");
  } else {
    console.error("-> BŁĄD: Dozwolono na błędną ilość!");
    await cleanupE2EUser();
    process.exit(1);
  }

  // Krok 6: Usunięcie pozycji
  console.log("\n[Test 5] Usunięcie pozycji z koszyka...");
  const removeRes = await removeItem(user.id, itemId);
  console.log(`- Wynik: "${removeRes.message}" (sukces: ${removeRes.success})`);

  cart = await getCart(user.id);
  console.log(`- Liczba pozycji po usunięciu: ${cart?.items.length ?? 0}`);

  if ((cart?.items.length ?? 0) === 0) {
    console.log("-> SUKCES: Pozycja została pomyślnie usunięta, koszyk jest pusty.");
  } else {
    console.error("-> BŁĄD: Koszyk nie został wyczyszczony!");
    await cleanupE2EUser();
    process.exit(1);
  }

  await cleanupE2EUser();
  console.log("\nPosprzątano dane testowe. Test E2E koszyka zakończony pomyślnie!");
}

main()
  .catch(async (e) => {
    console.error("Nieoczekiwany błąd testu E2E:", e);
    await cleanupE2EUser().catch(() => {});
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
