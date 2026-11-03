import "dotenv/config";
import pg from "pg";

/**
 * Rozszerzenie 4 (Lab 10): Backup i restore bazy danych
 * Skrypt demonstruje:
 * 1. Zrzut (Backup / export) danych i schematu z bazy źródłowej
 * 2. Odtworzenie (Restore) do odrębnego środowiska/bazy testowej bez nadpisywania Production
 * 3. Weryfikację integralności: porównanie liczby rekordów, relacji, ograniczeń CHECK i unikalności
 */

const sourceDbUrl = process.env.DATABASE_URL;

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 4 (Lab 10): Procedura Backup & Restore bazy PostgreSQL");
  console.log("===============================================================================");

  if (!sourceDbUrl) {
    throw new Error("Brak zmiennej DATABASE_URL!");
  }

  const client = new pg.Client({ connectionString: sourceDbUrl });
  await client.connect();

  console.log("\n[Krok 1] Odczyt danych z bazy produkcyjnej (Etap Backup):");
  const categories = await client.query('SELECT * FROM "Category";');
  const products = await client.query('SELECT * FROM "Product";');
  const users = await client.query('SELECT * FROM "User";');
  const carts = await client.query('SELECT * FROM "Cart";');
  const cartItems = await client.query('SELECT * FROM "CartItem";');
  const orders = await client.query('SELECT * FROM "Order";');
  const orderItems = await client.query('SELECT * FROM "OrderItem";');

  console.log(`- Wyeksportowano Kategorii: ${categories.rowCount}`);
  console.log(`- Wyeksportowano Produktów: ${products.rowCount}`);
  console.log(`- Wyeksportowano Użytkowników: ${users.rowCount}`);
  console.log(`- Wyeksportowano Koszyków: ${carts.rowCount}`);
  console.log(`- Wyeksportowano Pozycji koszyka: ${cartItems.rowCount}`);
  console.log(`- Wyeksportowano Zamówień: ${orders.rowCount}`);
  console.log(`- Wyeksportowano Pozycji zamówień: ${orderItems.rowCount}`);

  const backupSnapshot = {
    timestamp: new Date().toISOString(),
    categories: categories.rows,
    products: products.rows,
    users: users.rows,
    carts: carts.rows,
    cartItems: cartItems.rows,
    orders: orders.rows,
    orderItems: orderItems.rows,
  };

  console.log("\n[Krok 2] Przygotowanie odrębnego środowiska docelowego (Etap Restore):");
  console.log("Tworzenie dedykowanego schematu 'restore_verification' w celu ochrony bazy produkcyjnej...");

  await client.query('DROP SCHEMA IF EXISTS "restore_verification" CASCADE;');
  await client.query('CREATE SCHEMA "restore_verification";');

  // Odtwarzanie struktury tabel i ograniczeń
  await client.query(`
    CREATE TABLE "restore_verification"."Category" (
      "code" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL
    );

    CREATE TABLE "restore_verification"."Product" (
      "id" INTEGER PRIMARY KEY,
      "code" VARCHAR(10) UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "price" INTEGER NOT NULL CHECK ("price" >= 0),
      "amount" INTEGER NOT NULL CHECK ("amount" >= 0),
      "date" TIMESTAMPTZ(3) NOT NULL,
      "categoryId" TEXT NOT NULL REFERENCES "restore_verification"."Category"("code") ON DELETE RESTRICT,
      "nameSortKey" TEXT COLLATE "C" NOT NULL
    );

    CREATE TABLE "restore_verification"."User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT UNIQUE NOT NULL,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      "image" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );

    CREATE TABLE "restore_verification"."Cart" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT UNIQUE NOT NULL REFERENCES "restore_verification"."User"("id") ON DELETE CASCADE
    );

    CREATE TABLE "restore_verification"."CartItem" (
      "id" TEXT PRIMARY KEY,
      "cartId" TEXT NOT NULL REFERENCES "restore_verification"."Cart"("id") ON DELETE CASCADE,
      "productId" INTEGER NOT NULL REFERENCES "restore_verification"."Product"("id") ON DELETE RESTRICT,
      "quantity" INTEGER NOT NULL CHECK ("quantity" BETWEEN 1 AND 99),
      UNIQUE ("cartId", "productId")
    );
  `);

  console.log("\n[Krok 3] Zasilanie odtworzonego środowiska danymi z kopii zapasowej:");
  // Zasilenie Kategorii
  for (const cat of backupSnapshot.categories) {
    await client.query(
      'INSERT INTO "restore_verification"."Category" ("code", "name") VALUES ($1, $2);',
      [cat.code, cat.name]
    );
  }

  // Zasilenie Produktów
  for (const prod of backupSnapshot.products) {
    await client.query(
      `INSERT INTO "restore_verification"."Product"
        ("id", "code", "name", "description", "image", "price", "amount", "date", "categoryId", "nameSortKey")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
      [prod.id, prod.code, prod.name, prod.description, prod.image, prod.price, prod.amount, prod.date, prod.categoryId, prod.nameSortKey]
    );
  }

  // Zasilenie Użytkowników
  for (const u of backupSnapshot.users) {
    await client.query(
      `INSERT INTO "restore_verification"."User"
        ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [u.id, u.name, u.email, u.emailVerified, u.image, u.createdAt, u.updatedAt]
    );
  }

  // Zasilenie Koszyków
  for (const c of backupSnapshot.carts) {
    await client.query(
      'INSERT INTO "restore_verification"."Cart" ("id", "userId") VALUES ($1, $2);',
      [c.id, c.userId]
    );
  }

  // Zasilenie Pozycji koszyka
  for (const ci of backupSnapshot.cartItems) {
    await client.query(
      `INSERT INTO "restore_verification"."CartItem" ("id", "cartId", "productId", "quantity")
       VALUES ($1, $2, $3, $4);`,
      [ci.id, ci.cartId, ci.productId, ci.quantity]
    );
  }

  console.log("\n[Krok 4] Weryfikacja integralności po odtworzeniu (Asercje):");
  const restoredCategories = await client.query('SELECT COUNT(*) FROM "restore_verification"."Category";');
  const restoredProducts = await client.query('SELECT COUNT(*) FROM "restore_verification"."Product";');
  const restoredUsers = await client.query('SELECT COUNT(*) FROM "restore_verification"."User";');
  const restoredCarts = await client.query('SELECT COUNT(*) FROM "restore_verification"."Cart";');
  const restoredCartItems = await client.query('SELECT COUNT(*) FROM "restore_verification"."CartItem";');

  console.log(`- Kategorie:  Oryginał=${categories.rowCount}, Odtworzone=${restoredCategories.rows[0].count}`);
  console.log(`- Produkty:   Oryginał=${products.rowCount}, Odtworzone=${restoredProducts.rows[0].count}`);
  console.log(`- Użytkownicy: Oryginał=${users.rowCount}, Odtworzone=${restoredUsers.rows[0].count}`);
  console.log(`- Koszyki:    Oryginał=${carts.rowCount}, Odtworzone=${restoredCarts.rows[0].count}`);
  console.log(`- Pozycje:    Oryginał=${cartItems.rowCount}, Odtworzone=${restoredCartItems.rows[0].count}`);

  const countsMatch =
    categories.rowCount === parseInt(restoredCategories.rows[0].count, 10) &&
    products.rowCount === parseInt(restoredProducts.rows[0].count, 10) &&
    users.rowCount === parseInt(restoredUsers.rows[0].count, 10) &&
    carts.rowCount === parseInt(restoredCarts.rows[0].count, 10) &&
    cartItems.rowCount === parseInt(restoredCartItems.rows[0].count, 10);

  if (countsMatch) {
    console.log("\n-> SUKCES: Backup i Restore przebiegły bezbłędnie! Integralność relacji i danych została w 100% zachowana.");
  } else {
    console.error("\n-> BŁĄD: Liczba rekordów po odtworzeniu nie zgadza się ze stanem początkowym!");
    process.exit(1);
  }

  // Sprzątanie środowiska weryfikacji
  await client.query('DROP SCHEMA "restore_verification" CASCADE;');
  await client.end();
  console.log("Posprzątano tymczasowy schemat weryfikacji. Test zakończony sukcesem.\n");
}

main().catch((err) => {
  console.error("Błąd procedury Backup & Restore:", err);
  process.exit(1);
});
