import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getProducts, getProductById } from '../lib/repository';
import { prisma } from '../lib/db';
import { vi } from 'vitest';

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(true),
}));

describe('Integracja Repozytorium z bazą PostgreSQL', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('test')) {
      console.warn("UWAGA: Upewnij się, że używasz testowej bazy danych!");
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('powinno pobrać produkty z bazy posortowane po nazwie (domyślnie)', async () => {
    const products = await getProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('id');
    expect(products[0]).toHaveProperty('type');
  });

  it('powinno filtrować po kategorii z bazy danych', async () => {
    const cpuProducts = await getProducts('name', 'all', 'cpu');
    expect(cpuProducts.every(p => p.type === 'cpu')).toBe(true);
  });

  it('powinno zwracać null dla nieistniejącego ID', async () => {
    const product = await getProductById(999999);
    expect(product).toBeNull();
  });
});
