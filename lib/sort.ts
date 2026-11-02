/**
 * Wspólna funkcja generująca klucz sortowania nazw produktów (Lab 06 - Lab 09).
 * Zapewnia porównywanie zgodne z regułami COLLATE "C" i Buffer.compare (polskie znaki, małe litery, brak diakrytyków).
 */
export const generateNameSortKey = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};
