// __tests__/lab07.test.ts
import { describe, it, expect, vi } from "vitest";
import { validateId, parseCatalogParams } from "../lib/validators";
import { getProducts } from "../lib/repository";
import productsData from "../lib/data.json";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(true),
}));

vi.mock("server-only", () => ({}));

describe("Interpretacja parametrów URL", () => {
  it("powinna poprawnie odczytać poprawną kombinację", () => {
    const params = { type: "gpu", stock: "available", sort: "newest" };
    const result = parseCatalogParams(params);
    expect(result).toEqual({
      type: "gpu",
      stock: "available",
      sort: "newest",
      isTypeInvalid: false,
    });
  });

  it("powinna zastosować wartości domyślne dla braku parametrów", () => {
    const result = parseCatalogParams({});
    expect(result).toEqual({
      type: "all",
      stock: "all",
      sort: "name",
      isTypeInvalid: false,
    });
  });

  it("powinna ustawić domyślną wartość i zasygnalizować błąd dla nieznanej wartości", () => {
    const params = { type: "nieznany-typ" };
    const result = parseCatalogParams(params);
    expect(result.type).toBe("all");
    expect(result.isTypeInvalid).toBe(true);
  });

  it("powinna ustawić domyślną wartość dla pustego tekstu", () => {
    const params = { type: "" };
    const result = parseCatalogParams(params);
    expect(result.type).toBe("all");
    expect(result.isTypeInvalid).toBe(true);
  });

  it("powinna wybrać pierwszą wartość przy powtórzonym kluczu", () => {
    const params = { type: ["gpu", "cpu"] }; // URL: ?type=gpu&type=cpu
    const result = parseCatalogParams(params);
    expect(result.type).toBe("gpu");
  });
});

describe("Walidacja identyfikatora", () => {
  it("powinna akceptować poprawne ID", () => {
    expect(validateId("1")).toBe(true);
    expect(validateId("12345")).toBe(true);
  });

  it("powinna odrzucać błędne formaty (zera wiodące, litery, ujemne)", () => {
    expect(validateId("0")).toBe(false);
    expect(validateId("01")).toBe(false);
    expect(validateId("-1")).toBe(false);
    expect(validateId("12abc")).toBe(false);
    expect(validateId("abc")).toBe(false);
  });

  it("powinna odrzucać liczby przekraczające dozwolony zakres", () => {
    expect(validateId("2147483648")).toBe(false); // Większe niż int32 max
    expect(validateId("9999999999999999999")).toBe(false);
  });
});

describe("Zapytania repozytorium bez mutacji", () => {
  it("nie powinno mutować wejściowego źródła danych podczas sortowania", async () => {
    // Kopia zapasowa pierwszego elementu ze statycznego JSON
    const originalFirstId = productsData[0].id;

    // Wykonanie sortowania
    await getProducts("newest", "all", "all");

    // Sprawdzenie, czy tablica wejściowa pozostała nienaruszona
    expect(productsData[0].id).toBe(originalFirstId);
  });
});
