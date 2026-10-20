import { describe, it, expect, vi } from "vitest";
import {
  getProducts,
  getProductById,
  validateProducts,
} from "../lib/repository";
import { Product } from "../lib/types";

vi.mock("server-only", () => ({}));

describe("Funkcje repozytorium", () => {
  it("powinno sortować produkty po nazwie bez mutowania", async () => {
    const products = await getProducts("name");
    expect(products.length).toBeGreaterThan(0);
    expect(
      products[0].name.localeCompare(products[1].name),
    ).toBeLessThanOrEqual(0);
  });

  it("powinno sortować po dacie malejąco", async () => {
    const products = await getProducts("newest", "all", "all");
    const date1 = new Date(products[0].date).getTime();
    const date2 = new Date(products[1].date).getTime();
    expect(date1).toBeGreaterThanOrEqual(date2);
  });

  it("powinno filtrować po dostępności", async () => {
    const available = await getProducts("name", "available");
    expect(available.every((p) => p.amount > 0)).toBe(true);

    const unavailable = await getProducts("name", "unavailable");
    expect(unavailable.every((p) => p.amount === 0)).toBe(true);
  });

  it("powinno zwracać null dla braku identyfikatora", async () => {
    const product = await getProductById(999999);
    expect(product).toBeNull();
  });
});

describe("Walidator danych", () => {
  it("powinien odrzucać ujemną cenę", () => {
    const badData = [
      {
        id: 1,
        code: "A",
        name: "X",
        type: "cpu",
        price: -10,
        amount: 1,
        description: "",
        date: "",
        image: "",
      },
    ] as Product[];
    expect(() => validateProducts(badData)).toThrow("Cena nie może być ujemna");
  });

  it("powinien odrzucać duplikaty kodów", () => {
    const badData = [
      {
        id: 1,
        code: "DUPLIKAT12",
        name: "X",
        type: "cpu",
        price: 10,
        amount: 1,
        description: "",
        date: "",
        image: "",
      },
      {
        id: 2,
        code: "DUPLIKAT12",
        name: "Y",
        type: "cpu",
        price: 10,
        amount: 1,
        description: "",
        date: "",
        image: "",
      },
    ] as Product[];
    expect(() => validateProducts(badData)).toThrow("Duplikat kodu");
  });
});
