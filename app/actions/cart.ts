"use server";

import { getCurrentSession } from "@/lib/auth";
import {
  addProductToCart,
  setCartItemQuantity,
  removeCartItem,
} from "@/lib/cart";
import { checkoutCart } from "@/lib/order";
import { revalidatePath } from "next/cache";

export async function addToCartAction(productId: number) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Musisz być zalogowany, aby dodać produkt do koszyka.",
    };
  }

  const result = await addProductToCart(session.user.id, productId);
  if (result.success) {
    revalidatePath("/basket");
    revalidatePath("/product-list");
  }

  return {
    success: result.success,
    error: result.success ? undefined : result.message,
    message: result.message,
  };
}

export async function setQuantityAction(itemId: string, quantity: number) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Wymagana aktywna sesja.",
    };
  }

  const result = await setCartItemQuantity(session.user.id, itemId, quantity);
  if (result.success) {
    revalidatePath("/basket");
  }

  return {
    success: result.success,
    error: result.success ? undefined : result.message,
    message: result.message,
  };
}

export async function removeItemAction(itemId: string) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Wymagana aktywna sesja.",
    };
  }

  const result = await removeCartItem(session.user.id, itemId);
  if (result.success) {
    revalidatePath("/basket");
  }

  return {
    success: result.success,
    error: result.success ? undefined : result.message,
    message: result.message,
  };
}

export async function checkoutAction(idempotencyKey?: string) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Musisz być zalogowany, aby złożyć zamówienie.",
    };
  }

  const result = await checkoutCart(session.user.id, idempotencyKey);
  if (result.success) {
    revalidatePath("/basket");
    revalidatePath("/order-history");
    revalidatePath("/product-list");
  }

  return {
    success: result.success,
    error: result.success ? undefined : result.message,
    message: result.message,
    orderId: result.orderId,
  };
}
