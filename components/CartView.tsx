"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setQuantityAction, removeItemAction, checkoutAction } from "@/app/actions/cart";
import type { CartView as CartViewType } from "@/lib/cart";

export default function CartView({ initialCart }: { initialCart: CartViewType }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [globalMessage, setGlobalMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleQuantityChange = (itemId: string, newQty: number, maxStock: number) => {
    setErrorMap((prev) => ({ ...prev, [itemId]: "" }));
    setGlobalMessage(null);

    if (newQty < 1 || newQty > 99) {
      setErrorMap((prev) => ({ ...prev, [itemId]: "Ilość musi wynosić od 1 do 99." }));
      return;
    }

    if (newQty > maxStock) {
      setErrorMap((prev) => ({ ...prev, [itemId]: `Maksymalna dostępna ilość: ${maxStock} szt.` }));
      return;
    }

    startTransition(async () => {
      const res = await setQuantityAction(itemId, newQty);
      if (!res.success) {
        setErrorMap((prev) => ({ ...prev, [itemId]: res.error || "Błąd zmiany ilości." }));
      }
    });
  };

  const handleRemove = (itemId: string) => {
    setErrorMap((prev) => ({ ...prev, [itemId]: "" }));
    setGlobalMessage(null);

    startTransition(async () => {
      const res = await removeItemAction(itemId);
      if (!res.success) {
        setGlobalMessage({ text: res.error || "Błąd usuwania pozycji.", error: true });
      }
    });
  };

  const handleCheckout = () => {
    setGlobalMessage(null);
    startTransition(async () => {
      // Unikalny klucz idempotencji dla tego żądania zakupu
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await checkoutAction(idempotencyKey);
      if (res.success) {
        setGlobalMessage({ text: res.message || "Zamówienie złożone pomyślnie!" });
        router.push("/order-history");
      } else {
        setGlobalMessage({ text: res.error || "Błąd podczas składania zamówienia.", error: true });
      }
    });
  };

  if (initialCart.items.length === 0) {
    return (
      <div className="py-12 text-center border rounded-lg bg-gray-50">
        <h2 className="text-xl font-bold mb-2">Twój koszyk jest pusty</h2>
        <p className="text-gray-600 mb-6">Dodaj produkty z katalogu, aby rozpocząć zakupy.</p>
        <Link
          href="/product-list"
          className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition"
        >
          Przejdź do katalogu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {globalMessage && (
        <div
          className={`p-4 mb-6 rounded text-sm font-medium ${
            globalMessage.error
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {globalMessage.text}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden shadow-sm bg-white mb-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b text-sm font-semibold text-gray-700">
              <th className="p-4">Produkt</th>
              <th className="p-4 text-center">Cena jedn.</th>
              <th className="p-4 text-center">Ilość</th>
              <th className="p-4 text-right">Wartość</th>
              <th className="p-4 text-center">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm">
            {initialCart.items.map((item) => {
              const hasStockIssue = item.quantity > item.availableStock;
              return (
                <tr key={item.id} className={hasStockIssue ? "bg-amber-50" : "hover:bg-gray-50"}>
                  <td className="p-4 flex items-center gap-4">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      width={60}
                      height={60}
                      className="object-contain rounded border"
                    />
                    <div>
                      <Link
                        href={`/product-list/${item.productId}`}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {item.productName}
                      </Link>
                      <div className="text-xs text-gray-500 font-mono">Kod: {item.productCode}</div>
                      {hasStockIssue && (
                        <div className="text-xs text-amber-700 font-semibold mt-1">
                          Uwaga: Dostępny stan to tylko {item.availableStock} szt.! Zmniejsz ilość.
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center font-medium">
                    {(item.unitPrice / 100).toFixed(2)} zł
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1, item.availableStock)}
                        disabled={isPending || item.quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                      >
                        -
                      </button>
                      <span className="w-10 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1, item.availableStock)}
                        disabled={isPending || item.quantity >= 99 || item.quantity >= item.availableStock}
                        className="w-8 h-8 flex items-center justify-center border rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                      >
                        +
                      </button>
                    </div>
                    {errorMap[item.id] && (
                      <div className="text-xs text-red-600 mt-1 font-semibold">{errorMap[item.id]}</div>
                    )}
                  </td>
                  <td className="p-4 text-right font-bold">
                    {(item.itemTotal / 100).toFixed(2)} zł
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-800 font-medium text-xs border border-red-200 px-3 py-1 rounded hover:bg-red-50 transition"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center p-6 border rounded-lg bg-gray-50 gap-4">
        <div>
          <span className="text-gray-600 text-sm">Łączna liczba produktów:</span>
          <span className="font-bold ml-2">{initialCart.totalItems} szt.</span>
          <div className="text-xl font-bold text-gray-900 mt-1">
            Suma do zapłaty: <span className="text-blue-600">{(initialCart.totalAmount / 100).toFixed(2)} zł</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={isPending || initialCart.items.some((i) => i.quantity > i.availableStock)}
          className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded shadow transition disabled:cursor-not-allowed"
        >
          {isPending ? "Przetwarzanie..." : "Złóż zamówienie (Checkout)"}
        </button>
      </div>
    </div>
  );
}
