export const validateId = (id: string): boolean => {
  if (!/^[1-9]\d*$/.test(id)) return false;
  const numericId = parseInt(id, 10);
  return Number.isSafeInteger(numericId) && numericId <= 2147483647;
};

export const parseCatalogParams = (params: {
  [key: string]: string | string[] | undefined;
}) => {
  const typeRaw = Array.isArray(params.type) ? params.type[0] : params.type;
  const stockRaw = Array.isArray(params.stock) ? params.stock[0] : params.stock;
  const sortRaw = Array.isArray(params.sort) ? params.sort[0] : params.sort;

  const validTypes = ["all", "cpu", "gpu", "ram", "disk"];
  const validStocks = ["all", "available", "unavailable"];
  const validSorts = ["name", "newest"];

  return {
    type: validTypes.includes(typeRaw as string) ? (typeRaw as string) : "all",
    stock: validStocks.includes(stockRaw as string)
      ? (stockRaw as "all" | "available" | "unavailable")
      : "all",
    sort: validSorts.includes(sortRaw as string)
      ? (sortRaw as "name" | "newest")
      : "name",
    isTypeInvalid:
      typeRaw !== undefined && !validTypes.includes(typeRaw as string),
  };
};
