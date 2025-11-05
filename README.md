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

Uwaga: na Vercel system plików jest efemeryczny. Zapisy do plików są dozwolone tylko w `/tmp` (i są nietrwałe). W `app/main.py` zastosowano fallback do `/tmp` na Vercel, lokalnie zapisy są w `./data/containers.json`.

## Struktura

- `static/` – frontend (HTML/CSS/JS)
- `app/main.py` – FastAPI: endpointy CRUD dla kontenerów/produktów, serwowanie statyków lokalnie
- `api/index.py` – entrypoint Vercel Functions (ASGI), `from app.main import app`
- `vercel.json` – konfiguracja Vercel (rewrites)
- `requirements.txt` – zależności Pythona
- `data/containers.json` – lokalny magazyn danych (na Vercel używany jest `/tmp/china_import/containers.json`)

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

- Lokalnie dane są zapisywane w `./data/containers.json`.
- Na Vercel zapisy trafiają do `/tmp/china_import/containers.json` – efemeryczne i znikają po przeładowaniu instancji.
- Docelowo zalecane:
  - Integracja z Google Drive (backup/restore JSON),
  - lub baza (Vercel KV/Postgres) / obiektowe storage (np. S3 kompatybilne).

## Pliki kluczowe

- `app/main.py` – API FastAPI (CRUD, kalkulacje, fallback `/tmp` na Vercel)
- `api/index.py` – `from app.main import app` (ASGI export)
- `vercel.json` – konfiguracja runtime i tras
- `requirements.txt` – FastAPI/Starlette/Uvicorn
- `static/` – frontend

## Znane ograniczenia Vercel Functions

- Limit czasu (domyślnie do 10s – ustawiony w `vercel.json`).
- Cold starty.
- System plików tylko do odczytu (poza `/tmp`).

## Następne kroki

- Basic Auth – dołożyć `HTTPBasic` w FastAPI (guardowanie mutujących endpointów).
- Integracja z Google Drive (backup/restore `containers.json`).
- Ewentualnie migracja trwałego storage do Vercel KV/DB.
