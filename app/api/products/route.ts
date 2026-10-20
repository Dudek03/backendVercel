import { NextResponse } from "next/server";
import { getProducts } from "@/lib/repository";
import { ProductType } from "@/lib/types";

const ALLOWED_SORTS = ["name", "newest"];
const ALLOWED_CATEGORIES = ["cpu", "gpu", "ram", "disk"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sortParam = searchParams.get("sort");
  const categoryParam = searchParams.get("category");

  if (sortParam && !ALLOWED_SORTS.includes(sortParam)) {
    return NextResponse.json(
      {
        error: "Błędna wartość parametru sort. Dozwolone wartości: name, date.",
      },
      { status: 400 },
    );
  }

  if (categoryParam && !ALLOWED_CATEGORIES.includes(categoryParam)) {
    return NextResponse.json(
      {
        error:
          "Błędna wartość parametru category. Dozwolone wartości: cpu, gpu, ram, disk.",
      },
      { status: 400 },
    );
  }

  const sort = (sortParam as "name" | "newest") || "name";
  const category = categoryParam as ProductType | undefined;

  const products = await getProducts(sort, undefined, category);

  return NextResponse.json(products);
}
