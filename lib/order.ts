import "server-only";
import { prisma } from "./db";

export interface OrderView {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  totalAmount: number; // grosze
  items: {
    id: string;
    productId: number | null;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number; // grosze
    itemTotal: number; // grosze
  }[];
}

export async function checkoutCart(
  userId: string,
  idempotencyKey?: string
): Promise<{ success: boolean; message: string; orderId?: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Sprawdzenie powtórzenia tego samego żądania (Idempotency)
      if (idempotencyKey) {
        const existingOrder = await tx.order.findUnique({
          where: { idempotencyKey },
        });
        if (existingOrder) {
          return existingOrder;
        }
      }

      // 2. Pobranie koszyka użytkownika ze wszystkimi pozycjami i aktualnymi danymi produktów
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new Error("Koszyk jest pusty.");
      }

      // 3. Atomowe sprawdzenie i zmniejszenie stanu magazynowego każdego produktu
      for (const item of cart.items) {
        const rowsUpdated = await tx.$executeRaw`
          UPDATE "Product"
          SET "amount" = "amount" - ${item.quantity}
          WHERE "id" = ${item.productId} AND "amount" >= ${item.quantity}
        `;

        if (rowsUpdated === 0) {
          throw new Error(
            `Brak wystarczającej ilości sztuk towaru "${item.product.name}" na magazynie.`
          );
        }
      }

      // 4. Obliczenie łącznej kwoty zamówienia ze snapshotu cen w groszach
      let totalAmount = 0;
      for (const item of cart.items) {
        totalAmount += item.product.price * item.quantity;
      }

      const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 5. Utworzenie zamówienia i pozycji zamówienia ze snapshotem danych
      const newOrder = await tx.order.create({
        data: {
          number: orderNumber,
          status: "COMPLETED",
          userId,
          idempotencyKey,
          totalAmount,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              productCode: item.product.code,
              quantity: item.quantity,
              unitPrice: item.product.price,
            })),
          },
        },
      });

      // 6. Wyczyszczenie koszyka użytkownika
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    return {
      success: true,
      message: `Zamówienie ${order.number} zostało pomyślnie złożone!`,
      orderId: order.id,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Nie udało się zrealizować zamówienia.",
    };
  }
}

export async function getUserOrders(userId: string): Promise<OrderView[]> {
  if (!userId) return [];

  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    totalAmount: o.totalAmount,
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      productCode: it.productCode,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      itemTotal: it.unitPrice * it.quantity,
    })),
  }));
}

export async function getUserOrderById(
  userId: string,
  orderId: string
): Promise<OrderView | null> {
  if (!userId || !orderId) return null;

  // Bezpieczne sprawdzenie właściciela w zapytaniu (User A nie zobaczy zamówienia Usera B)
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      items: true,
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    totalAmount: order.totalAmount,
    items: order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      productCode: it.productCode,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      itemTotal: it.unitPrice * it.quantity,
    })),
  };
}
