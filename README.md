# Sklep Komputerowy - Programowanie BackEnd
**Politechnika Krakowska – Wydział Mechaniczny – Katedra Informatyki Stosowanej M-7**

Projekt aplikacji sklepu komputerowego rozwijany w ramach laboratoriów:
* **Lab 06:** Komponenty, model danych, SSR i optymalizacja obrazów
* **Lab 07:** Trasy dynamiczne, filtry URL i routing równoległy / przechwytujący
* **Lab 08:** Baza PostgreSQL 17, Prisma ORM 7, migracje, ograniczenia SQL CHECK, Collate "C", benchmark EXPLAIN i zapis współbieżny
* **Lab 09:** Uwierzytelnianie GitHub OAuth (Better Auth), sesje w bazie danych, autoryzacja koszyka, transakcyjny checkout i historia zamówień

---

## 1. Środowisko i wersje pakietów

* **Node.js:** v24.x LTS
* **Next.js:** 16.3.8 (App Router, Turbopack)
* **Baza danych:** PostgreSQL 17 (`postgres:17` via Docker Compose)
* **Prisma ORM:** 7.10.1 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`)
* **Uwierzytelnianie:** Better Auth 1.7.7 (`better-auth`, `@better-auth/prisma-adapter`, `auth`)
* **Sterownik bazy:** `pg@8.23.1`, `@types/pg@8.23.1`
* **Testy:** `vitest@5.0.3`
* **Style:** Tailwind CSS v4

---

## 2. Instrukcja uruchomienia projektu

### Krok 1: Klonowanie i instalacja zależności
```bash
npm ci
```

### Krok 2: Konfiguracja zmiennych środowiskowych
Skopiuj plik `.env.example` do `.env`:
```bash
cp .env.example .env
```
W pliku `.env` skonfiguruj zmienne:
* `DATABASE_URL`: URL połączenia PostgreSQL (np. `postgresql://root:rootpassword@localhost:5432/computershop?schema=public`)
* `BETTER_AUTH_URL`: `http://localhost:3000`
* `BETTER_AUTH_SECRET`: Losowy ciąg znaków min. 32 znaki
* `GITHUB_CLIENT_ID` i `GITHUB_CLIENT_SECRET`: Dane zarejestrowanej aplikacji OAuth na GitHubie

### Krok 3: Uruchomienie bazy danych w Dockerze
```bash
docker compose up -d --wait
```
Kontener `postgres` uruchomi się lokalnie na porcie `127.0.0.1:5432` z trwałym wolumenem `pgdata` oraz healthcheckiem `pg_isready`.

### Krok 4: Zastosowanie migracji i powtarzalnego seeda
```bash
npx --no-install prisma migrate deploy
npx --no-install prisma db seed
```

### Krok 5: Uruchomienie aplikacji
* **Wersja deweloperska:**
  ```bash
  npm run dev
  ```
* **Wersja produkcyjna:**
  ```bash
  npm run build
  npm run start
  ```

---

## 3. Konfiguracja GitHub OAuth

Aplikacja zarejestrowana jest jako **GitHub OAuth App** w ustawieniach deweloperskich (`GitHub -> Settings -> Developer settings -> OAuth Apps`):
* **Application name:** `Computer Shop 2026`
* **Homepage URL:** `http://localhost:3000`
* **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
* **Uprawnienia (scopes):** `user:email` (zapewnia bezpieczny odczyt zweryfikowanego adresu e-mail bez dostępu do repozytoriów kodu).

---

## 4. Testy i skrypty weryfikacyjne

Wszystkie testy i scenariusze weryfikacyjne uruchamiane są poleceniami:

```bash
# Uruchomienie pełnego zestawu testów integracyjnych (Vitest - 31 testów)
npm run test

# Sprawdzenie poprawności typów i reguł ESLint
npm run lint

# [Lab 08] Test trwałości i ograniczeń zmiany stanu magazynowego (CHECK amount >= 0)
npm run stock:update

# [Lab 08 / Rozszerzenie 4] Test atomowej rezerwacji stanu i wyścigu o ostatnią sztukę
npm run test:concurrent

# [Lab 08 / Rozszerzenie 3] Benchmark indeksu @@index([categoryId, amount]) via EXPLAIN (ANALYZE, BUFFERS)
npm run benchmark

# [Lab 09 / Rozszerzenie 3] Test unieważniania sesji na wielu urządzeniach
npx tsx scripts/multi-device-sessions.ts

# [Lab 09 / Rozszerzenie 4] Test zapisu współbieżnego na koszyku i polityki konfliktów
npx tsx scripts/concurrent-cart.ts

# [Lab 09 / Rozszerzenie 2] Test izolacji zamówień i snapshotu cen w historii
npx tsx scripts/order-history-test.ts
```

---

## 5. Kontrakt operacji i kontrola dostępu (Lab 09)

### Ustalanie właściciela z sesji (Single Source of Truth)
Wszystkie operacje chronione odczytują tożsamość użytkownika bezpośrednio z nagłówków żądania na serwerze za pomocą funkcji pomocniczej:
* **Plik:** [`lib/auth.ts`](file:///c:/GitHub/backend/computer-shop-2026dm/lib/auth.ts)
  ```ts
  export async function getCurrentSession() {
    return auth.api.getSession({
      headers: await headers(),
    });
  }
  ```
* Żadne żądanie z przeglądarki (formularz, query params, body) **nie przyjmuje identyfikatora właściciela koszyka (`userId`)**. Identyfikator jest pobierany wyłącznie z `session.user.id`.

### Kontrakt operacji koszyka ([`lib/cart.ts`](file:///c:/GitHub/backend/computer-shop-2026dm/lib/cart.ts)):
* `getCartForUser(userId)`: Zwraca koszyk zalogowanego użytkownika; brak rekordu daje pusty koszyk i sumę zero.
* `addProductToCart(userId, productId)`: Atomowe dodanie 1 sztuki. Zabezpiecza przed przekroczeniem limitu 99 sztuk oraz dostępnego stanu magazynowego.
* `setCartItemQuantity(userId, itemId, quantity)`: Modyfikacja ilości w zakresie 1–99 z jednoczesną weryfikacją `cart.userId == session.user.id`.
* `removeCartItem(userId, itemId)`: Bezpieczne usunięcie wyłącznie własnej pozycji:
  ```ts
  await prisma.cartItem.deleteMany({
    where: { id: itemId, cart: { userId } },
  });
  ```
  Próba podania ID pozycji innego użytkownika zwraca bezpieczną odmowę (`count === 0`) bez ujawniania danych obcego koszyka.

---

## 6. Zrealizowane Rozszerzenia

### Rozszerzenie 1: Checkout transakcyjny ([`lib/order.ts`](file:///c:/GitHub/backend/computer-shop-2026dm/lib/order.ts))
* Realizacja zamówienia w ramach jednej transakcji ACID:
  1. Sprawdzenie sesji i pobranie pozycji koszyka.
  2. Weryfikacja idempotencji na podstawie `idempotencyKey` – ponowienie tego samego żądania zwraca istniejące zamówienie i nie dubluje operacji.
  3. Atomowe zmniejszenie stanu magazynowego produktów (`WHERE id = ... AND amount >= quantity`). W przypadku braku towaru transakcja zostaje wycofana (rollback).
  4. Utworzenie rekordu `Order` oraz pozycji `OrderItem` z **pełnym snapshotem** (zamrożenie nazwy, kodu oraz ceny w groszach z chwili zakupu).
  5. Całkowite wyczyszczenie koszyka użytkownika.

### Rozszerzenie 2: Historia użytkownika ([`app/order-history/page.tsx`](file:///c:/GitHub/backend/computer-shop-2026dm/app/order-history/page.tsx))
* Dostęp do historii mają wyłącznie zalogowani użytkownicy (`where: { userId: session.user.id }`).
* Sprawdzono odporność na manipulację parametrami: Użytkownik A nie ma możliwości podejrzenia ani pobrania zamówień Użytkownika B.
* Przetestowano zachowanie relacji po zmianie ceny produktu w katalogu oraz po usunięciu produktu (`onDelete: SetNull`) – zamówienie w pełni zachowuje snapshot danych historycznych.

### Rozszerzenie 3: Sesje na wielu urządzeniach ([`scripts/multi-device-sessions.ts`](file:///c:/GitHub/backend/computer-shop-2026dm/scripts/multi-device-sessions.ts))
* Przetestowano wylogowanie z pojedynczego urządzenia (usunięcie konkretnego tokena sesji z tabeli `Session`) vs globalne unieważnienie wszystkich sesji danego użytkownika (`deleteMany({ where: { userId } })`).
* Wyjaśniono wpływ opcji `session.cookieCache.enabled: false` na natychmiastowe unieważnienie sesji w PostgreSQL bez opóźnień wynikających z pamięci podręcznej serwera.

### Rozszerzenie 4: Zapis współbieżny koszyka ([`scripts/concurrent-cart.ts`](file:///c:/GitHub/backend/computer-shop-2026dm/scripts/concurrent-cart.ts))
* Przetestowano równoległe żądania `addProduct`, wyścigi pomiędzy `setQuantity` a `setQuantity` oraz równoczesną modyfikację i usunięcie pozycji (`setQuantity` vs `removeItem`).
* Zdefiniowano i zaimplementowano politykę obsługi konfliktów unikalności (`P2002` na tworzeniu koszyka/pozycji) oraz brakujących rekordów (`P2025` przy współbieżnym usunięciu).

---

## 7. Odpowiedzi na pytania architektoniczne

### Laboratorium 08: PostgreSQL i Prisma

1. **Czym różnią się kontener, wolumen i baza? Dlaczego localhost ma inne znaczenie?**
   * *Kontener:* Odizolowany proces systemu operacyjnego uruchamiający silnik bazy.
   * *Wolumen:* Trwały katalog na dysku gospodarza (hosta), podmontowany do kontenera (`/var/lib/postgresql/data`), który zachowuje pliki bazy po zatrzymaniu lub zniszczeniu kontenera.
   * *Baza danych:* Logiczny zbiór schematów, tabel i danych zarządzany przez proces PostgreSQL.
   * *Localhost:* Na hoście `localhost` wskazuje na interfejs pętli zwrotnej komputera dewelopera (port 5432 mapowany z Dockera). Wewnątrz sieci kontenerów `localhost` oznacza wnętrze danego kontenera, dlatego aplikacja w innym kontenerze musi łączyć się po nazwie usługi (np. `postgres:5432`).

2. **Co potwierdza test gotowości (healthcheck `pg_isready`), a czego jeszcze nie sprawdza?**
   Potwierdza, że proces serwera PostgreSQL uruchomił się, otworzył gniazdo sieciowe i akceptuje połączenia TCP. Nie sprawdza jednak, czy migracje zostały zaaplikowane, czy tabele istnieją, ani czy aplikacja posiada poprawne uprawnienia do zapisu.

3. **Co robi konfiguracja CLI, generator i adapter uruchomieniowy?**
   * *Konfiguracja CLI (`prisma.config.ts`):* Wskazuje ścieżki do schematu, migracji i adresu bazy dla narzędzi Prisma CLI.
   * *Generator (`generator client`):* Kompiluje modele schematu do kodu TypeScript (`lib/generated/prisma/client.ts`).
   * *Adapter uruchomieniowy (`@prisma/adapter-pg`):* Przekazuje zapytania SQL generowane przez Prisma Client bezpośrednio do puli połączeń silnika Node PostgreSQL (`pg.Pool`), zapewniając kompatybilność z driver adapterami Prisma 7.

4. **Dlaczego typy klienta nie potwierdzają poprawności danych otrzymanych od użytkownika?**
   Typy TypeScript istnieją wyłącznie w fazie kompilacji i są usuwane w procesie transpilacji do JavaScriptu. Dane przesyłane z zewnątrz przez HTTP mogą przybrać dowolny format, dlatego konieczna jest walidacja w runtime (np. walidatory w TypeScript) oraz twarde ograniczenia SQL CHECK w bazie danych.

5. **Jak sprawdzisz, że moduł bazy nie trafia do przeglądarki?**
   Wykorzystano dyrektywę `import "server-only";` w plikach `lib/db.ts` i `lib/repository.ts`. Przypadkowa próba zaimportowania modułu po stronie klienta generuje błąd kompilacji bundlera Next.js. Dodatkowo weryfikuje to analiza pakietu produkcyjnego (`next build`).

6. **Dlaczego transakcja importu w seedzie nie zastępuje walidacji całego pliku?**
   Transakcja gwarantuje atomowość (wszystko albo nic), ale błąd napotkany na 99. rekordzie wycofuje całą transakcję po wykonaniu kosztownych operacji dyskowych. Walidacja całego pliku w pamięci RAM przed rozpoczęciem transakcji natychmiast odrzuca błędny plik bez obciążania serwera bazy danych.

7. **Różnica między `prisma migrate dev` a `prisma migrate deploy`:**
   * `migrate dev`: Narzędzie deweloperskie – porównuje schemat, generuje nowe pliki migracji SQL i stosuje je do lokalnej bazy.
   * `migrate deploy`: Narzędzie produkcyjne (CI/CD) – aplikuje wyłącznie wcześniej zapisane, zatwierdzone w repozytorium pliki migracji bez modyfikowania schematu ani pytania o interakcję.

8. **Collation `COLLATE "C"` a sortowanie nazw:**
   Domyślna lokalizacja PostgreSQL może sortować znaki diakrytyczne zależnie od locale systemu. Ustawienie `COLLATE "C"` na kolumnie `nameSortKey` wymusza czyste, bajtowe porównywanie kodów znaków UTF-8, co gwarantuje pełną zgodność z `Buffer.compare` i algorytmem z Lab 06.

---

### Laboratorium 09: Uwierzytelnianie i własny koszyk

1. **Co potwierdza dostawca OAuth (GitHub), a co musi sprawdzić sklep?**
   GitHub potwierdza jedynie tożsamość użytkownika (uwierzytelnienie – "ten użytkownik posiada konto GitHub o danym adresie e-mail"). Sklep musi przeprowadzić autoryzację – sprawdzić, czy dany użytkownik istnieje w bazie sklepu, powiązać go z lokalnym kontem `User`, utworzyć token sesji w tabeli `Session` oraz kontrolować uprawnienia do zasobów (koszyka i zamówień).

2. **Czym różnią się identyfikator konta GitHub, ID użytkownika w bazie i token sesji?**
   * *GitHub Account ID:* Zewnętrzny identyfikator dostawcy (zapisany w tabeli `Account.accountId`).
   * *ID użytkownika (`User.id`):* Wewnętrzny, trwały identyfikator w bazie sklepu, do którego przypisane są koszyki i zamówienia.
   * *Token sesji (`Session.token`):* Krótkotrwały, losowy ciąg znaków o wysokiej entropii zapisany w ciasteczku przeglądarki, weryfikowany w bazie przy każdym żądaniu.

3. **Dlaczego poprawny callback OAuth nie wystarcza do autoryzowania koszyka?**
   Callback OAuth to tylko jednorazowy punkt wymiany kodu na token dostawcy. Autoryzacja operacji na koszyku wymaga weryfikacji tożsamości właściciela przy każdym żądaniu HTTP na podstawie aktywnej sesji pobranej z bazy PostgreSQL.

4. **Dlaczego use server nie oznacza automatycznie autoryzacji?**
   Dyrektywa `'use server'` oznacza jedynie, że dana funkcja jest eksponowana jako endpoint RPC dostępny przez HTTP. Bez jawnego wywołania `getCurrentSession()` i sprawdzenia uprawnień wewnątrz funkcji, Server Action jest całkowicie publicznym endpointem podatnym na ataki.

5. **Jak użytkownik może wywołać akcję mimo ukrytego przycisku w interfejsie?**
   Ukrycie przycisku w HTML/CSS to jedynie detal wizualny UI. Każdy użytkownik może podejrzeć zapytanie sieciowe w DevTools lub wysłać żądanie HTTP POST za pomocą cURL, konsoli przeglądarki lub narzędzia Postman, wywołując Server Action bezpośrednio.

6. **Co się stanie przy podmianie `itemId` na pozycję innej osoby?**
   Dzięki klauzuli `where: { id: itemId, cart: { userId: session.user.id } }`, baza danych sprawdza jednocześnie identyfikator pozycji oraz powiązanie z koszykiem zalogowanego użytkownika. Podmiana `itemId` skutkuje brakiem dopasowania rekordu (`count === 0`) i bezpieczną odmową wykonania operacji bez wycieku danych.

7. **Dlaczego limit ilości w koszyku nie zapewnia dostępności podczas zakupu?**
   Koszyk nie rezerwuje towaru w magazynie. Pomiędzy dodaniem towaru do koszyka a kliknięciem "Złóż zamówienie" inny klient może wykupić ostatnie sztuki. Dlatego rzeczywista rezerwacja i weryfikacja stanu następuje dopiero w transakcji checkoutu.

8. **Dlaczego cena przesłana przez przeglądarkę nie jest wiarygodna?**
   Użytkownik ma pełną kontrolę nad kodem działającym w przeglądarce i parametrami żądań HTTP. Mógłby zmodyfikować cenę produktu na 1 grosz. Dlatego ceny i sumy są pobierane i obliczane wyłącznie na serwerze z tabeli `Product`.
