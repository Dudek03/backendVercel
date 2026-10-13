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
