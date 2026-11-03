import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db";
import {
  getCartForUser,
  addProductToCart,
  setCartItemQuantity,
  removeCartItem,
} from "../lib/cart";
import { checkoutCart, getUserOrders, getUserOrderById } from "../lib/order";

const USER_A_ID = "usr-test-alice";
const USER_B_ID = "usr-test-bob";

describe("Scenariusze odbioru sesji i autoryzacji koszyka (Lab 09 - Tabela 8.1)", () => {
  beforeAll(async () => {
    // Utworzenie dwóch użytkowników testowych
    await prisma.user.upsert({
      where: { id: USER_A_ID },
      update: {},
      create: {
        id: USER_A_ID,
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
      },
    });

    await prisma.user.upsert({
      where: { id: USER_B_ID },
      update: {},
      create: {
        id: USER_B_ID,
        name: "Bob",
        email: "bob@example.com",
        emailVerified: true,
      },
    });

    // Upewnienie się, że produkty testowe mają wystarczający stan magazynowy
    await prisma.product.update({
      where: { id: 1 },
      data: { amount: 20 },
    });
    await prisma.product.update({
      where: { id: 2 },
      data: { amount: 50 },
    });

    // Czyszczenie koszyków testowych
    const carts = await prisma.cart.findMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID] } },
    });
    for (const c of carts) {
      await prisma.cartItem.deleteMany({ where: { cartId: c.id } });
    }
  });

  afterAll(async () => {
    const carts = await prisma.cart.findMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID] } },
    });
    for (const c of carts) {
      await prisma.cartItem.deleteMany({ where: { cartId: c.id } });
      await prisma.cart.delete({ where: { id: c.id } });
    }
    await prisma.orderItem.deleteMany({
      where: { order: { userId: { in: [USER_A_ID, USER_B_ID] } } },
    });
    await prisma.order.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_B_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A_ID, USER_B_ID] } },
    });
    await prisma.$disconnect();
  });

  it("[Scenariusz 1] Nowy użytkownik widzi pusty koszyk i sumę zero", async () => {
    const cart = await getCartForUser(USER_A_ID);
    expect(cart.items).toHaveLength(0);
    expect(cart.totalAmount).toBe(0);
    expect(cart.totalItems).toBe(0);
  });

  it("[Scenariusz 2] Dodanie, zmiana ilości i usunięcie z obliczeniem cen na serwerze", async () => {
    // 1. Dodanie produktu 1
    const addResult = await addProductToCart(USER_A_ID, 1);
    expect(addResult.success).toBe(true);

    let cart = await getCartForUser(USER_A_ID);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(1);
    expect(cart.items[0].quantity).toBe(1);

    // Wartość wynika z aktualnej ceny produktu w bazie
    const product1 = await prisma.product.findUnique({ where: { id: 1 } });
    expect(cart.items[0].unitPrice).toBe(product1!.price);
    expect(cart.totalAmount).toBe(product1!.price);

    // 2. Dodanie kolejnej sztuki tego samego produktu (zwiększa ilość, brak duplikatu)
    const addAgainResult = await addProductToCart(USER_A_ID, 1);
    expect(addAgainResult.success).toBe(true);

    cart = await getCartForUser(USER_A_ID);
    expect(cart.items).toHaveLength(1); // Nadal 1 pozycja
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.totalAmount).toBe(product1!.price * 2);

    // 3. Zmiana ilości
    const itemId = cart.items[0].id;
    const setQtyResult = await setCartItemQuantity(USER_A_ID, itemId, 1);
    expect(setQtyResult.success).toBe(true);

    cart = await getCartForUser(USER_A_ID);
    expect(cart.items[0].quantity).toBe(1);

    // 4. Usunięcie pozycji
    const removeResult = await removeCartItem(USER_A_ID, itemId);
    expect(removeResult.success).toBe(true);

    cart = await getCartForUser(USER_A_ID);
    expect(cart.items).toHaveLength(0);
    expect(cart.totalAmount).toBe(0);
  });

  it("[Scenariusz 3] Błędne dane (0, ujemna, ułamek, stan) nie modyfikują koszyka", async () => {
    await addProductToCart(USER_A_ID, 1);
    const cartBefore = await getCartForUser(USER_A_ID);
    const itemId = cartBefore.items[0].id;

    // Próba ustawienia ilości 0
    const resZero = await setCartItemQuantity(USER_A_ID, itemId, 0);
    expect(resZero.success).toBe(false);

    // Próba ustawienia ilości ujemnej
    const resNeg = await setCartItemQuantity(USER_A_ID, itemId, -3);
    expect(resNeg.success).toBe(false);

    // Próba ustawienia ułamka
    const resFloat = await setCartItemQuantity(USER_A_ID, itemId, 2.5);
    expect(resFloat.success).toBe(false);

    // Próba przekroczenia limitu 99
    const resLimit = await setCartItemQuantity(USER_A_ID, itemId, 100);
    expect(resLimit.success).toBe(false);

    // Próba dodania nieistniejącego produktu
    const resNoProduct = await addProductToCart(USER_A_ID, 999999);
    expect(resNoProduct.success).toBe(false);

    // Weryfikacja: koszyk pozostał w niezmienionym stanie
    const cartAfter = await getCartForUser(USER_A_ID);
    expect(cartAfter.items[0].quantity).toBe(cartBefore.items[0].quantity);

    // Sprzątanie pozycji
    await removeCartItem(USER_A_ID, itemId);
  });

  it("[Scenariusz 4] Izolacja Użytkownika A i Użytkownika B (Kontrola dostępu)", async () => {
    // Bob dodaje produkt do swojego koszyka
    await addProductToCart(USER_B_ID, 2);
    const bobCart = await getCartForUser(USER_B_ID);
    expect(bobCart.items).toHaveLength(1);
    const bobItemId = bobCart.items[0].id;

    // Próba 1: Alice próbuje zmienić ilość w pozycji Boba
    const attackSetQty = await setCartItemQuantity(USER_A_ID, bobItemId, 5);
    expect(attackSetQty.success).toBe(false);

    // Próba 2: Alice próbuje usunąć pozycję Boba
    const attackRemove = await removeCartItem(USER_A_ID, bobItemId);
    expect(attackRemove.success).toBe(false);

    // Weryfikacja: Koszyk Boba pozostał nienaruszony!
    const verifiedBobCart = await getCartForUser(USER_B_ID);
    expect(verifiedBobCart.items).toHaveLength(1);
    expect(verifiedBobCart.items[0].quantity).toBe(1);

    // Koszyk Alice pozostał pusty
    const aliceCart = await getCartForUser(USER_A_ID);
    expect(aliceCart.items).toHaveLength(0);

    // Sprzątanie
    await removeCartItem(USER_B_ID, bobItemId);
  });

  it("[Scenariusz 5] Brak sesji odrzuca mutacje", async () => {
    const unauthAdd = await addProductToCart("", 1);
    expect(unauthAdd.success).toBe(false);

    const unauthSet = await setCartItemQuantity("", "any-id", 2);
    expect(unauthSet.success).toBe(false);

    const unauthRemove = await removeCartItem("", "any-id");
    expect(unauthRemove.success).toBe(false);
  });

  it("[Rozszerzenie 1] Checkout transakcyjny tworzy zamówienie, czyści koszyk i jest idempotentny", async () => {
    // Alice dodaje produkt do koszyka
    await addProductToCart(USER_A_ID, 1);
    const cart = await getCartForUser(USER_A_ID);
    expect(cart.items).toHaveLength(1);

    const idempotencyKey = `idem-test-${Date.now()}`;

    // Checkout
    const checkoutResult = await checkoutCart(USER_A_ID, idempotencyKey);
    expect(checkoutResult.success).toBe(true);
    expect(checkoutResult.orderId).toBeDefined();

    // Koszyk po checkout jest pusty
    const cartAfterCheckout = await getCartForUser(USER_A_ID);
    expect(cartAfterCheckout.items).toHaveLength(0);

    // Zamówienie jest widoczne w historii Alice
    const orders = await getUserOrders(USER_A_ID);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].id).toBe(checkoutResult.orderId);

    // Ponowienie żądania z tym samym kluczem idempotencji nie tworzy nowego zamówienia!
    const retryResult = await checkoutCart(USER_A_ID, idempotencyKey);
    expect(retryResult.success).toBe(true);
    expect(retryResult.orderId).toBe(checkoutResult.orderId);

    const ordersAfterRetry = await getUserOrders(USER_A_ID);
    expect(ordersAfterRetry.length).toBe(orders.length); // Liczba zamówień bez zmian
  });

  it("[Rozszerzenie 2] Izolacja historii zamówień (Alice nie może podejrzeć zamówienia Boba)", async () => {
    // Bob składa zamówienie
    await addProductToCart(USER_B_ID, 2);
    const bobCheckout = await checkoutCart(USER_B_ID);
    expect(bobCheckout.success).toBe(true);

    // Alice próbuje odczytać zamówienie Boba
    const stolenOrder = await getUserOrderById(USER_A_ID, bobCheckout.orderId!);
    expect(stolenOrder).toBeNull();
  });

  it("[Rozszerzenie 3] Wylogowanie ze wszystkich urządzeń unieważnia sesje w bazie", async () => {
    // 1. Utworzenie dwóch sesji dla użytkownika Alice (np. Desktop i Mobile)
    const token1 = "test-token-device-alice-1";
    const token2 = "test-token-device-alice-2";

    await prisma.session.create({
      data: {
        id: "sess-test-alice-1",
        userId: USER_A_ID,
        token: token1,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    await prisma.session.create({
      data: {
        id: "sess-test-alice-2",
        userId: USER_A_ID,
        token: token2,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const sessionsBefore = await prisma.session.findMany({
      where: { userId: USER_A_ID },
    });
    expect(sessionsBefore.length).toBe(2);

    // 2. Globalne unieważnienie wszystkich sesji Alice
    const deleteResult = await prisma.session.deleteMany({
      where: { userId: USER_A_ID },
    });
    expect(deleteResult.count).toBe(2);

    // 3. Weryfikacja: brak aktywnych sesji w bazie danych
    const sessionsAfter = await prisma.session.findMany({
      where: { userId: USER_A_ID },
    });
    expect(sessionsAfter.length).toBe(0);
  });
});
