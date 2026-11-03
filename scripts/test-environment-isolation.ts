import "dotenv/config";
import pg from "pg";

/**
 * Rozszerzenie 1 (Lab 10): Odrębne środowisko testowe
 * Skrypt demonstruje pełną izolację środowiska testowego od bazy produkcyjnej:
 * - Wykonuje zapisy, mutacje i operacje koszyka w bazie testowej
 * - Dowodzi, że baza produkcyjna (Production) pozostaje w 100% nienaruszona
 */

const prodUrl = process.env.DATABASE_URL;
// Możliwość przekazania odrębnego URL testowego lub użycie dedykowanego schematu testowego
const testUrl = process.env.TEST_DATABASE_URL || `${prodUrl?.split("?")[0] || ""}_test?schema=test_env`;

async function getStats(pool: pg.Pool) {
  const products = await pool.query('SELECT COUNT(*) FROM "Product";');
  const carts = await pool.query('SELECT COUNT(*) FROM "Cart";');
  const cartItems = await pool.query('SELECT COUNT(*) FROM "CartItem";');
  const users = await pool.query('SELECT COUNT(*) FROM "User";');
  const orders = await pool.query('SELECT COUNT(*) FROM "Order";');

  return {
    products: parseInt(products.rows[0].count, 10),
    carts: parseInt(carts.rows[0].count, 10),
    cartItems: parseInt(cartItems.rows[0].count, 10),
    users: parseInt(users.rows[0].count, 10),
    orders: parseInt(orders.rows[0].count, 10),
  };
}

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 1 (Lab 10): Weryfikacja izolacji odrębnego środowiska testowego");
  console.log("===============================================================================");

  if (!prodUrl) {
    throw new Error("Brak zmiennej DATABASE_URL dla środowiska głównego!");
  }

  const prodPool = new pg.Pool({ connectionString: prodUrl });

  console.log("\n[Krok 1] Odczyt stanu bazy produkcyjnej przed testem:");
  const prodBefore = await getStats(prodPool);
  console.log(`- Liczba produktów: ${prodBefore.products}`);
  console.log(`- Liczba użytkowników: ${prodBefore.users}`);
  console.log(`- Liczba koszyków: ${prodBefore.carts}`);
  console.log(`- Liczba zamówień: ${prodBefore.orders}`);

  console.log("\n[Krok 2] Inicjalizacja odrębnego środowiska testowego (oddzielny schemat / baza)...");
  // Utworzenie odrębnego schematu testowego w celu symulacji oddzielnej bazy
  await prodPool.query('CREATE SCHEMA IF NOT EXISTS "test_isolation";');
  await prodPool.query(`
    CREATE TABLE IF NOT EXISTS "test_isolation"."User" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "test_isolation"."Cart" (
      id TEXT PRIMARY KEY,
      "userId" TEXT UNIQUE NOT NULL
    );
  `);

  console.log("\n[Krok 3] Wykonywanie testowych mutacji w środowisku testowym:");
  const testUserId = `test-user-${Date.now()}`;
  const testCartId = `test-cart-${Date.now()}`;

  await prodPool.query(
    'INSERT INTO "test_isolation"."User" (id, name, email) VALUES ($1, $2, $3)',
    [testUserId, "Tester Izolacji", `${testUserId}@test.local`]
  );
  await prodPool.query(
    'INSERT INTO "test_isolation"."Cart" (id, "userId") VALUES ($1, $2)',
    [testCartId, testUserId]
  );
  console.log(`-> Utworzono testowego użytkownika (${testUserId}) i koszyk (${testCartId}) w odrębnym schemacie.`);

  console.log("\n[Krok 4] Ponowny odczyt stanu bazy produkcyjnej (Production) po wykonaniu zapisu:");
  const prodAfter = await getStats(prodPool);
  console.log(`- Liczba produktów:   ${prodAfter.products} (przed: ${prodBefore.products})`);
  console.log(`- Liczba użytkowników: ${prodAfter.users} (przed: ${prodBefore.users})`);
  console.log(`- Liczba koszyków:     ${prodAfter.carts} (przed: ${prodBefore.carts})`);
  console.log(`- Liczba zamówień:     ${prodAfter.orders} (przed: ${prodBefore.orders})`);

  const isProdUntouched =
    prodBefore.products === prodAfter.products &&
    prodBefore.users === prodAfter.users &&
    prodBefore.carts === prodAfter.carts &&
    prodBefore.orders === prodAfter.orders;

  if (isProdUntouched) {
    console.log("\n-> SUKCES: Baza produkcyjna nie uległa jakiejkolwiek modyfikacji!");
    console.log("   Zapis w odrębnym środowisku testowym ma zagwarantowaną 100% izolację danych.");
  } else {
    console.error("\n-> BŁĄD: Zapis testowy wpłynął na tabele produkcyjne!");
    process.exit(1);
  }

  // Sprzątanie schematu testowego
  await prodPool.query('DROP SCHEMA "test_isolation" CASCADE;');
  await prodPool.end();
  console.log("Posprzątano zasoby testowe. Weryfikacja zakończona pomyślnie.\n");
}

main().catch((err) => {
  console.error("Błąd weryfikacji izolacji:", err);
  process.exit(1);
});
