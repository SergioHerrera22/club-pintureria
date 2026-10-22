import { PrismaClient } from '@prisma/client';

/**
 * Agrega parámetros del pool de conexiones a la DATABASE_URL si no están
 * presentes. Contra un pooler externo (Supabase pgbouncer) el default de
 * Prisma puede agotar conexiones cuando varias requests llegan en ráfaga
 * (p. ej. la carga inicial del dashboard), provocando errores 500.
 * - connection_limit=10: máximo de conexiones abiertas por instancia.
 * - pool_timeout=15: espera hasta 15s por una conexión libre antes de fallar.
 */
function withPoolParams(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return databaseUrl;
  if (!databaseUrl.startsWith('postgres')) return databaseUrl;
  if (/connection_limit=/.test(databaseUrl)) return databaseUrl;
  const separator = databaseUrl.includes('?') ? '&' : '?';
  return `${databaseUrl}${separator}connection_limit=10&pool_timeout=15`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: withPoolParams(process.env.DATABASE_URL),
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
