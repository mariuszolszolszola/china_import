# Import Tracker – FastAPI + HTML (Vercel-ready)

py -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000



Aplikacja do śledzenia kontenerów i produktów z przeliczeniami kosztów (PLN/USD) przeniesiona z React/TSX na FastAPI + czyste HTML/CSS/JS, przygotowana do hostingu na Vercel.

## Architektura

- Frontend (statyczny):
  - `/static/index.html`, `/static/styles.css`, `/static/script.js`
  - Na Vercel pliki statyczne są serwowane bezpośrednio z repo.
- Backend (REST API):
  - Serwerless function Python: `api/index.py` eksportuje obiekt `app` z FastAPI.
  - Implementacja API i logika pomocnicza: `app/main.py`.
- Konfiguracja Vercel:
  - `vercel.json` – mapowanie `/api/*` na serwerless, `/` na `static/index.html`.

Uwaga: Brak lokalnej persystencji. Dane kontenerów/produktów utrzymywane są wyłącznie w pamięci procesu (in‑memory) zarówno lokalnie, jak i na Vercel. Uploady plików trafiają wyłącznie do Google Drive przez OAuth użytkownika. Dostępny jest endpoint `/api/version`, który zwraca identyfikator builda (short SHA) oraz środowisko. Szczegóły poniżej.

## Struktura

- `static/` – frontend (HTML/CSS/JS)
- [app/main.py](app/main.py) – FastAPI: endpointy CRUD dla kontenerów/produktów, upload do Google Drive (OAuth), magazyn danych in‑memory, endpoint `/api/version`
- [api/index.py](api/index.py) – entrypoint Vercel Functions (ASGI)
- [vercel.json](vercel.json) – konfiguracja Vercel (rewrites)
- [requirements.txt](requirements.txt) – zależności Pythona
- `.env` – zmienne środowiskowe (np. OAUTH_CLIENT_ID/OAUTH_CLIENT_SECRET/OAUTH_REFRESH_TOKEN, FILE_ID/FOLDER_ID, BASIC_AUTH_USERNAME/BASIC_AUTH_PASSWORD, DRIVE_PUBLIC, APP_BUILD_NUMBER/COMMIT_COUNT)
 
## Lokalny development

1) Zainstaluj zależności:
   - Windows:
     ```
     py -m pip install -r requirements.txt
     ```
   - Unix/macOS:
     ```
     python3 -m pip install -r requirements.txt
     ```

2) Uruchom serwer:
   ```
   py -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

3) Wejdź w przeglądarce:
   - UI: http://127.0.0.1:8000
   - API health-check: http://127.0.0.1:8000/api/health

## Deploy na Vercel

Masz dwie opcje: przez dashboard lub przez CLI.

### A) Przez dashboard

1) Wypchnij repo do GitHub/GitLab/Bitbucket.
2) Wejdź na https://vercel.com – New Project → Importuj repo.
3) Ustawienia projektu:
   - Framework Preset: „Other”
   - Root Directory: `/` (katalog główny repo)
   - Build Command: puste (nie wymagane)
   - Output Directory: puste (statyki są serwowane z repo)
   - Install Command: puste (dla Python Functions Vercel automatycznie zainstaluje `requirements.txt`)
4) Deploy.
5) Test:
   - `https://twoja-domena/` (UI)
   - `https://twoja-domena/api/health` (API)

### B) Przez Vercel CLI

1) Zainstaluj Node.js, następnie:
   ```
   npm i -g vercel
   vercel login
   ```
2) W katalogu repo:
   ```
   vercel
   vercel --prod
   ```
3) Test jak wyżej.

## Konfiguracja Vercel (vercel.json)

- Rewrites:
  - `/api/(.*)` → `api/index.py` (serwerless Python – FastAPI)
  - `/` → `/static/index.html` (strona główna)
- Pliki statyczne z `static/` są serwowane bez dodatkowych reguł (np. `/static/styles.css`).

## Trwałość danych (ważne)

- Brak lokalnej persystencji: dane kontenerów/produktów są utrzymywane wyłącznie w pamięci procesu (in‑memory) w [app/main.py](app/main.py). Resetują się po restarcie instancji (lokalnie i na Vercel).
- Załączniki plików nie są zapisywane lokalnie; upload odbywa się WYŁĄCZNIE do Google Drive przez OAuth użytkownika – endpoint `/api/files/upload` w [app/main.py](app/main.py). Aplikacja nie montuje katalogu `/files` ani nie serwuje lokalnych plików.
- Jeśli potrzebna trwałość danych: rozważ Vercel KV/DB/Postgres lub zewnętrzny storage (np. S3 kompatybilne).

## Wersjonowanie (Version badge)

- Endpoint `/api/version` w [app/main.py](app/main.py) zwraca JSON:
  - `version`/`shortSha` – skrócony SHA commita (na Vercel z `VERCEL_GIT_COMMIT_SHA`, lokalnie fallback do `git rev-parse --short HEAD`),
  - `env` – środowisko (`production`/`preview`/`development` z `VERCEL_ENV`),
  - `serverTime` – czas serwera UTC.
- Opcjonalny numer builda:
  - ustaw `APP_BUILD_NUMBER` lub `COMMIT_COUNT` w env; jeśli dostępny, frontend pokaże “Version <shortSha> (build N)”.
- Frontend wyświetla badge wersji w prawym górnym rogu (zob. [static/index.html](static/index.html), [static/script.js](static/script.js), [static/styles.css](static/styles.css)).

## Produkty i załączniki (Google Drive)

- Upload plików: `/api/files/upload` – pliki są przesyłane wyłącznie do Google Drive (My Drive) w podfolderze o nazwie produktu. Wymaga `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REFRESH_TOKEN`.
- Widok „Produkty”: UI agreguje wszystkie produkty ze wszystkich kontenerów; przycisk „Odśwież produkty” przebudowuje listę na podstawie danych w pamięci.
- Edycja: istniejące produkty można edytować bezpośrednio z widoku „Produkty” lub z kafelka kontenera; po zapisaniu dane są aktualizowane w pamięci procesu (bez lokalnej persystencji).
- Załączniki: dla każdego produktu prezentowane są linki do plików na Google Drive; przycisk „Pobierz pliki” otwiera wszystkie powiązane adresy w nowych kartach przeglądarki.
- Funkcje „Import z folderów” (skanowanie Drive) zostały usunięte z UI i dokumentacji.

## UX – waluty i redesign

- Usunięto przyciski PLN/USD z nagłówka; wybór waluty (PLN/USD) jest dostępny jako kompaktowy select przy liście kontenerów. Domyślnie PLN.
- Redesign kart i headera: uproszczony header (tytuł + akcje po prawej), wyrównany spacing, wzmocniony kontrast kart i metadanych, spójne akcenty kolorystyczne.

## Pliki kluczowe

- [app/main.py](app/main.py) – API FastAPI (CRUD, kalkulacje, in‑memory store, upload do Google Drive, endpoint `/api/version`)
- [api/index.py](api/index.py) – ASGI export (Vercel Functions)
- [vercel.json](vercel.json) – konfiguracja runtime i tras
- [requirements.txt](requirements.txt) – FastAPI/Starlette/Uvicorn
- [static/](static/) – frontend

## Znane ograniczenia Vercel Functions

- Limit czasu (domyślnie do 10s – ustawiony w `vercel.json`).
- Cold starty.
- System plików tylko do odczytu (poza `/tmp`).

## Następne kroki

- Basic Auth – włączone w [app/main.py](app/main.py). UI („/” i „/static”) jest publiczne; mutujące API są chronione. Wykluczenia dla wybranych endpointów (np. `/api/version`, `/api/health`, `/api/sheets/*`) dostępne są przez konfigurację.
- Widok „Produkty” – rozbudowa: paginacja, sortowanie, filtry oraz edycja inline.
- Załączniki – pobieranie: obecnie otwieranie linków w kartach; w przyszłości ZIP.
- CI/Deploy (build number):
  - Ustawić `APP_BUILD_NUMBER` lub `COMMIT_COUNT` (np. w GitHub Actions) i propagować jako env do Vercel, aby badge pokazywał “(build N)”.
- Trwałe storage (opcjonalnie):
  - Rozważyć Vercel KV/DB/Postgres lub S3‑kompatybilny storage.

## CI/Build number – automatyczne podbijanie przy każdym commicie

Aby badge w UI pokazywał “Version &lt;shortSHA&gt; (build N)” i N rosło z każdym commitem:
- Backend czyta opcjonalny numer buildu z APP_BUILD_NUMBER lub COMMIT_COUNT (zob. [def api_version()](app/main.py:459)).
- Na Vercel shortSHA jest z `VERCEL_GIT_COMMIT_SHA` (fallback lokalnie to `git rev-parse --short HEAD`).
- Wystarczy, że w czasie deployu ustawisz APP_BUILD_NUMBER/COMMIT_COUNT – poniżej przykład GitHub Actions.

Przykład (GitHub Actions + Vercel CLI):
```yaml
name: Deploy to Vercel
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # potrzebne do policzenia wszystkich commitów
      - name: Calculate commit count and short SHA
        run: |
          echo "COMMIT_COUNT=$(git rev-list --count HEAD)" >> $GITHUB_ENV
          echo "SHORT_SHA=$(git rev-parse --short HEAD)" >> $GITHUB_ENV
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm i -g vercel@latest

      # (Opcja A) Jeśli projekt jest już połączony z Vercel:
      - name: Deploy to Vercel (prod)
        run: >
          vercel --prod --confirm
          --token=${{ secrets.VERCEL_TOKEN }}
          -e APP_BUILD_NUMBER=${{ env.COMMIT_COUNT }}
          -e GIT_COMMIT_SHA=${{ env.SHORT_SHA }}

      # (Opcja B) Gdy chcesz jawnie użyć ustawień projektu:
      # - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      # - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      #   env:
      #     APP_BUILD_NUMBER: ${{ env.COMMIT_COUNT }}
      #     GIT_COMMIT_SHA: ${{ env.SHORT_SHA }}
      # - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
      #   env:
      #     APP_BUILD_NUMBER: ${{ env.COMMIT_COUNT }}
      #     GIT_COMMIT_SHA: ${{ env.SHORT_SHA }}
```

Wymagane sekrety w repo:
- VERCEL_TOKEN – token API Vercel (Project → Settings → Tokens lub Personal Tokens).
- (Opcjonalnie) VERCEL_ORG_ID, VERCEL_PROJECT_ID – gdy używasz ścieżki “pull/build/prebuilt”.

Lokalny development:
- Jeśli chcesz mieć numer buildu w badge lokalnie: uruchom serwer z env, np.:
  - Windows (PowerShell): `setx APP_BUILD_NUMBER 123` i restart terminala, lub `APP_BUILD_NUMBER=123 py -m uvicorn app.main:app --reload`
  - Unix/macOS: `APP_BUILD_NUMBER=123 python3 -m uvicorn app.main:app --reload`
- Gdy `git` nie jest dostępny lokalnie, badge pokaże `Version local`.

Szybki test po deployu:
- Produkcja (Vercel): prawy górny róg strony → “Version abc1234 (build N)”.
- Lokalnie: taki sam tekst oznacza ten sam commit/deploy; inny – różne wersje.

## Produkty i załączniki – skrócony przewodnik

- Upload plików: `POST /api/files/upload` – pliki są przesyłane wyłącznie do Google Drive; po zapisaniu produktu linki są wyświetlane w UI.
- UI: sekcja „Produkty” agreguje wszystkie pozycje; użyj „Odśwież produkty” do przebudowania listy na podstawie stanu.
- Edycja: kliknij „Edytuj” przy produkcie, wprowadź zmiany i wybierz „Zapisz Produkt” – dane aktualizowane są w pamięci procesu (bez lokalnej persystencji).
- Pobieranie załączników: „Pobierz pliki” otwiera wszystkie linki w nowych kartach; przeglądarka może ograniczać liczbę jednoczesnych okien/kart (włącz zezwolenie na wyskakujące okna).

## Zmiany UX

- Usunięto przyciski PLN/USD z nagłówka na rzecz kompaktowego wyboru waluty (select) przy liście kontenerów (domyślnie PLN).
- Usunięto modal i przycisk “Import z folderów”. W ich miejsce dodano sekcję „Produkty” z agregacją wszystkich produktów, edycją oraz pobieraniem załączników.
- Badge wersji w prawym górnym rogu prezentuje “Version &lt;shortSHA&gt; (build N)”, jeśli dostępny APP_BUILD_NUMBER/COMMIT_COUNT.

## Dodatkowe zmiany UX

- Widok kontenerów przebudowano na kafelki (siatka grid) z podsumowaniami: Netto, Brutto, Produkty (zob. [static/styles.css](static/styles.css:200), [renderContainersList()](static/script.js:326)).
- Dodano filtr miesiąca (input type="month" #filterMonth) w nagłówku listy – filtrowanie po miesiącu zamówienia; przycisk “Wyczyść” resetuje filtr (zob. [static/index.html](static/index.html:236), [static/script.js](static/script.js:580)).
- W sekcji kosztów produktu dodano “Netto/szt.” (bez VAT): pricePerUnit + transportPerUnit + (dutyAmount/quantity) + additionalPerUnit, obok “Razem/szt.” (z VAT) (zob. [calculateProductCosts()](static/script.js:192), [renderContainersList()](static/script.js:426)).
