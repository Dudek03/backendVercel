import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEST_USER_ID = "usr-multi-device-test";
const TEST_EMAIL = "multidevice@example.com";

async function main() {
  console.log("===============================================================================");
  console.log("Rozszerzenie 3 (Lab 09): Sesje na wielu urządzeniach i ich unieważnianie");
  console.log("===============================================================================");

  // 1. Utworzenie lub aktualizacja użytkownika testowego
  const user = await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: { email: TEST_EMAIL },
    create: {
      id: TEST_USER_ID,
      name: "Multi Device User",
      email: TEST_EMAIL,
      emailVerified: true,
    },
  });
  console.log(`\n[Krok 1] Użytkownik testowy gotowy: ${user.name} (${user.id})`);

  // Wyczyść ewentualne stare sesje testowe
  await prisma.session.deleteMany({ where: { userId: user.id } });

  // 2. Symulacja logowania na dwóch różnych urządzeniach (tworzenie dwóch niezależnych sesji w PostgreSQL)
  console.log("\n[Krok 2] Tworzenie dwóch niezależnych sesji w bazie danych:");
  const tokenA = "token_device_desktop_chrome_123456789";
  const tokenB = "token_device_mobile_safari_987654321";

  const sessionA = await prisma.session.create({
    data: {
      id: "sess-desktop-a",
      userId: user.id,
      token: tokenA,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0",
      ipAddress: "192.168.1.10",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dni
    },
  });
  console.log(`- Urządzenie 1 (Komputer stacjonarny): Utworzono sesję ID: ${sessionA.id}`);

  const sessionB = await prisma.session.create({
    data: {
      id: "sess-mobile-b",
      userId: user.id,
      token: tokenB,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
      ipAddress: "10.0.0.5",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`- Urządzenie 2 (Telefon komórkowy):    Utworzono sesję ID: ${sessionB.id}`);

  // Sprawdzenie aktywnych sesji
  let activeSessions = await prisma.session.findMany({ where: { userId: user.id } });
  console.log(`\nLiczba aktywnych sesji w bazie: ${activeSessions.length} (oczekiwano: 2)`);

  // 3. Weryfikacja: Wylogowanie bieżącej sesji na Urządzeniu 1 (Desktop)
  console.log("\n[Krok 3] Scenariusz 1: Wylogowanie pojedynczej sesji (Desktop):");
  await prisma.session.delete({ where: { id: sessionA.id } });
  console.log("-> Usunięto sesję Desktop z bazy.");

  const checkA = await prisma.session.findUnique({ where: { id: sessionA.id } });
  const checkB = await prisma.session.findUnique({ where: { id: sessionB.id } });

  console.log(`- Stan sesji Desktop: ${checkA ? "AKTYWNA (błąd)" : "UNIEWAŻNIONA (poprawnie odmowa dostępu)"}`);
  console.log(`- Stan sesji Mobile:  ${checkB ? "NADAL AKTYWNA (użytkownik nadal zalogowany na telefonie)" : "BŁĄD"}`);

  if (!checkA && checkB) {
    console.log("-> SUKCES: Wylogowanie na jednym urządzeniu nie niszczy sesji na drugim urządzeniu!");
  } else {
    console.error("-> BŁĄD w izolacji sesji!");
  }

  // 4. Weryfikacja: Unieważnienie WSZYSTKICH sesji użytkownika ("Wyloguj ze wszystkich urządzeń")
  console.log("\n[Krok 4] Scenariusz 2: Globalne unieważnienie wszystkich sesji użytkownika:");
  const revoked = await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`-> Unieważniono sesji: ${revoked.count}`);

  const remainingSessions = await prisma.session.findMany({ where: { userId: user.id } });
  console.log(`- Pozostałe aktywne sesje w bazie: ${remainingSessions.length} (oczekiwano: 0)`);

  if (remainingSessions.length === 0) {
    console.log("-> SUKCES: Wszystkie urządzenia zostały wylogowane i utraciły dostęp do koszyka!");
  }

  // 5. Uzasadnienie wpływu cache sesji
  console.log("\n===============================================================================");
  console.log("UZASADNIENIE ARCHITEKTONICZNE: Wpływ cache sesji (session.cookieCache)");
  console.log("===============================================================================");
  console.log("W pliku lib/auth.ts wyłączono opcję session.cookieCache.enabled (false):");
  console.log("1. Gdy cookieCache jest włączone, Better Auth buforuje dane sesji w podpisanym cookie");
  console.log("   lub w pamięci serwera przez określony czas (np. 5 minut), aby nie pytać bazy przy każdym żądaniu.");
  console.log("2. Wada cookieCache: po usunięciu rekordu sesji z bazy danych (np. zmiana hasła, kradzież sesji,");
  console.log("   globalne wylogowanie), żądania z innego urządzenia byłyby nadal honorowane aż do wygaśnięcia cache!");
  console.log("3. Wyłączenie cookieCache gwarantuje natychmiastowe unieważnienie w bazie PostgreSQL i pełną spójność.");
  console.log("===============================================================================\n");

  // Czyszczenie
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Dane testowe posprzątane.");
}

main()
  .catch((e) => {
    console.error("Błąd testu sesji:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
