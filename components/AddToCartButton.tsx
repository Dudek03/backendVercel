"use client";

import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/actions/cart";

export default function AddToCartButton({
  productId,
  stock,
}: {
  productId: number;
  stock: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const isOutOfStock = stock <= 0;

  const handleAdd = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await addToCartAction(productId);
      if (res.success) {
        setMessage({ text: "Dodano do koszyka!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: res.error || "Wystąpił błąd", error: true });
      }
    });
  };

  return (
    <div className="mt-3 flex flex-col items-center gap-1 w-full">
      <button
        onClick={handleAdd}
        disabled={isPending || isOutOfStock}
        className={`w-full py-2 px-4 rounded font-medium text-sm transition ${
          isOutOfStock
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : isPending
            ? "bg-blue-400 text-white cursor-wait"
            : "bg-blue-600 hover:bg-blue-700 text-white shadow"
        }`}
      >
        {isOutOfStock
          ? "Niedostępny"
          : isPending
          ? "Dodawanie..."
          : "Dodaj do koszyka"}
      </button>
      {message && (
        <span
          className={`text-xs mt-1 ${
            message.error ? "text-red-500 font-semibold" : "text-green-600 font-medium"
          }`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
