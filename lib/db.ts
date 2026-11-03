import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

// Wykrywanie czy połączenie wymaga TLS (zdalny PostgreSQL w chmurze)
const isRemoteDb =
  connectionString?.includes("sslmode=require") ||
  connectionString?.includes("supabase") ||
  connectionString?.includes("neon") ||
  connectionString?.includes("render") ||
  connectionString?.includes("aiven") ||
  (process.env.NODE_ENV === "production" && !connectionString?.includes("localhost") && !connectionString?.includes("127.0.0.1"));

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pool?: pg.Pool;
};

// Współdzielona pula połączeń w obrębie procesu instancji Node.js (Lab 10)
export const pool =
  globalForPrisma.pool ||
  new pg.Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 10 : 5, // Limit puli dopasowany do serverless
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isRemoteDb ? { rejectUnauthorized: true } : undefined, // Weryfikacja certyfikatu TLS w chmurze
  });

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
