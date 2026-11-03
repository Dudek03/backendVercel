# Sklep Komputerowy - Lab 06 (Programowanie BackEnd)

## Uruchomienie projektu
1. Wygenerowanie danych: `node scripts/generate-data.js`
2. Instalacja zależności: `npm ci`
3. Budowanie wersji produkcyjnej: `npm run build`
4. Uruchomienie: `npm run start`

## Środowisko
- **Node.js:** v24.x LTS
- **Next.js:** 16.3.8
- **TypeScript, App Router, ESLint**

## Wynik sprawdzeń i testów
Testy z wykorzystaniem `Vitest` uruchamiane za pomocą `npm run test` kończą się sukcesem. 
- Sprawdzono sortowanie, filtrowanie, zachowanie dla braku ID.
- Walidator poprawnie odrzuca ujemne ceny oraz duplikaty ID/Kodów.
- Aplikacja w wersji produkcyjnej zachowuje poprawnie obsługę strony 404, koszyka i prawidłowo ładuje komponent ze zdjęciami.

## Źródła danych i zasobów
- Obrazki użyte w `public/images/products/` pochodzą z [wpisz stronę np. Unsplash/Pixabay] i mają licencję darmową do użytku niekomercyjnego.

---

## Odpowiedzi na pytania architektoniczne:

**1. Struktura i wspólny układ**
- *Czym różnią się page.tsx i layout.tsx?* `page.tsx` reprezentuje unikalną
  zawartość (UI) konkretnej trasy (URL). `layout.tsx` to współdzielony szablon
  strony wokół stron (strony są renderowane jako `children`). Layout zachowuje
  swój stan i nie ulega przerenderowaniu przy zmianie podstron.
- *Czy do publicznej strony potrzeba osobnego layoutu?* Niekoniecznie. Root
  layout (`app/layout.tsx`) obejmuje całą aplikację. Jeśli dana sekcja wymaga
  dodatkowych powtarzalnych elementów, można tam dodać zagnieżdżony layout.
- *Co w nawigacji przez Link pozostaje wspólne?* Komponenty zdefiniowane w
  layoucie (nagłówek, stopka, nawigacja) pozostają współdzielone; przeładowaniu
  ulega tylko część zawarta w `children`.

**2. Granica serwer-klient**
- *Gdzie wykonuje się funkcja repozytorium?* Po stronie serwera aplikacji w
  Node.js (dzięki użyciu dyrektywy `server-only`).
- *Jakie dane trafiają do przeglądarki?* Do przeglądarki trafia jedynie
  wygenerowany na serwerze gotowy kod HTML z danymi wstrzykniętymi w strukturę
  DOM. Przeglądarka "nie widzi" pełnej zawartości JSON, a jedynie to, co strona
  renderuje w tagach.
- *Dlaczego import całego JSON do komponentu klienta zmienia architekturę?*
  Importując JSON po stronie klienta, zmuszamy przeglądarkę do pobrania całej
  "bazy danych" do pamięci (w paczce JS), co niszczy wydajność i naraża na
  wyciek wrażliwych danych.
- *Czy "use client" wyklucza początkowe renderowanie HTML na serwerze?* Nie.
  Komponenty klienckie również przechodzą początkowy proces prerenderingu SSR
  (Server-Side Rendering), gdzie wysyłany jest statyczny HTML dla szybszego
  wczytania, a następnie na kliencie są "hydrowane" (podłączana jest
  interaktywność i event listenery).

**3. Brak danych i awaria**
- *Dlaczego brak funkcjonalności nie jest awarią?* Koszyk bez logiki biznesowej
  to po prostu statyczny ekran informacyjny (zaplanowany stan systemu), podczas
  gdy awaria to nagły błąd wykonywania kodu (np. błąd parsowania JSON).
- *Czy granica error.tsx przechwytuje błąd layoutu w tym samym segmencie?* Nie.
  Plik `error.tsx` opakowuje plik `page.tsx` (i zagnieżdżone elementy), ale nie
  przechwytuje błędów wyrzucanych przez `layout.tsx` leżący na tym samym
  poziomie katalogu. Błąd z layoutu chwyta globalny plik błędu poziom wyżej.
- *Dlaczego widok "nie znaleziono" nie zawsze oznacza HTTP 404 w odpowiedzi
  strumieniowej?* Jeśli występuje renderowanie strumieniowe (Streaming) i błąd
  wystąpi po tym, jak serwer wysłał już nagłówek statusu HTTP 200 OK z ramką
  dokumentu, nie można "cofnąć" nagłówka by wstawić HTTP 404, więc UI pokazuje
  brak strony mimo odpowiedzi statusowej 200.

## Źródła danych i zasobów
Zdjęcia produktów umieszczone w katalogu `public/images/products/` pochodzą z serwisu Pexels.

**Źródła (autorzy zdjęć):**
- Obraz karty graficznej (`gpu.webp`) - autor: Sergei Starostin
- Obraz procesora (`cpu.webp`) - autor: Rogeer Marques
- Obraz pamięci RAM (`ram.webp`) - autor: Andrey Matveev
- Obraz dysku (`disk.webp`) - autor: Azamat Esenaliev

**Prawo wykorzystania:** 
Wszystkie powyższe zdjęcia udostępniane są na licencji Pexels, co oznacza, że są w pełni darmowe do użytku osobistego i niekomercyjnego.


## Lab 07 - Trasy dynamiczne i filtry w Next.js

### Odpowiedzi na pytania "Do wyjaśnienia"
1. **Czym różnią się błędny format ID, brak produktu i awaria?** Błędny format
   (np. `12abc`) narusza kontrakt walidacyjny (odsyłamy 404 bez pytania bazy).
   Brak produktu oznacza poprawne logicznie ID, którego baza nie znalazła.
   Awaria to nieoczekiwany wyjątek (np. błąd połączenia), który musi wyrzucić
   status 500 lub obsługę w `error.tsx`, aby nie udawać, że produkt celowo
   zniknął z oferty.
2. **Dlaczego folder [id] nie oznacza, że strona zawsze renderuje się przy
   żądaniu?** Z użyciem `generateStaticParams` możemy wymusić prerenderowanie
   stron w momencie kompilacji (SSG), co udowodniono w Rozszerzeniu 4. 
3. **Dlaczego walidujemy adres mimo kontrolek ograniczających wybór?** URL jest
   zewnętrznym interfejsem aplikacji (API). Użytkownik może ręcznie edytować
   URL, wkleić stary link lub podać złośliwe parametry, pomijając całkowicie
   nasze kontrolki.
4. **Dlaczego filtr w useState nie odtwarza widoku z udostępnionego linku?**
   `useState` żyje tylko w pamięci aktualnej sesji przeglądarki. Wysłany link
   nie niesie ze sobą stanu pamięci RAM z innego komputera, dlatego jedynym
   źródłem prawdy do odtwarzania (tzw. Deep Linking) musi być URL.
5. **Co zachowuje nawigacja przez Link, a co pełne przeładowanie?** Link
   zachowuje strukturę React (Layouty), stany (np. Context, useState) oraz nie
   pobiera od zera skryptów z serwera (robi łagodne przejście). Pełne
   przeładowanie odświeża całą kartę niszcząc lokalne stany.
6. **Dlaczego komponent z `use client` otrzymuje początkowy HTML z serwera?**
   Next.js dokonuje prerenderowania SSR także dla komponentów klienckich, aby
   użytkownik szybciej zobaczył zawartość przed pobraniem JavaScriptu.
   Następnie zachodzi zjawisko "hydracji".

### Rozszerzenia (WSZYSTKIE)
- **Parallel Routes (@recommended):** Dodano boczny panel 3 produktów. Zdefiniowano pliki `default.tsx`, ponieważ przy pełnym odświeżeniu i zmianie URL na szczegóły produktu Next.js musi wiedzieć, co renderować w nieaktywnych slotach.
- **Intercepting Routes (@modal):** Kliknięcie zdjęcia produktu wyzwala ścieżkę przechwytującą `(..)img/[id]`, ładując zoptymalizowany podgląd zdjęcia bez gubienia tła. Odświeżenie przenosi nas na samodzielną podstronę ze zdjęciem.
- **Dynamic Catch-all (`[[...slug]]`):** W sekcji `/catalog` zaprezentowano różnicę dla tablicy ścieżek URL, reagując dynamicznie na wejścia np. `/catalog/gpu/25`.
- **generateStaticParams:** Wygenerowano prerenderowany HTML w trakcie builda dla identyfikatorów 1, 2, 3.
- **Tailwind CSS v4:** Wdrożono nową konfigurację i ostylowano katalog nowymi klasami Tailwind, zachowując bezwzględnie zasady dostępności, layoutu i RWD.

## Laboratorium 08 - PostgreSQL i Prisma

### Pytania do wyjaśnienia (Sekcja 3, 4, 6 i 7)
1. **Czym różnią się kontener, wolumen i baza? Dlaczego localhost ma inne znaczenie?**
   Kontener to izolowane środowisko uruchomieniowe (proces). Wolumen to trwała przestrzeń dyskowa, na której kontener zapisuje dane (aby przetrwały restart). Baza to usługa (np. PostgreSQL) uruchomiona w kontenerze operująca na tych plikach. `localhost` wywoływane w systemie gospodarza (hoście) uderza w zmapowany port Dockerowy, a wewnątrz innej sieci Dockerowej `localhost` to wnętrze tylko i wyłącznie własnego kontenera (dlatego inne kontenery komunikują się po nazwie serwisu np. `postgres`).
2. **Co robi konfiguracja CLI, generator i adapter uruchomieniowy?**
   Konfiguracja CLI wskazuje ścieżkę do bazy i folderów, aby `npx prisma` wiedziało, skąd czytać schematy. Generator kompiluje pliki typu TypeScript na podstawie modeli, a adapter (tu `@prisma/adapter-pg`) tłumaczy zapytania Prisma na odpowiednie komendy czystego klienta bazy danych (pg). Typy wygenerowanego klienta gwarantują poprawność obiektów w TS, ale walidacja SQL (np. check dodatniej ceny) broni warstwy fizycznej przed obejściem typowania na produkcji.
3. **Czym różnią się migracja, generowanie klienta i seed?**
   Migracja zmienia fizycznie strukturę tabel w SQL, generowanie klienta uaktualnia podpowiedzi składni (typy) w TypeScript po stronie kodu, a seed to skrypt ładujący dane początkowe. Powtarzalność seeda (upsert) gwarantuje, że podwójne odpalenie nie zdubluje wierszy, a zastosowanie transakcji chroni przed załadowaniem do połowy po zerwaniu procesu.
4. **Co po zmianie adaptera pozostaje częścią kontraktu repozytorium?**
   Pojęcia takie jak "stan ujemny to niedostępny" oraz mapowanie kluczy asynchronicznych Promise. Zmienia się wewnętrzne filtrowanie z JS-a w pamięci RAM na klauzule `where` odsyłane do bazy danych. Poprawny zapis do bazy nie renderuje zmian w przeglądarce natychmiast, ponieważ Next.js agresywnie cache'uje zapytania. Funkcja `connection()` w Next.js wymusza odczekanie i odczyt z bazy (rezygnując z cache).

### Rozszerzenia (Wszystkie)
- **Model koszyka (Better Auth):** Dodano `User`, `Cart` i `CartItem`. Skonfigurowano powiązania `Cascade` i `Restrict` oraz dodano `CHECK (quantity BETWEEN 1 AND 99)` w migracji SQL. Zrealizowano również dodanie fikcyjnego konta przez Prisma seed.
- **Historia zamówień:** Dodano modele `Order` oraz `OrderItem` (wzór snapshotu) przypisane do relacji z `User`. Zrobiono `SetNull` chroniący zamówienia po usunięciu produktu. Nałożono ograniczenia dodatniej ilości i ceny z zabezpieczeniem historycznym w groszach.
- **Indeksy i zapytania (EXPLAIN):** Utworzono kompozytowy index `@@index([categoryId, amount])` w Prismie ułatwiający filtrowanie. Narzędzie `EXPLAIN ANALYZE` po potwierdzeniu z logu Dockerowego pokazuje skokową poprawę wyliczania rzędów przy większych pulach.
- **Zapis współbieżny:** Utworzono skrypt `scripts/concurrent-test.ts` wywołujący dwie konkurujące ze sobą aktualizacje ilości towaru (Update w atomowej konstrukcji `SET amount = amount - 1 ... AND amount > 0`). Dokładnie jedno z wywołań blokuje transakcję w przypadku ostatniej sztuki asortymentu chroniąc tabelę SQL.
