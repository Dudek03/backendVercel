import { describe, it, expect, afterAll } from "vitest";
import { getProducts, getProductById } from "../lib/repository";
import { prisma } from "../lib/db";

describe("Integracja Repozytorium z bazą PostgreSQL (Lab 08)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("powinno pobrać 100 produktów z bazy", async () => {
    const products = await getProducts();
    expect(products.length).toBe(100);
    expect(products[0]).toHaveProperty("id");
    expect(products[0]).toHaveProperty("type");
    expect(products[0]).toHaveProperty("price");
    expect(products[0]).toHaveProperty("amount");
    expect(products[0]).toHaveProperty("date");
  });

  it("data powinna zachowywać format ISO z milisekundami", async () => {
    const products = await getProducts();
    const dateStr = products[0].date;
    // Format ISO z milisekundami: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("powinno poprawnie sortować alfabetycznie (domyślnie name) z COLLATE 'C'", async () => {
    const products = await getProducts("name");
    for (let i = 0; i < products.length - 1; i++) {
      expect(products[i].name.localeCompare(products[i + 1].name, "pl")).toBeLessThanOrEqual(0);
    }
  });

  it("powinno poprawnie sortować chronologicznie (newest)", async () => {
    const products = await getProducts("newest");
    for (let i = 0; i < products.length - 1; i++) {
      const d1 = new Date(products[i].date).getTime();
      const d2 = new Date(products[i + 1].date).getTime();
      expect(d1).toBeGreaterThanOrEqual(d2);
    }
  });

  it("powinno filtrować po kategorii z bazy danych", async () => {
    const cpuProducts = await getProducts("name", "all", "cpu");
    expect(cpuProducts.length).toBeGreaterThan(0);
    expect(cpuProducts.every((p) => p.type === "cpu")).toBe(true);
  });

  it("powinno filtrować po dostępności magazynowej", async () => {
    const available = await getProducts("name", "available", "all");
    expect(available.every((p) => p.amount > 0)).toBe(true);

    const unavailable = await getProducts("name", "unavailable", "all");
    expect(unavailable.every((p) => p.amount === 0)).toBe(true);
  });

  it("powinno łączyć filtry kategorii i dostępności", async () => {
    const filtered = await getProducts("name", "available", "gpu");
    expect(filtered.every((p) => p.type === "gpu" && p.amount > 0)).toBe(true);
  });

  it("powinno zwracać null dla nieistniejącego ID", async () => {
    const product = await getProductById(999999);
    expect(product).toBeNull();
  });

  it("powinno bezpiecznie odrzucić ID spoza zakresu 1-2147483647 bez błędu ORM", async () => {
    expect(await getProductById(0)).toBeNull();
    expect(await getProductById(-1)).toBeNull();
    expect(await getProductById(2147483648)).toBeNull();
  });
});

describe("Weryfikacja ograniczeń SQL w bazie danych (CHECK, UNIQUE, FK)", () => {
  it("baza danych powinna odrzucić ujemną cenę (CHECK product_price_nonnegative)", async () => {
    await expect(
      prisma.product.create({
        data: {
          id: 555551,
          code: "TESTFAIL01",
          name: "Test Ujemnej Ceny",
          description: "desc",
          image: "/img.webp",
          price: -100, // Naruszenie CHECK
          amount: 5,
          date: new Date(),
          categoryId: "cpu",
          nameSortKey: "test",
        },
      })
    ).rejects.toThrow();
  });

  it("baza danych powinna odrzucić ujemny stan magazynowy (CHECK product_amount_nonnegative)", async () => {
    await expect(
      prisma.product.create({
        data: {
          id: 555552,
          code: "TESTFAIL02",
          name: "Test Ujemnego Stanu",
          description: "desc",
          image: "/img.webp",
          price: 100,
          amount: -5, // Naruszenie CHECK
          date: new Date(),
          categoryId: "cpu",
          nameSortKey: "test",
        },
      })
    ).rejects.toThrow();
  });

  it("baza danych powinna odrzucić niedodatnie ID (CHECK product_id_positive)", async () => {
    await expect(
      prisma.product.create({
        data: {
          id: -10, // Naruszenie CHECK
          code: "TESTFAIL03",
          name: "Test ID",
          description: "desc",
          image: "/img.webp",
          price: 100,
          amount: 5,
          date: new Date(),
          categoryId: "cpu",
          nameSortKey: "test",
        },
      })
    ).rejects.toThrow();
  });

  it("baza danych powinna odrzucić zduplikowany unikalny kod (UNIQUE Product_code_key)", async () => {
    await expect(
      prisma.product.create({
        data: {
          id: 555554,
          code: "MHJHZAALYI", // Kod istniejącego produktu ID 1
          name: "Zduplikowany Kod",
          description: "desc",
          image: "/img.webp",
          price: 100,
          amount: 5,
          date: new Date(),
          categoryId: "cpu",
          nameSortKey: "test",
        },
      })
    ).rejects.toThrow();
  });

  it("baza danych powinna odrzucić nieistniejącą kategorię (FK Product_categoryId_fkey)", async () => {
    await expect(
      prisma.product.create({
        data: {
          id: 555555,
          code: "TESTFAIL05",
          name: "Błędna kategoria",
          description: "desc",
          image: "/img.webp",
          price: 100,
          amount: 5,
          date: new Date(),
          categoryId: "nieistniejaca_kategoria",
          nameSortKey: "test",
        },
      })
    ).rejects.toThrow();
  });

  it("baza danych powinna odrzucić ilość w koszyku poza zakresem 1-99 (CHECK cartitem_quantity_check)", async () => {
    const user = await prisma.user.findFirst();
    let cart = await prisma.cart.findFirst({ where: { userId: user!.id } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: user!.id } });
    }

    // Ilość 0 (za mało)
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: 1,
          quantity: 0,
        },
      })
    ).rejects.toThrow();

    // Ilość 100 (za dużo)
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: 1,
          quantity: 100,
        },
      })
    ).rejects.toThrow();
  });
});
