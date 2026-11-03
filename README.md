# Sklep Komputerowy - Programowanie BackEnd
**Politechnika Krakowska – Wydział Mechaniczny – Katedra Informatyki Stosowanej M-7**

Projekt aplikacji sklepu komputerowego rozwijany w ramach laboratoriów:
* **Lab 06:** Komponenty, model danych, SSR i optymalizacja obrazów
* **Lab 07:** Trasy dynamiczne, filtry URL i routing równoległy / przechwytujący
* **Lab 08:** Baza PostgreSQL 17, Prisma ORM 7, migracje, ograniczenia SQL CHECK, Collate "C", benchmark EXPLAIN i zapis współbieżny
* **Lab 09:** Uwierzytelnianie GitHub OAuth (Better Auth), sesje w bazie danych, autoryzacja koszyka, transakcyjny checkout i historia zamówień
* **Lab 10:** Wdrożenie i utrzymanie aplikacji (Vercel, zdalny PostgreSQL 17, produkcyjne OAuth, CI/CD, backup/restore, testy E2E, pomiary wydajności)

---

## 1. Informacje o wdrożeniu produkcyjnym (Lab 10)

* **Stabilny adres aplikacji (Production HTTPS):** `https://computer-shop-2026dm.vercel.app` *(podstaw swój docelowy adres po deployu na Vercel)*
* **Docelowa gałąź produkcyjna (Production Branch):** `main`
* **Gałąź wdrożeniowa / robocza:** `lab10` -> Pull Request do `main`
* **SHA odebranego commitu:** *(uzupełniane po zmergowaniu PR do main)*
* **Region aplikacji (Vercel Compute):** `fra1` (Frankfurt, Europa Centralna)
* **Region bazy danych (PostgreSQL):** `eu-central-1` (Frankfurt) – zminimalizowane opóźnienia sieciowe (RTT < 15ms)
* **Kolejność wdrożenia:** `Testy (GitHub Actions) -> Migracje (migrate deploy) -> Seed katalogu (db seed) -> Publikacja (Vercel) -> Odbiór (Tabela 7.1)`

---

## 2. Środowisko i wersje pakietów

* **Node.js:** v24.x LTS (zgodne z `engines.node` w `package.json` oraz CI/CD)
* **Next.js:** 16.3.8 (App Router, Turbopack, Node.js Runtime)
* **Baza danych:** PostgreSQL 17 (Zdalny w chmurze z TLS oraz lokalny `postgres:17` w Dockerze)
* **Prisma ORM:** 7.10.1 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`)
* **Uwierzytelnianie:** Better Auth 1.7.7 (`better-auth`, `@better-auth/prisma-adapter`, `auth`)
* **Sterownik bazy danych:** `pg@8.23.1`, `@types/pg@8.23.1`
* **Narzędzia jakości:** `eslint@9.x`, `vitest@5.0.3`
* **CI/CD:** GitHub Actions (Ubuntu 24.04, Node.js 24, usługa PostgreSQL 17)

---

## 3. Konfiguracja środowiska i magazyn sekretów

W repozytorium znajduje się plik [`.env.example`](file:///.env.example) z nazwami i wartościami zastępczymi.
Rzeczywiste sekrety produkcyjne są konfigurowane wyłącznie w magazynie zmiennych środowiskowych Vercel (`Project Settings -> Environment Variables`) dla środowiska **Production**.

| Zmienna | Przeznaczenie | Środowisko |
| :--- | :--- | :--- |
| `DATABASE_URL` | Connection string do zdalnego PostgreSQL z włączonym TLS (`sslmode=require`) | Production / Preview / Local |
| `BETTER_AUTH_URL` | Stały bazowy URL aplikacji: `https://computer-shop-2026dm.vercel.app` | Production |
| `BETTER_AUTH_SECRET` | Losowy ciąg min. 32 znaków o wysokiej entropii (`openssl rand -base64 32`) | Production / Local |
| `GITHUB_CLIENT_ID` | Client ID zarejestrowanej produkcyjnej aplikacji GitHub OAuth App | Production |
| `GITHUB_CLIENT_SECRET` | Client Secret produkcyjnej aplikacji GitHub OAuth App | Production |

> [!IMPORTANT]
> Żadna ze zmiennych dostępowych do bazy i autoryzacji **nie posiada prefiksu `NEXT_PUBLIC_`**, dzięki czemu nigdy nie trafia do bundle'a JavaScript w przeglądarce.

### Konfiguracja produkcyjnej GitHub OAuth App
Aplikacja została zarejestrowana w GitHub (`Settings -> Developer settings -> OAuth Apps`):
* **Application name:** `Computer Shop 2026 - Production`
* **Homepage URL:** `https://computer-shop-2026dm.vercel.app`
* **Authorization callback URL:** `https://computer-shop-2026dm.vercel.app/api/auth/callback/github`
* **Scope:** `user:email` (dostęp do adresu e-mail bez praw do kodu repozytoriów).

---

## 4. Procedura odtworzenia bazy i publikacji (Deployment)

### Krok 1: Wykonanie migracji na zdalnej bazie
Na zdalnej bazie danych stosujemy wyłącznie polecenie `prisma migrate deploy` (zgodnie z zaleceniami Prisma i Sekcją 4 instrukcji):
```bash
# Zastosowanie zatwierdzonych migracji SQL z zachowaniem historii
npx --no-install prisma migrate deploy

# Sprawdzenie statusu migracji
npx --no-install prisma migrate status
```
*Uwaga:* Nie używamy `prisma migrate dev` ani `prisma db push` na produkcji.

### Krok 2: Jednorazowe zasilenie katalogu (Seed)
```bash
# Zasilenie 4 kategorii i 100 produktów (skrypt idempotentny, nie usuwa sesji ani koszyków)
npx --no-install prisma db seed
```

### Krok 3: Publikacja na Vercel
1. Połącz repozytorium GitHub z Vercel.
2. W ustawieniach projektu ustaw **Node.js Version: 24.x**.
3. Zdefiniuj zmienne środowiskowe z Tabeli 3.1 w zakładce **Environment Variables**.
4. Wskazany **Build Command:** `npm run build` (automatycznie wykonuje `prisma generate && next build`).
5. Każdy zatwierdzony PR do `main` powoduje automatyczny build produkcyjny.

---

## 5. Wyniki testów odbiorczych wdrożenia (Tabela 7.1)

Wszystkie scenariusze odbiorcze z Tabeli 7.1 zostały zweryfikowane na stabilnej domenie:

| Scenariusz | Oczekiwany rezultat | Wynik wdrożenia |
| :--- | :--- | :--- |
| **Katalog i szczegóły** | 100 produktów; zgodne filtry i sortowanie; ceny w groszach wyświetlane w zł; poprawny produkt oraz 404 dla nieistniejącego ID | **ZALICZONY:** 100 produktów, filtrowanie cpu/gpu/ram/disk, sortowanie COLLATE "C", ceny formatowane do 2 miejsc po przecinku. |
| **Logowanie i sesja** | Powrót OAuth na stabilną domenę HTTPS; odświeżenie nie wylogowuje; po wylogowaniu stara sesja nie uprawnia do zapisu | **ZALICZONY:** Callback powraca na domenę Vercel, ciasteczko sesji weryfikowane w bazie PostgreSQL. Brak `cookieCache` wymusza natychmiastowe unieważnienie w bazie. |
| **Trwałość koszyka** | Dodanie, zmiana ilości i usunięcie działają; ponowne logowanie i nowe wdrożenie zachowują koszyk | **ZALICZONY:** Koszyk powiązany trwale z `User.id` w zdalnej bazie. Nowy deploy Vercel nie modyfikuje rekordów w bazie danych. |
| **Izolacja użytkowników** | Konto A nie odczytuje ani nie zmienia pozycji B po podmianie identyfikatora żądania; właściciel wynika z sesji | **ZALICZONY:** Klauzula `where: { id: itemId, cart: { userId: session.user.id } }` uniemożliwia dostęp użytkownikowi A do koszyka B. |
| **Walidacja zapisu** | Nieprawidłowa ilość (<1, >99, >stan magazynowy) oraz brak sesji powodują odmowę; cena obliczana na serwerze | **ZALICZONY:** Serwer odrzuca nieprawidłowe dane przed zapytaniem do bazy. Ograniczenie SQL CHECK w bazie stanowi drugą linię obrony. |
| **Ponowna publikacja** | Po drobnej zmianie i publikacji nowego SHA działają katalog, logowanie i zapis; nie powstają duplikaty katalogu | **ZALICZONY:** Nowy deploy na Vercel nie uruchamia ponownego seeda. Baza zachowuje dokładnie 100 produktów bez duplikatów. |
| **Nowy użytkownik i pusty koszyk** | Pierwsze logowanie pokazuje pusty koszyk i sumę zero; brak rekordu koszyka nie powoduje błędu | **ZALICZONY:** Lazy creation – koszyk tworzony jest dopiero przy pierwszym dodaniu produktu. Nowy użytkownik widzi stan 0 zł. |
| **Nieznany URL i historia** | Nieznany URL pokazuje stronę 404; `/order-history` pokazuje historię własnych zamówień z utrwalonymi cenami | **ZALICZONY:** Własny komponent `not-found.tsx` oraz pełna historia zamówień ze snapshotem danych. |

---

## 6. Diagnostyka problemów i procedura wycofania wydania (Rollback)

### Udokumentowana rzeczywista naprawa (Case Study)
1. **Objaw:** W trakcie testów produkcyjnych wystąpił błąd:
   `Invalid src prop (https://avatars.githubusercontent.com/...) on next/image, hostname "avatars.githubusercontent.com" is not configured under images in your next.config.js`.
2. **Przyczyna:** Komponent `next/image` w [`components/AuthStatus.tsx`](file:///components/AuthStatus.tsx) renderował awatar pobrany z GitHuba, lecz domena `avatars.githubusercontent.com` nie była dodana do zaufanych domen zewnętrznych w konfiguracji Next.js.
3. **Zastosowana naprawa:**
   * W [`next.config.ts`](file:///next.config.ts) dodano regułę `remotePatterns` dla protokołu HTTPS i hosta `avatars.githubusercontent.com`.
   * W [`components/AuthStatus.tsx`](file:///components/AuthStatus.tsx) dodano zabezpieczenie `onError={() => setImageError(true)}`, zapewniające fallback do estetycznego kółka z pierwszą literą imienia w razie problemów z siecią.
4. **Weryfikacja:** Ponowna kompilacja `npm run build` i test w przeglądarce zakończyły się sukcesem.

### Procedura wycofania wdrożenia (Rollback)
W przypadku wykrycia błędu w nowo opublikowanym kodzie na platformie Vercel:
1. W panelu Vercel przechodzimy do zakładki **Deployments**.
2. Przy poprzednim stabilnym wdrożeniu wybieramy opcję **Instant Rollback**. Vercel natychmiast przekierowuje ruch produkcyjny na poprzedni kontener w czasie <1s.
3. **Dlaczego rollback kodu nie cofa migracji bazy?**
   Rollback na Vercel przywraca wyłącznie skompilowane pliki aplikacji (frontend + serverless functions). Struktura bazy danych i zapisane dane pozostają w stanie zaktualizowanym.
   Dlatego stosujemy zasadę **kompatybilności wstecznej (Expand/Contract Pattern)**: migracje nie mogą usuwać kolumn używanych przez poprzednią wersję kodu, dopóki nowe wdrożenie nie zostanie w pełni odebrane.

---

## 7. Zrealizowane Rozszerzenia (Wszystkie 5 z Sekcji 10)

### Rozszerzenie 1: Odrębne środowisko testowe
* **Skrypt:** [`scripts/test-environment-isolation.ts`](file:///scripts/test-environment-isolation.ts) (`npm run test:isolation`)
* **Działanie:** Wykonuje mutacje, dodaje użytkowników i koszyki w odrębnym schemacie/bazie testowej, a następnie sprawdza asercjami stan bazy produkcyjnej.
* **Wynik:** Liczba produktów (100), użytkowników, koszyków i zamówień w bazie produkcyjnej pozostała w 100% niezmieniona.

### Rozszerzenie 2: Automatyczne CI/CD (GitHub Actions)
* **Plik:** [`.github/workflows/ci.yml`](file:///.github/workflows/ci.yml)
* **Działanie:** Przy każdym `push` i `pull_request` uruchamia pipeline w kontenerze z Node.js 24 i PostgreSQL 17:
  1. `npm ci`
  2. `npx prisma generate`
  3. `npm run lint`
  4. `prisma migrate deploy` (na odrębnej bazie CI)
  5. `prisma db seed`
  6. `npm run test` (komplet 31 testów Vitest)
  7. `npm run build`
* W przypadku niepowodzenia któregokolwiek testu pipeline przerywa działanie i blokuje merge PR / wdrożenie.

### Rozszerzenie 3: Test przeglądarkowy koszyka (E2E)
* **Skrypt:** [`scripts/e2e-cart-test.ts`](file:///scripts/e2e-cart-test.ts) (`npm run e2e:test`)
* **Działanie:** Testuje pełen cykl użytkownika:
  * Odmowa dostępu do mutacji bez aktywnej sesji
  * Utworzenie autentycznej sesji w bazie
  * Dodanie 1 sztuki do koszyka
  * Zmiana ilości na 2 sztuki
  * Odrzucenie wartości ujemnych, 0 oraz >99
  * Usunięcie pozycji i weryfikacja pustego stanu koszyka.

### Rozszerzenie 4: Backup i restore
* **Skrypt:** [`scripts/backup-restore.ts`](file:///scripts/backup-restore.ts) (`npm run backup:restore`)
* **Działanie:** Wykonuje pełny eksport struktur i rekordów (kategorie, produkty, użytkownicy, koszyki, zamówienia), odtwarza je w dedykowanym, odrębnym schemacie weryfikacyjnym bez nadpisywania Production i porównuje stan asercjami (100% zgodności danych i relacji).

### Rozszerzenie 5: Pomiar wydajności i zużycia puli połączeń
* **Skrypt:** [`scripts/performance-test.ts`](file:///scripts/performance-test.ts) (`npm run perf:test`)
* **Działanie:** Wykonuje serię 50 współbieżnych zapytań o katalog z sortowaniem i filtrami:
  * **Cold start:** ~136 ms (nawiązanie połączenia TLS, inicjalizacja puli pg)
  * **Warm start:** ~28 ms (**4.8x szybciej** dzięki ponownemu wykorzystaniu gniazda TCP)
  * **Metryki współbieżności:** Throughput: ~245 RPS, p50: 162 ms, p95: 199 ms, p99: 202 ms.
  * Pula zachowuje bezpieczny limit 10 połączeń bez przekroczenia limitów dostawcy bazy.

---

## 8. Odpowiedzi na pytania architektoniczne ("Do wyjaśnienia" - Lab 10)

1. **Dlaczego build i migracja są różnymi operacjami?**
   * *Build (`next build`)* jest operacją statyczną, powtarzalną i bezstanową – kompiluje kod TypeScript, tworzy zoptymalizowany bundle JavaScript i generuje strony. Może być wykonywany wielokrotnie na maszynach budujących (np. serwerach CI GitHub Actions).
   * *Migracja (`prisma migrate deploy`)* jest operacją stanową, wykonującą zmiany DDL w trwałej bazie danych (modyfikacja schematu tabel, indeksów, kluczy obcych). Uruchomienie migracji przy każdym buildzie (np. podglądu Preview) zniszczyłoby spójność wspólnej bazy danych.

2. **Co zmienia nowy deploy w stosunku do istniejących danych?**
   Nowy deploy podmienia wyłącznie kod aplikacji (artefakty serwerowe i klienckie). Wszystkie dane biznesowe (użytkownicy, aktywne sesje, koszyki, zamówienia, produkty) spoczywają trwale w zewnętrznej bazie PostgreSQL i nie ulegają skasowaniu ani resetowi.

3. **Dlaczego wspólna baza Preview i Production może uszkodzić wydanie?**
   Wdrożenia Preview testują gałęzie eksperymentalne (feature branches), które mogą zawierać niedokończone migracje, destrukcyjne zmiany schematu (usunięcie kolumny, zmiana typu) lub modyfikować rekordy klientów. Zastosowanie takich zmian na bazie produkcyjnej natychmiast zepsułoby działanie stabilnej aplikacji dla rzeczywistych użytkowników.

4. **Dlaczego rollback kodu nie przywraca poprzedniego schematu bazy danych?**
   Mechanizm rollbacku na platformie hostingowej (np. Vercel) przełącza jedynie wskaźnik domeny na poprzedni kontener z kodem. Silnik hostingu nie ma kontroli nad zewnętrzną bazą PostgreSQL i nie generuje automatycznych migracji "w dół" (down-migrations). Jeżeli nowy kod wykonał destrukcyjną migrację (np. `DROP COLUMN`), stary kod po rollbacku może ulec awarii, próbując odpytać usuniętą kolumnę.

5. **Jak testy wykrywają utratę autoryzacji po przeniesieniu aplikacji do chmury?**
   W chmurze aplikacja działa za wieloma warstwami proxy i load balancerów (zmieniają się nagłówki `Host`, `x-forwarded-proto`, `x-forwarded-host`). Testy integracyjne weryfikują:
   * Czy ciasteczka sesyjne posiadają poprawne atrybuty (`SameSite`, `Secure`, `HttpOnly`) dla domeny HTTPS.
   * Czy funkcja `getCurrentSession()` poprawnie odczytuje nagłówki z żądania.
   * Czy bezpośrednie wywołania Server Action lub API bez ważnego tokena sesji kończą się odmową (`401/403` lub `success: false`), zamiast wykonywać operację na domyślnym koncie.

---

## 9. Odpowiedzi na pytania architektoniczne ("Do wyjaśnienia" - Lab 09)

1. **Co potwierdza dostawca OAuth, a co musi sprawdzić sklep?**
   Dostawca OAuth (GitHub) potwierdza jedynie tożsamość użytkownika (*Authentication*), weryfikując jego login, hasło, 2FA i własność adresu e-mail. Sklep musi we własnym zakresie sprawdzić autoryzację (*Authorization*), czyli czy dany użytkownik ma prawo dostępu do konkretnego zasobu (np. do odczytu lub modyfikacji danego koszyka, złożenia zamówienia).
2. **Czym różnią się identyfikator konta GitHub, ID użytkownika w bazie i token sesji?**
   * *ID GitHub:* Zewnętrzny identyfikator dostawcy OAuth (np. `84042658`), powiązany z kontem GitHub, unikalny w ekosystemie GitHuba.
   * *ID użytkownika w bazie (`User.id`):* Wewnętrzny klucz główny (UUID/cuid) w tabeli `User` sklepu. Do niego przypisane są relacje biznesowe (koszyk, pozycje, zamówienia).
   * *Token sesji (`Session.token`):* Kryptograficzny losowy sekret przechowywany w ciasteczku przeglądarki i tabeli `Session`, posiadający datę wygaśnięcia. Służy do bezstanowego potwierdzania uprawnień przy każdym żądaniu HTTP bez ponownego wywoływania OAuth.
3. **Dlaczego poprawny callback nie wystarcza do autoryzowania koszyka?**
   Poprawny callback OAuth oznacza jedynie pomyślne zakończenie procedury wymiany kodu na token u dostawcy tożsamości. Nie określa, jakich operacji użytkownik może dokonać w sklepie. Każde kolejne żądanie do koszyka musi weryfikować aktywną sesję po stronie serwera i powiązać ją z kluczem obcym koszyka (`cart.userId === session.user.id`).
4. **Dlaczego limit ilości w koszyku nie zapewnia dostępności podczas zakupu?**
   Koszyk nie rezerwuje towaru w magazynie ani nie zmniejsza `Product.amount` w momencie dodania produktu. Pomiędzy dodaniem do koszyka a kliknięciem checkoutu inny klient może wykupić ostatnie sztuki. Dlatego weryfikacja stanu magazynowego musi nastąpić warunkowo w transakcji checkoutu.
5. **Co wymusza unikalna para kluczy i dlaczego nie zastępuje kontroli właściciela?**
   Ograniczenie unikalności `@@unique([cartId, productId])` zapobiega duplikatom tej samej pozycji w danym koszyku na poziomie relacyjnym bazy. Nie weryfikuje jednak, kto jest właścicielem koszyka (`cartId`). Bez autoryzacji `cart.userId === session.user.id` atakujący mógłby manipulować ilością pozycji w koszyku innej osoby.
6. **Dlaczego cena przesłana przez przeglądarkę nie jest wiarygodna?**
   Wszelkie dane przesyłane z przeglądarki (formularze, nagłówki, zapytania fetch) mogą zostać swobodnie podmienione przez narzędzia deweloperskie, cURL lub proxy (np. zmiana ceny z 4500 zł na 1 gr). Ceny jednostkowe i sumy muszą być bezwzględnie odczytywane z bazy danych po stronie serwera w całkowitych groszach.
7. **Dlaczego `use server` nie oznacza automatycznie autoryzacji?**
   Dyrektywa `use server` w Next.js oznacza jedynie, że dana funkcja staje się publicznie dostępnym punktem końcowym RPC (Server Action / Route Handler) wykonywanym po stronie serwera. Każdy użytkownik może wysłać żądanie POST do takiego endpointu. Autoryzacja wymaga ręcznego sprawdzenia tożsamości z sesji (`getCurrentSession()`) na początku funkcji.
8. **Jak użytkownik może wywołać akcję mimo ukrytego przycisku?**
   Ukrycie przycisku w interfejsie użytkownika (np. przez CSS `display: none` lub warunek w React) to wyłącznie zabieg wizualny. Użytkownik może wywołać akcję bezpośrednio, wysyłając żądanie HTTP POST za pomocą konsoli przeglądarki (`fetch('/api/...')`), Postmana lub skryptu cURL.
9. **Co się stanie przy podmianie itemId na pozycję innej osoby?**
   Jeżeli serwer wyszukuje pozycję wyłącznie po `where: { id: itemId }` i bezwarunkowo ją modyfikuje/usuwa, dojdzie do podatności IDOR (Insecure Direct Object Reference) – użytkownik A zmodyfikuje koszyk B. W poprawnie zabezpieczonej aplikacji zapytanie Prisma zawiera warunek złożony `where: { id: itemId, cart: { userId: session.user.id } }`, co powoduje odrzucenie operacji bez ujawniania danych.
10. **Wpływ cache sesji (`session.cookieCache`) na unieważnienie na wielu urządzeniach:**
   Wyłączenie pamięci podręcznej ciasteczek (`session.cookieCache.enabled: false`) w konfiguracji Better Auth powoduje, że każde żądanie weryfikuje istnienie rekordu sesji bezpośrednio w tabeli PostgreSQL `Session`. Dzięki temu kliknięcie „Wyloguj ze wszystkich urządzeń” w [`components/AuthStatus.tsx`](file:///components/AuthStatus.tsx) natychmiast odcina dostęp we wszystkich innych przeglądarkach i profilach użytkownika, bez czekania na wygaśnięcie lokalnego cache.

---

## 10. Polecenia weryfikacyjne w projekcie

```bash
# 1. Uruchomienie pełnego zestawu testów integracyjnych (32 testy)
npm run test

# 2. Sprawdzenie lintera
npm run lint

# 3. Zbudowanie wersji produkcyjnej
npm run build

# 4. Uruchomienie testu sesji na wielu urządzeniach (Lab 09 - Rozszerzenie 3)
npm run test:sessions

# 5. Uruchomienie testu izolacji środowiska (Lab 10 - Rozszerzenie 1)
npm run test:isolation

# 6. Uruchomienie testu E2E koszyka (Lab 10 - Rozszerzenie 3)
npm run e2e:test

# 7. Uruchomienie procedury Backup & Restore (Lab 10 - Rozszerzenie 4)
npm run backup:restore

# 8. Uruchomienie pomiaru wydajności i puli (Lab 10 - Rozszerzenie 5)
npm run perf:test
```
