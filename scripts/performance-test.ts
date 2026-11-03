import "dotenv/config";
import pg from "pg";

/**
 * Rozszerzenie 5 (Lab 10): Pomiar wydajności i zużycia puli połączeń
 * Mierzy:
 * 1. Cold start (pierwsze zapytanie: nawiązanie połączenia TLS/TCP, alokacja klienta w puli)
 * 2. Warm run (kolejne zapytania przy rozgrzanej puli połączeń)
 * 3. Współbieżność: 50 równoległych zapytań o katalog z filtrami i sortowaniem
 * 4. Metryki: p50, p95, p99, min, max, throughput (RPS) oraz stan puli (total, idle, waiting)
 */

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function singleQuery(cat: string): Promise<number> {
  const start = performance.now();
  await pool.query(
    `SELECT id, code, name, price, amount, "nameSortKey"
     FROM "Product"
     WHERE "categoryId" = $1 AND "amount" > 0
     ORDER BY "nameSortKey" ASC, id ASC
     LIMIT 20;`,
    [cat]
  );
  return performance.now() - start;
}

function calculatePercentiles(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  return { min, max, avg, p50, p90, p95, p99 };
}

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 5 (Lab 10): Benchmark wydajności i zużycia puli połączeń");
  console.log("===============================================================================");
  console.log(`Pula połączeń: max = 10, idleTimeout = 30s, connectionTimeout = 5s\n`);

  // 1. Pomiar Cold Start
  console.log("[Krok 1] Pomiar Cold Start (pierwsze zapytanie - handshake + inicjalizacja puli)...");
  const coldStartDuration = await singleQuery("cpu");
  console.log(`-> Czas Cold Start: ${coldStartDuration.toFixed(2)} ms`);
  console.log(`   Stan puli: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);

  // 2. Pomiar Warm Single Request
  console.log("\n[Krok 2] Pomiar Warm Start (drugie zapytanie na istniejącym połączeniu z puli)...");
  const warmStartDuration = await singleQuery("cpu");
  console.log(`-> Czas Warm Start: ${warmStartDuration.toFixed(2)} ms`);
  console.log(`   Przyspieszenie dzięki puli: ${(coldStartDuration / warmStartDuration).toFixed(1)}x szybciej!`);

  // 3. Test obciążeniowy: 50 współbieżnych zapytań
  const CONCURRENT_REQUESTS = 50;
  console.log(`\n[Krok 3] Test współbieżności: wysyłanie ${CONCURRENT_REQUESTS} równoległych zapytań (Promise.all)...`);
  const categories = ["cpu", "gpu", "ram", "disk"];

  const batchStart = performance.now();
  const promises: Promise<number>[] = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const cat = categories[i % categories.length];
    promises.push(singleQuery(cat));
  }

  const latencies = await Promise.all(promises);
  const totalBatchTime = performance.now() - batchStart;

  const stats = calculatePercentiles(latencies);
  const rps = (CONCURRENT_REQUESTS / (totalBatchTime / 1000)).toFixed(1);

  console.log(`\nStan puli w trakcie/po teście: total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount}`);

  console.log("\n===============================================================================");
  console.log("WYNIKI POMIARU WYDAJNOŚCI I METRYKI OPÓŹNIEŃ");
  console.log("===============================================================================");
  console.log(`- Liczba zapytań:            ${CONCURRENT_REQUESTS}`);
  console.log(`- Łączny czas wykonania:     ${totalBatchTime.toFixed(2)} ms`);
  console.log(`- Przepustowość (RPS):       ${rps} req/sec`);
  console.log(`- Najszybsze zapytanie (Min): ${stats.min.toFixed(2)} ms`);
  console.log(`- Najwolniejsze (Max):       ${stats.max.toFixed(2)} ms`);
  console.log(`- Średni czas (Average):     ${stats.avg.toFixed(2)} ms`);
  console.log(`- Mediana (p50):             ${stats.p50.toFixed(2)} ms`);
  console.log(`- Percentyl 90 (p90):        ${stats.p90.toFixed(2)} ms`);
  console.log(`- Percentyl 95 (p95):        ${stats.p95.toFixed(2)} ms`);
  console.log(`- Percentyl 99 (p99):        ${stats.p99.toFixed(2)} ms`);
  console.log("===============================================================================");
  console.log("WNIOSKI ARCHITEKTONICZNE:");
  console.log("1. Re-use połączeń TCP/TLS w ramach puli drastycznie redukuje narzut sieciowy.");
  console.log("2. Ograniczenie puli (max: 10) zapobiega wyczerpaniu limitu połączeń w chmurze (np. Neon/Supabase),");
  console.log("   a kolejkowanie (waitingCount) zabezpiecza bazę przed awarią przy nagłych skokach ruchu.");
  console.log("===============================================================================\n");

  await pool.end();
}

main().catch((err) => {
  console.error("Błąd pomiaru wydajności:", err);
  process.exit(1);
});
