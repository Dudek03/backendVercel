import "server-only";
import { prisma } from "./db";

export interface CartViewItem {
  id: string;
  productId: number;
  productName: string;
  productCode: string;
  productImage: string;
  unitPrice: number; // w groszach
  quantity: number;
  itemTotal: number; // w groszach
  availableStock: number;
  isAvailable: boolean;
}

export interface CartView {
  id: string | null;
  items: CartViewItem[];
  totalAmount: number; // w groszach
  totalItems: number;
}

export async function getCartForUser(userId: string): Promise<CartView> {
  if (!userId) {
    return { id: null, items: [], totalAmount: 0, totalItems: 0 };
  }

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return { id: cart ? cart.id : null, items: [], totalAmount: 0, totalItems: 0 };
  }

  let totalAmount = 0;
  let totalItems = 0;

  const items: CartViewItem[] = cart.items.map((item) => {
    const unitPrice = item.product.price;
    const itemTotal = unitPrice * item.quantity;
    totalAmount += itemTotal;
    totalItems += item.quantity;

    return {
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.code,
      productImage: item.product.image,
      unitPrice,
      quantity: item.quantity,
      itemTotal,
      availableStock: item.product.amount,
      isAvailable: item.product.amount >= item.quantity,
    };
  });

  return {
    id: cart.id,
    items,
    totalAmount,
    totalItems,
  };
}

export async function addProductToCart(
  userId: string,
  productId: number
): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }

  if (!Number.isSafeInteger(productId) || productId < 1 || productId > 2147483647) {
    return { success: false, message: "Nieprawidłowy identyfikator produktu." };
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Sprawdź produkt i jego aktualny stan
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, message: "Produkt nie istnieje." };
    }

    if (product.amount <= 0) {
      return { success: false, message: "Produkt jest obecnie niedostępny." };
    }

    // 2. Utwórz koszyk z obsługą konfliktu współbieżnego tworzenia (P2002 na userId)
    let cart = await tx.cart.findUnique({ where: { userId } });
    if (!cart) {
      try {
        cart = await tx.cart.create({ data: { userId } });
      } catch (err: any) {
        if (err.code === "P2002") {
          cart = (await tx.cart.findUnique({ where: { userId } }))!;
        } else {
          throw err;
        }
      }
    }

    // 3. Sprawdź czy pozycja już istnieje w koszyku
    const existingItem = await tx.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;

      if (newQuantity > 99) {
        return { success: false, message: "Osiągnięto maksymalny limit 99 sztuk w koszyku." };
      }

      if (newQuantity > product.amount) {
        return { success: false, message: `Brak wystarczającej ilości towaru na magazynie (dostępne: ${product.amount} szt.).` };
      }

      // Atomowa aktualizacja z warunkiem
      const updated = await tx.$executeRaw`
        UPDATE "CartItem"
        SET "quantity" = "quantity" + 1
        WHERE "id" = ${existingItem.id}
          AND "quantity" < 99
          AND "quantity" < ${product.amount}
      `;

      if (updated === 0) {
        return { success: false, message: "Nie udało się zaktualizować ilości towaru w koszyku (konflikt stanu)." };
      }

      return { success: true, message: "Zwiększono ilość produktu w koszyku." };
    } else {
      // Dodanie nowej pozycji do koszyka z obsługą wyścigu
      try {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity: 1,
          },
        });
        return { success: true, message: "Dodano produkt do koszyka." };
      } catch (err: any) {
        if (err.code === "P2002") {
          const updated = await tx.$executeRaw`
            UPDATE "CartItem"
            SET "quantity" = "quantity" + 1
            WHERE "cartId" = ${cart.id}
              AND "productId" = ${productId}
              AND "quantity" < 99
              AND "quantity" < ${product.amount}
          `;
          if (updated === 1) {
            return { success: true, message: "Zwiększono ilość produktu w koszyku." };
          }
        }
        throw err;
      }
    }
  });
}

export async function setCartItemQuantity(
  userId: string,
  itemId: string,
  quantity: number
): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }

  if (typeof itemId !== "string" || !itemId) {
    return { success: false, message: "Nieprawidłowy identyfikator pozycji." };
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
    return { success: false, message: "Ilość musi być liczbą całkowitą z zakresu od 1 do 99." };
  }

  return await prisma.$transaction(async (tx) => {
    // Sprawdzenie właściciela powiązanego koszyka w jednym zapytaniu!
    const item = await tx.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: { product: true },
    });

    if (!item) {
      return { success: false, message: "Pozycja nie istnieje lub brak uprawnień." };
    }

    if (quantity > item.product.amount) {
      return {
        success: false,
        message: `Maksymalna dostępna ilość na magazynie to ${item.product.amount} szt.`,
      };
    }

    try {
      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
      return { success: true, message: "Zaktualizowano ilość." };
    } catch (err: any) {
      if (err.code === "P2025") {
        return { success: false, message: "Pozycja została współbieżnie usunięta." };
      }
      throw err;
    }
  });
}

export async function removeCartItem(
  userId: string,
  itemId: string
): Promise<{ success: boolean; message: string }> {
  if (!userId) {
    return { success: false, message: "Wymagane logowanie." };
  }

  if (typeof itemId !== "string" || !itemId) {
    return { success: false, message: "Nieprawidłowy identyfikator pozycji." };
  }

  // Bezpieczne usunięcie wyłącznie pozycji należącej do koszyka danego użytkownika
  const deleted = await prisma.cartItem.deleteMany({
    where: {
      id: itemId,
      cart: { userId },
    },
  });

  if (deleted.count === 0) {
    return { success: false, message: "Pozycja nie istnieje lub brak uprawnień." };
  }

  return { success: true, message: "Usunięto pozycję z koszyka." };
}
