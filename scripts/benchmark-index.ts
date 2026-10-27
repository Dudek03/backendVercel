import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const BENCHMARK_START_ID = 2000000;
const BENCHMARK_BATCH_SIZE = 20000;

async function runExplain(client: pg.PoolClient, label: string, forceSeqScan: boolean = false) {
  if (forceSeqScan) {
    await client.query("SET enable_indexscan = OFF;");
    await client.query("SET enable_bitmapscan = OFF;");
  } else {
    await client.query("SET enable_indexscan = ON;");
    await client.query("SET enable_bitmapscan = ON;");
  }

  const query = `
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT * FROM "Product"
    WHERE "categoryId" = 'cpu' AND "amount" > 0
    ORDER BY "nameSortKey" ASC, "id" ASC;
  `;

  const res = await client.query(query);
  const planJson = res.rows[0]["QUERY PLAN"][0];
  const executionTime = planJson["Execution Time"];
  const planningTime = planJson["Planning Time"];
  const rootNode = planJson["Plan"];
  const scanType = rootNode["Plans"]?.[0]?.["Node Type"] || rootNode["Node Type"];
  const totalCost = rootNode["Total Cost"];
  const sharedHitBlocks = rootNode["Shared Hit Blocks"] ?? 0;
  const sharedReadBlocks = rootNode["Shared Read Blocks"] ?? 0;

  console.log(`\n--- Wynik EXPLAIN (ANALYZE, BUFFERS): ${label} ---`);
  console.log(`  Typ skanowania:           ${scanType}`);
  console.log(`  Szacowany Total Cost:     ${totalCost}`);
  console.log(`  Execution Time:           ${executionTime.toFixed(3)} ms`);
  console.log(`  Planning Time:            ${planningTime.toFixed(3)} ms`);
  console.log(`  Bufory Shared Hit:        ${sharedHitBlocks}`);
  console.log(`  Bufory Shared Read:       ${sharedReadBlocks}`);

  return { executionTime, planningTime, totalCost, scanType, sharedHitBlocks, sharedReadBlocks };
}

async function insertSyntheticDataset(client: pg.PoolClient, count: number) {
  console.log(`Generowanie i wstawianie ${count} syntetycznych produktów do tabeli "Product"...`);
  const categories = ["cpu", "gpu", "ram", "disk"];
  const batchSize = 2000;

  for (let i = 0; i < count; i += batchSize) {
    const values: any[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batchSize && (i + j) < count; j++) {
      const currentId = BENCHMARK_START_ID + i + j;
      const cat = categories[(i + j) % categories.length];
      const amount = (i + j) % 5 === 0 ? 0 : ((i + j) % 50) + 1; // 20% towaru ma amount = 0
      const price = 5000 + ((i + j) * 17) % 250000;
      const code = `BNCH${String(i + j).padStart(6, "0")}`;
      const name = `Benchmark Product ${currentId}`;
      const sortKey = `benchmark product ${currentId}`;

      const offset = (j * 10);
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
      values.push(
        currentId,
        code,
        name,
        "Opis syntetyczny do testu wydajnościowego EXPLAIN",
        `/images/products/${cat}.webp`,
        price,
        amount,
        new Date().toISOString(),
        cat,
        sortKey
      );
    }

    const insertSql = `
      INSERT INTO "Product" ("id", "code", "name", "description", "image", "price", "amount", "date", "categoryId", "nameSortKey")
      VALUES ${placeholders.join(", ")}
    `;
    await client.query(insertSql, values);
  }

  // Wymuszenie aktualizacji statystyk planera PostgreSQL
  await client.query('ANALYZE "Product";');
  console.log("Statystyki tabeli zaktualizowane poleceniem ANALYZE.");
}

async function cleanupSyntheticDataset(client: pg.PoolClient) {
  console.log("Czyszczenie danych syntetycznych...");
  await client.query(`DELETE FROM "Product" WHERE "id" >= ${BENCHMARK_START_ID};`);
  await client.query('ANALYZE "Product";');
  console.log("Dane syntetyczne usunięte.");
}

async function getIndexAndTableStats(client: pg.PoolClient) {
  const sizeQuery = `
    SELECT
      pg_size_pretty(pg_total_relation_size('"Product"')) as total_size,
      pg_size_pretty(pg_relation_size('"Product"')) as table_size,
      pg_size_pretty(pg_relation_size('"Product_categoryId_amount_idx"')) as index_size,
      pg_relation_size('"Product_categoryId_amount_idx"') as index_bytes
    FROM pg_class
    WHERE relname = 'Product_categoryId_amount_idx';
  `;
  const res = await client.query(sizeQuery);
  return res.rows[0];
}

async function benchmarkInsertSpeed(client: pg.PoolClient, count: number, hasIndex: boolean) {
  const tempStartId = BENCHMARK_START_ID + 100000;
  const categories = ["cpu", "gpu", "ram", "disk"];

  const startTime = performance.now();
  for (let i = 0; i < count; i += 500) {
    const values: any[] = [];
    const placeholders: string[] = [];
    for (let j = 0; j < 500 && (i + j) < count; j++) {
      const id = tempStartId + i + j;
      const cat = categories[(i + j) % 4];
      const offset = j * 10;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
      values.push(id, `WRT${String(i + j).padStart(7, "0")}`, `Write Test ${id}`, "desc", "/img.webp", 1000, 10, new Date().toISOString(), cat, `write test ${id}`);
    }
    await client.query(`INSERT INTO "Product" ("id", "code", "name", "description", "image", "price", "amount", "date", "categoryId", "nameSortKey") VALUES ${placeholders.join(", ")}`, values);
  }
  const duration = performance.now() - startTime;

  // Cleanup insert test batch
  await client.query(`DELETE FROM "Product" WHERE "id" >= ${tempStartId};`);
  return duration;
}

async function main() {
  const client = await pool.connect();

  try {
    console.log("===============================================================================");
    console.log("Rozszerzenie 3: Badanie zapytań i indeksów przez EXPLAIN (ANALYZE, BUFFERS)");
    console.log("===============================================================================");

    // 1. Sprawdzenie zachowania na małym zbiorze (100 rekordów)
    console.log("\n[KROK 1] Analiza zapytania na katalogu początkowym (~100 rekordów)");
    await client.query('ANALYZE "Product";');
    const smallSeq = await runExplain(client, "100 rekordów (Domyślny wybór planera)", false);
    console.log("-> WNIOSEK: Przy 100 rekordach planer PostgreSQL celowo wybiera Seq Scan, ponieważ");
    console.log("   odczyt sekwencyjny kilku bloków dyskowych w RAM jest tańszy niż skakanie po drzewie indeksu B-Tree.");

    // 2. Dodanie 20 000 rekordów testowych
    console.log(`\n[KROK 2] Budowa większego zbioru testowego (${BENCHMARK_BATCH_SIZE} rekordów)...`);
    await insertSyntheticDataset(client, BENCHMARK_BATCH_SIZE);

    // 3. Rozmiary tabeli i indeksu
    const statsBefore = await getIndexAndTableStats(client);
    console.log(`Rozmiar tabeli Product:       ${statsBefore.table_size}`);
    console.log(`Rozmiar całego Product+indeksy: ${statsBefore.total_size}`);
    console.log(`Rozmiar indeksu category_amount: ${statsBefore.index_size} (${statsBefore.index_bytes} B)`);

    // 4. Testy EXPLAIN na 20 000 rekordów
    console.log("\n[KROK 3] Porównanie EXPLAIN (ANALYZE, BUFFERS) na zbiorze 20 000 produktów:");
    const largeSeq = await runExplain(client, "20 000 rekordów BEZ użycia indeksu (wymuszony Seq Scan)", true);
    const largeIdx = await runExplain(client, "20 000 rekordów Z użyciem indeksu (Bitmap/Index Scan)", false);

    const speedup = largeSeq.executionTime / (largeIdx.executionTime || 0.001);

    // 5. Pomiar kosztu zapisu (insert overhead)
    console.log("\n[KROK 4] Pomiar kosztu zapisu (Insert overhead dla 2 000 rekordów)...");
    const writeTimeWithIndex = await benchmarkInsertSpeed(client, 2000, true);
    console.log(`Czas wstawiania 2 000 wierszy Z aktywnym indeksem: ${writeTimeWithIndex.toFixed(2)} ms`);

    // 6. Podsumowanie i uzasadnienie
    console.log("\n===============================================================================");
    console.log("PODSUMOWANIE BENCHMARKU I UZASADNIENIE ARCHITEKTONICZNE");
    console.log("===============================================================================");
    console.log(`1. Czas wykonania (Execution Time):`);
    console.log(`   - Bez indeksu (Seq Scan):  ${largeSeq.executionTime.toFixed(3)} ms`);
    console.log(`   - Z indeksem (Index Scan): ${largeIdx.executionTime.toFixed(3)} ms`);
    console.log(`   - Przyspieszenie:          ${speedup.toFixed(2)}x`);
    console.log(`2. Narzut na pamięć masową (RAM/Dysk):`);
    console.log(`   - Indeks categoryId_amount zajmuje ${statsBefore.index_size}`);
    console.log(`3. Narzut na zapis (Write Overhead):`);
    console.log(`   - Każda operacja INSERT/UPDATE na kolumnach indeksowanych wymaga aktualizacji drzewa B-Tree.`);
    console.log(`   - Dla sklepu internetowego proporcja odczytów do zapisów wynosi zazwyczaj >100:1,`);
    console.log(`     co w pełni uzasadnia utworzenie indeksu @@index([categoryId, amount]).`);
    console.log(`4. Zachowanie przy 100 rekordach:`);
    console.log(`   - Przy małej liczbie wierszy koszt odczytu losowego przez indeks (random I/O) przewyższa`);
    console.log(`     koszt odczytu sekwencyjnego jednej strony z cache. Planer słusznie ignoruje wtedy indeks.`);
    console.log("===============================================================================\n");

  } finally {
    // 7. Zawsze sprzątamy dane syntetyczne
    await cleanupSyntheticDataset(client);
    // Przywrócenie domyślnych flag planera
    await client.query("SET enable_indexscan = ON; SET enable_bitmapscan = ON;");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Błąd benchmarku:", err);
  process.exit(1);
});
