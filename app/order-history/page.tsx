import { connection } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getUserOrders } from "@/lib/order";
import AuthStatus from "@/components/AuthStatus";
import Link from "next/link";

export default async function OrderHistoryPage() {
  await connection();
  const session = await getCurrentSession();

  if (!session?.user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center border rounded-lg bg-gray-50 shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Historia zamówień</h1>
        <p className="text-gray-600 mb-6">
          Musisz być zalogowany, aby przeglądać historię swoich zamówień.
        </p>
        <div className="flex justify-center">
          <AuthStatus />
        </div>
      </div>
    );
  }

  const orders = await getUserOrders(session.user.id);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Historia Zamówień</h1>
        <Link
          href="/product-list"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Wróć do zakupów
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="py-12 text-center border rounded-lg bg-gray-50">
          <h2 className="text-xl font-bold mb-2">Brak złożonych zamówień</h2>
          <p className="text-gray-600 mb-6">Nie złożyłeś jeszcze żadnego zamówienia w naszym sklepie.</p>
          <Link
            href="/product-list"
            className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition"
          >
            Przejdź do oferty
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-gray-100 p-4 border-b flex flex-wrap justify-between items-center gap-4 text-sm">
                <div>
                  <span className="font-bold text-gray-700">Numer zamówienia:</span>{" "}
                  <span className="font-mono font-semibold">{order.number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Data:</span>{" "}
                  <span className="font-medium">{new Date(order.createdAt).toLocaleString("pl-PL")}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>{" "}
                  <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                    {order.status}
                  </span>
                </div>
                <div className="font-bold text-base text-gray-900">
                  Łącznie: {(order.totalAmount / 100).toFixed(2)} zł
                </div>
              </div>

              <div className="p-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-gray-500 text-xs uppercase">
                      <th className="pb-2">Pozycja (Snapshot)</th>
                      <th className="pb-2 text-center">Ilość</th>
                      <th className="pb-2 text-right">Cena w chwili zakupu</th>
                      <th className="pb-2 text-right">Wartość</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3">
                          <div className="font-medium text-gray-900">{item.productName}</div>
                          <div className="text-xs text-gray-500 font-mono">Kod: {item.productCode}</div>
                        </td>
                        <td className="py-3 text-center font-medium">{item.quantity} szt.</td>
                        <td className="py-3 text-right">{(item.unitPrice / 100).toFixed(2)} zł</td>
                        <td className="py-3 text-right font-bold">{(item.itemTotal / 100).toFixed(2)} zł</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
