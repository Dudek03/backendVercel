import { connection } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getCartForUser } from "@/lib/cart";
import CartView from "@/components/CartView";
import AuthStatus from "@/components/AuthStatus";

export default async function BasketPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session?.user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center border rounded-lg bg-gray-50 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Dostęp do koszyka wymaga zalogowania</h1>
        <p className="text-gray-600 mb-6">
          Zaloguj się swoim kontem GitHub, aby bezpiecznie zarządzać swoim koszykiem i składać zamówienia.
        </p>
        <div className="flex justify-center">
          <AuthStatus />
        </div>
      </div>
    );
  }

  const cart = await getCartForUser(session.user.id);

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6">Twój Koszyk</h1>
      <CartView initialCart={cart} />
    </div>
  );
}
