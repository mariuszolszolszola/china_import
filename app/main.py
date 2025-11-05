from __future__ import annotations

import json
import os
import threading
import base64
import secrets
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

# TODO: Basic Auth (przygotowanie)
# from fastapi import Depends
# from fastapi.security import HTTPBasic, HTTPBasicCredentials
# security = HTTPBasic()
# def get_current_user(credentials: HTTPBasicCredentials = Depends(security)):
#     # TODO: zweryfikuj użytkownika (hash hasła)
#     return credentials.username

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

# Wczytaj zmienne środowiskowe z pliku .env w katalogu głównym (bez zależności zewnętrznych)
def _load_env_from_file():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    try:
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            key, sep, value = line.partition("=")
            if sep != "=":
                continue
            k = key.strip()
            v = value.strip()
            # Usuń otaczające cudzysłowy, jeśli są
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            # Rozwiń sekwencje \n (np. w PRIVATE_KEY)
            v = v.replace("\\n", "\n")
            os.environ.setdefault(k, v)
    except Exception:
        # Ignoruj błędy parsowania
        pass

_load_env_from_file()
# Brak lokalnego zapisu – dane wyłącznie w pamięci (in-memory)
_data_lock = threading.Lock()
_mem_data: List[Dict[str, Any]] = []

def _load_data() -> List[Dict[str, Any]]:
    # Zwracamy kopię płytką listy, aby uniknąć modyfikowania globalnego stanu poza lockiem
    with _data_lock:
        return [dict(item) for item in _mem_data]

def _save_data(data: List[Dict[str, Any]]) -> None:
    # Aktualizacja wyłącznie w pamięci
    global _mem_data
    with _data_lock:
        _mem_data = [dict(item) for item in data]

def _next_id() -> int:
    # millisecond timestamp based id
    return int(datetime.now().timestamp() * 1000)

def _calc_pickup_date(order_date: Optional[str], production_days: Optional[str]) -> Optional[str]:
    if not order_date or not production_days:
        return None
    try:
        dt = datetime.strptime(order_date, "%Y-%m-%d")
        days = int(float(production_days))
        return (dt + timedelta(days=days)).strftime("%Y-%m-%d")
    except Exception:
        return None

def _get_short_sha() -> Optional[str]:
    # Preferowane zmienne środowiskowe (Vercel/CI)
    sha = (
        os.environ.get("VERCEL_GIT_COMMIT_SHA")
        or os.environ.get("GIT_COMMIT_SHA")
        or os.environ.get("SHORT_SHA")
        or os.environ.get("COMMIT_SHA")
    )
    if sha:
        return str(sha)[:7]
    # Fallback lokalny – jeśli dostępny git w repo
    try:
        out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.STDOUT)
        return out.decode("utf-8").strip()
    except Exception:
        return None

# Google Sheets (service account) integration
SHEET_CONTAINERS_TITLE = os.environ.get("SHEET_CONTAINERS_TITLE", "containers")
SHEET_PRODUCTS_TITLE = os.environ.get("SHEET_PRODUCTS_TITLE", "products")
SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SHEETS_SYNC_ON_WRITE = os.environ.get("SHEETS_SYNC_ON_WRITE", "1")  # "1" = append to Sheets on create/add

# Google Drive (service account) integration
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
DRIVE_PUBLIC = os.environ.get("DRIVE_PUBLIC", "1")  # "1" = set file permission to public reader
DRIVE_SUPPORTS_ALL = os.environ.get("DRIVE_SUPPORTS_ALL", "0")  # "1" if using shared drives
DRIVE_ROOT_FOLDER_ID = os.environ.get("FOLDER_ID") or os.environ.get("DRIVE_FOLDER_ID")

def _get_service_account_info() -> Optional[Dict[str, Any]]:
    if not os.environ.get("CLIENT_EMAIL") or not os.environ.get("PRIVATE_KEY"):
        return None
    info = {
        "type": os.environ.get("TYPE", "service_account"),
        "project_id": os.environ.get("PROJECT_ID", ""),
        "private_key_id": os.environ.get("PRIVATE_KEY_ID", ""),
        "private_key": os.environ.get("PRIVATE_KEY", "").replace("\\n", "\n"),
        "client_email": os.environ.get("CLIENT_EMAIL", ""),
        "client_id": os.environ.get("CLIENT_ID", ""),
        "auth_uri": os.environ.get("AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
        "token_uri": os.environ.get("TOKEN_URI", "https://oauth2.googleapis.com/token"),
        "auth_provider_x509_cert_url": os.environ.get("AUTH_PROVIDER_X509_CERT_URL", "https://www.googleapis.com/oauth2/v1/certs"),
        "client_x509_cert_url": os.environ.get("CLIENT_X509_CERT_URL", ""),
        "universe_domain": os.environ.get("UNIVERSE_DOMAIN", "googleapis.com"),
    }
    return info

def _get_gspread_client():
    # cache – jeśli klient już został utworzony wcześniej w tym procesie
    try:
        cached = globals().get("_GSPREAD_CLIENT")
        if cached is not None:
            return cached
    except Exception:
        pass

    # Lazy import
    try:
        import gspread  # type: ignore
    except Exception as e:
        print(f"[Sheets] Import gspread failed: {e}")
        return None

    info = _get_service_account_info()
    if not info:
        print("[Sheets] Service account info missing (CLIENT_EMAIL/PRIVATE_KEY not set)")
        return None

    # Standard creation
    try:
        client = gspread.service_account_from_dict(info, scopes=SHEETS_SCOPES)
        globals()["_GSPREAD_CLIENT"] = client
        return client
    except Exception as e1:
        print(f"[Sheets] service_account_from_dict failed: {e1}")

    # Fallback: Credentials.from_service_account_info
    try:
        from google.oauth2.service_account import Credentials  # type: ignore
        creds = Credentials.from_service_account_info(info, scopes=SHEETS_SCOPES)
        client = gspread.authorize(creds)
        globals()["_GSPREAD_CLIENT"] = client
        return client
    except Exception as e2:
        print(f"[Sheets] Credentials fallback failed: {e2}")

    # Final fallback wyłączony – brak lokalnego zapisu do plików
    return None

def _sheet_records(title: str):
    client = _get_gspread_client()
    file_id = os.environ.get("FILE_ID")
    if not client or not file_id:
        return []
    try:
        sh = client.open_by_key(file_id)
        ws = sh.worksheet(title)
        # Use header row to map to dict
        return ws.get_all_records()
    except Exception:
        return []

def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "y", "t", "x", "✓")

def _map_sheet_container(rec: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": str(rec.get("name", "")).strip(),
        "orderDate": str(rec.get("orderDate", "")).strip(),
        "paymentDate": (str(rec.get("paymentDate", "")).strip() or None),
        "productionDays": str(rec.get("productionDays", "")).strip(),
        "deliveryDate": (str(rec.get("deliveryDate", "")).strip() or None),
        "exchangeRate": str(rec.get("exchangeRate", "4.0")).strip() or "4.0",
        "containerCost": str(rec.get("containerCost", "")).strip(),
        "containerCostCurrency": str(rec.get("containerCostCurrency", "USD")).strip() or "USD",
        "customsClearanceCost": str(rec.get("customsClearanceCost", "")).strip(),
        "customsClearanceCostCurrency": str(rec.get("customsClearanceCostCurrency", "USD")).strip() or "USD",
        "transportChinaCost": str(rec.get("transportChinaCost", "")).strip(),
        "transportChinaCostCurrency": str(rec.get("transportChinaCostCurrency", "USD")).strip() or "USD",
        "transportPolandCost": str(rec.get("transportPolandCost", "")).strip(),
        "transportPolandCostCurrency": str(rec.get("transportPolandCostCurrency", "USD")).strip() or "USD",
        "insuranceCost": str(rec.get("insuranceCost", "")).strip(),
        "insuranceCostCurrency": str(rec.get("insuranceCostCurrency", "USD")).strip() or "USD",
        "totalTransportCbm": str(rec.get("totalTransportCbm", "")).strip(),
        "additionalCosts": str(rec.get("additionalCosts", "")).strip(),
        "additionalCostsCurrency": str(rec.get("additionalCostsCurrency", "USD")).strip() or "USD",
        "pickedUpInChina": _truthy(rec.get("pickedUpInChina", False)),
        "customsClearanceDone": _truthy(rec.get("customsClearanceDone", False)),
        "deliveredToWarehouse": _truthy(rec.get("deliveredToWarehouse", False)),
        "documentsInSystem": _truthy(rec.get("documentsInSystem", False)),
    }

def _map_sheet_product(rec: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": str(rec.get("name", "")).strip(),
        "quantity": str(rec.get("quantity", "")).strip(),
        "totalPrice": str(rec.get("totalPrice", "")).strip(),
        "totalPriceCurrency": str(rec.get("totalPriceCurrency", "USD")).strip() or "USD",
        "productCbm": str(rec.get("productCbm", "")).strip(),
        "customsDutyPercent": str(rec.get("customsDutyPercent", "")).strip(),
    }

# Domyślne nagłówki w arkuszach
HEADERS_CONTAINERS = [
    "name","orderDate","paymentDate","productionDays","deliveryDate","exchangeRate",
    "containerCost","containerCostCurrency","customsClearanceCost","customsClearanceCostCurrency",
    "transportChinaCost","transportChinaCostCurrency","transportPolandCost","transportPolandCostCurrency",
    "insuranceCost","insuranceCostCurrency","totalTransportCbm","additionalCosts","additionalCostsCurrency",
    "pickedUpInChina","customsClearanceDone","deliveredToWarehouse","documentsInSystem"
]
HEADERS_PRODUCTS = [
    "name","quantity","totalPrice","totalPriceCurrency","productCbm","customsDutyPercent","containerName","containerId"
]

def _sheet_get_headers(ws):
    try:
        header = ws.row_values(1)
    except Exception:
        header = []
    return [str(h).strip() for h in header if str(h).strip()]

def _sheet_ensure_headers(ws, default_headers):
    header = _sheet_get_headers(ws)
    if not header:
        try:
            ws.append_row(default_headers, value_input_option="RAW")
            header = _sheet_get_headers(ws)
        except Exception:
            pass
    return header if header else default_headers

def _sheet_append_row_dynamic(title: str, default_headers: List[str], record: Dict[str, Any]) -> bool:
    # Upewnij się, że zmienne z .env są załadowane w bieżącym procesie
    _load_env_from_file()
    client = _get_gspread_client()
    file_id = os.environ.get("FILE_ID")

    # Diagnostyka przyczyn braku klienta / FILE_ID
    if client is None:
        info = _get_service_account_info()
        print(f"[Sheets] Client missing; SERVICE_ACCOUNT={'OK' if info else 'MISSING'} (***REMOVED***")
    if not file_id:
        print("[Sheets] FILE_ID missing or empty")

    if not client or not file_id:
        print(f"[Sheets] Skip append for '{title}' due to missing config")
        return False

    try:
        sh = client.open_by_key(file_id)
        try:
            ws = sh.worksheet(title)
        except Exception:
            print(f"[Sheets] Worksheet '{title}' not found. Creating...")
            try:
                ws = sh.add_worksheet(title=title, rows=100, cols=max(1, len(default_headers)))
            except Exception as e:
                print(f"[Sheets] Failed to create worksheet '{title}': {e}")
                return False
        headers = _sheet_ensure_headers(ws, default_headers)
        row = []
        for h in headers:
            row.append(record.get(h, ""))
        ws.append_row(row, value_input_option="USER_ENTERED")
        print(f"[Sheets] Appended 1 row to '{title}'")
        return True
    except Exception as e:
        print(f"[Sheets] Append failed for '{title}': {e}")
        return False

def _on_created_container_sync_to_sheet(container: Dict[str, Any]) -> bool:
    if SHEETS_SYNC_ON_WRITE != "1":
        print("[Sheets] Sync disabled (SHEETS_SYNC_ON_WRITE!=1)")
        return False
    rec = {**container}
    rec.pop("id", None)
    rec.pop("products", None)
    ok = _sheet_append_row_dynamic(SHEET_CONTAINERS_TITLE, HEADERS_CONTAINERS, rec)
    print(f"[Sheets] Container sync {'OK' if ok else 'FAILED'}")
    return ok

def _on_added_product_sync_to_sheet(container: Dict[str, Any], product: Dict[str, Any]) -> bool:
    if SHEETS_SYNC_ON_WRITE != "1":
        print("[Sheets] Sync disabled (SHEETS_SYNC_ON_WRITE!=1)")
        return False
    rec = {**product}
    rec.pop("id", None)
    rec["containerName"] = container.get("name", "")
    rec["containerId"] = container.get("id")
    ok = _sheet_append_row_dynamic(SHEET_PRODUCTS_TITLE, HEADERS_PRODUCTS, rec)
    print(f"[Sheets] Product sync {'OK' if ok else 'FAILED'} (containerId={rec['containerId']})")
    return ok

class ProductIn(BaseModel):
    name: str
    quantity: str
    totalPrice: str
    totalPriceCurrency: str = "USD"
    productCbm: str = ""
    customsDutyPercent: str = ""
    files: List[str] = Field(default_factory=list)

class Product(ProductIn):
    id: int = Field(default_factory=_next_id)

class ContainerIn(BaseModel):
    name: str
    orderDate: str
    productionDays: str
    exchangeRate: str = "4.0"

    paymentDate: Optional[str] = None
    deliveryDate: Optional[str] = None

    containerCost: str = ""
    containerCostCurrency: str = "USD"

    customsClearanceCost: str = ""
    customsClearanceCostCurrency: str = "USD"

    transportChinaCost: str = ""
    transportChinaCostCurrency: str = "USD"

    transportPolandCost: str = ""
    transportPolandCostCurrency: str = "USD"

    insuranceCost: str = ""
    insuranceCostCurrency: str = "USD"

    totalTransportCbm: str = ""
    additionalCosts: str = ""
    additionalCostsCurrency: str = "USD"

    pickedUpInChina: bool = False
    customsClearanceDone: bool = False
    deliveredToWarehouse: bool = False
    documentsInSystem: bool = False

class Container(ContainerIn):
    id: int = Field(default_factory=_next_id)
    pickupDate: Optional[str] = None
    products: List[Product] = Field(default_factory=list)

class ContainerUpdate(BaseModel):
    # wszystkie pola opcjonalne; aktualizacja częściowa
    name: Optional[str] = None
    orderDate: Optional[str] = None
    productionDays: Optional[str] = None
    exchangeRate: Optional[str] = None

    paymentDate: Optional[str] = None
    deliveryDate: Optional[str] = None

    containerCost: Optional[str] = None
    containerCostCurrency: Optional[str] = None

    customsClearanceCost: Optional[str] = None
    customsClearanceCostCurrency: Optional[str] = None

    transportChinaCost: Optional[str] = None
    transportChinaCostCurrency: Optional[str] = None

    transportPolandCost: Optional[str] = None
    transportPolandCostCurrency: Optional[str] = None

    insuranceCost: Optional[str] = None
    insuranceCostCurrency: Optional[str] = None

    totalTransportCbm: Optional[str] = None
    additionalCosts: Optional[str] = None
    additionalCostsCurrency: Optional[str] = None

    pickedUpInChina: Optional[bool] = None
    customsClearanceDone: Optional[bool] = None
    deliveredToWarehouse: Optional[bool] = None
    documentsInSystem: Optional[bool] = None

    # pickupDate wyliczamy automatycznie na podstawie orderDate + productionDays

app = FastAPI(title="Import Tracker API", version="0.1.0")

# CORS – w razie potrzeby (gdyby statyki były serwowane z innego hosta)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # w produkcji zawęzić!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic Auth middleware (global)
# Wymagane w .env: BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD
# Opcjonalnie: BASIC_AUTH_EXCLUDE=/api/oauth/callback,/api/oauth/url,/api/health
def _basic_auth_enabled() -> bool:
    _load_env_from_file()
    return bool(os.environ.get("BASIC_AUTH_USERNAME")) and bool(os.environ.get("BASIC_AUTH_PASSWORD"))

def _basic_auth_skip_path(path: str) -> bool:
    exclude = {"/api/oauth/callback", "/api/oauth/url", "/api/health", "/api/version"}
    extra = os.environ.get("BASIC_AUTH_EXCLUDE", "")
    for p in [s.strip() for s in extra.split(",") if s.strip()]:
        exclude.add(p)
    return path in exclude

@app.middleware("http")
async def _basic_auth_middleware(request: Request, call_next):
    try:
        if _basic_auth_skip_path(request.url.path) or not _basic_auth_enabled():
            return await call_next(request)
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Basic "):
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Restricted"'})
        try:
            decoded = base64.b64decode(auth[6:].strip()).decode("utf-8")
            username, password = decoded.split(":", 1)
        except Exception:
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Restricted"'})
        u = os.environ.get("BASIC_AUTH_USERNAME", "")
        p = os.environ.get("BASIC_AUTH_PASSWORD", "")
        if not (secrets.compare_digest(username, u) and secrets.compare_digest(password, p)):
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Restricted"'})
        return await call_next(request)
    except Exception:
        # W razie problemów w middleware nie blokuj ruchu
        return await call_next(request)

# Serwowanie plików statycznych
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=False), name="static")

# Endpoint wersji – zwraca short SHA commita i środowisko
@app.get("/api/version")
def api_version() -> Dict[str, Any]:
    _load_env_from_file()
    sha = _get_short_sha()
    env = os.environ.get("VERCEL_ENV") or ("production" if os.environ.get("VERCEL") else "development")
    return {
        "version": sha or "local",
        "shortSha": sha or None,
        "env": env,
        "serverTime": datetime.utcnow().isoformat() + "Z",
    }

# Upload plików produktów → Google Drive
@app.post("/api/files/upload")
async def upload_product_file(productName: str = Form(...), file: UploadFile = File(...)):
    """
    Upload WYŁĄCZNIE do Google Drive przez OAuth użytkownika (My Drive).
    Wymagane .env: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN.
    Folder docelowy: FOLDER_ID; jeśli puste lub 'root' – użyty zostanie folder wynikający z FILE_ID:
      - jeśli FILE_ID to folder → on będzie rootem,
      - jeśli FILE_ID to arkusz → użyty zostanie jego folder nadrzędny.
    """
    import re
    import io

    def sanitize(s: str) -> str:
        s = re.sub(r"[^\w\-. ]", "_", s)
        s = s.strip().replace(" ", "_")
        return s[:100] or "file"

    # Konfiguracja
    _load_env_from_file()
    env_root_id = os.environ.get("FOLDER_ID") or os.environ.get("DRIVE_FOLDER_ID") or DRIVE_ROOT_FOLDER_ID
    file_id_sheet = os.environ.get("FILE_ID")

    client_id = os.environ.get("OAUTH_CLIENT_ID")
    client_secret = os.environ.get("OAUTH_CLIENT_SECRET")
    refresh_token = os.environ.get("OAUTH_REFRESH_TOKEN")
    token_uri = os.environ.get("OAUTH_TOKEN_URI", "https://oauth2.googleapis.com/token")
    if not client_id or not client_secret or not refresh_token:
        raise HTTPException(status_code=500, detail="Brak konfiguracji OAuth (wymagane: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN)")

    # Dane pliku
    folder_name = sanitize(productName or "product")
    filename = sanitize(getattr(file, "filename", "file"))
    content_type = file.content_type or "application/octet-stream"
    content = await file.read()
    await file.close()

    try:
        # OAuth Credentials użytkownika
        from google.oauth2.credentials import Credentials  # type: ignore
        from google.auth.transport.requests import Request  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.http import MediaIoBaseUpload  # type: ignore
        from googleapiclient.errors import HttpError  # type: ignore

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=DRIVE_SCOPES,
        )
        try:
            creds.refresh(Request())
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OAuth refresh failed: {e}")

        service = build("drive", "v3", credentials=creds, cache_discovery=False)

        # Ustal folder bazowy (root) zgodnie z FOLDER_ID/FILE_ID
        root_id = env_root_id
        try:
            if not root_id or str(root_id).lower() == "root":
                if file_id_sheet:
                    meta = service.files().get(fileId=file_id_sheet, fields="id,mimeType,parents").execute()
                    mime = meta.get("mimeType")
                    parents = meta.get("parents", []) or []
                    if mime == "application/vnd.google-apps.folder":
                        root_id = file_id_sheet
                    else:
                        if parents:
                            root_id = parents[0]
        except Exception as re_err:
            print(f"[Drive] Resolve parent of FILE_ID failed: {re_err}")
        if not root_id:
            root_id = "root"
        # Weryfikacja dostępu do folderu root_id dla użytkownika OAuth; w razie braku dostępu – fallback do 'root'
        try:
            if root_id and str(root_id).lower() != "root":
                # sprawdź czy folder istnieje i jest dostępny
                service.files().get(fileId=root_id, fields="id").execute()
        except HttpError as he:
            # typowo: 404 'File not found' lub 403 'insufficientFilePermissions'
            try:
                err_msg = he.content.decode("utf-8") if isinstance(he.content, (bytes, bytearray)) else str(he.content)
            except Exception:
                err_msg = str(he)
            print(f"[Drive] Root folder '{root_id}' niedostępny dla konta OAuth – fallback do 'root': {err_msg}")
            root_id = "root"
        except Exception as ge:
            print(f"[Drive] Root folder check failed ({ge}) – fallback do 'root'")
            root_id = "root"

        # Znajdź/utwórz podfolder na nazwę produktu
        q = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and '{root_id}' in parents and trashed=false"
        resp = service.files().list(q=q, fields="files(id,name)", pageSize=1).execute()
        files_list = resp.get("files", [])
        if files_list:
            subfolder_id = files_list[0]["id"]
        else:
            meta_folder = {
                "name": folder_name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [root_id],
            }
            created_folder = service.files().create(body=meta_folder, fields="id,name,parents").execute()
            subfolder_id = created_folder["id"]

        # Upload pliku do My Drive
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=content_type, resumable=False)
        file_meta = {
            "name": filename,
            "parents": [subfolder_id],
            "mimeType": content_type,
        }
        created = service.files().create(
            body=file_meta,
            media_body=media,
            fields="id,name,webViewLink,webContentLink"
        ).execute()

        file_id = created.get("id")
        web_view = (created.get("webViewLink") or "")
        web_content = (created.get("webContentLink") or "")

        # Publiczne uprawnienia (opcjonalnie)
        try:
            if DRIVE_PUBLIC == "1" and file_id:
                perm_body = {"type": "anyone", "role": "reader"}
                service.permissions().create(fileId=file_id, body=perm_body).execute()
        except Exception as pe:
            print(f"[Drive] Permission set failed (ignored): {pe}")

        # URL do pobrania
        url = web_content or (f"https://drive.google.com/uc?export=download&id={file_id}" if file_id else web_view or "")
        return {
            "url": url,
            "fileId": file_id,
            "folderId": subfolder_id,
            "filename": filename,
            "size": len(content),
        }
    except Exception as e:
        try:
            from googleapiclient.errors import HttpError  # type: ignore
        except Exception:
            HttpError = None  # type: ignore
        if HttpError and isinstance(e, HttpError):
            status = getattr(e, "status_code", None) or (getattr(e, "resp", None).status if getattr(e, "resp", None) is not None else None)
            try:
                err_content = e.content.decode("utf-8") if isinstance(e.content, (bytes, bytearray)) else str(e.content)
            except Exception:
                err_content = str(e)
            raise HTTPException(status_code=500, detail=f"Drive HttpError (status={status}): {err_content}")
        raise HTTPException(status_code=500, detail=f"Nie udało się przesłać pliku do Google Drive (OAuth): {e}")

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Diagnostyka Google Drive – sprawdzenie konfiguracji i dostępu
# [removed duplicate drive_status definition]

# Diagnostyka Google Drive – sprawdzenie konfiguracji i dostępu
# [removed duplicate drive_status definition]

# Diagnostyka Google Drive – sprawdzenie konfiguracji i dostępu
@app.get("/api/drive/status")
def drive_status() -> Dict[str, Any]:
    _load_env_from_file()
    info = _get_service_account_info()
    root_id = os.environ.get("FOLDER_ID") or os.environ.get("DRIVE_FOLDER_ID") or DRIVE_ROOT_FOLDER_ID

    out: Dict[str, Any] = {
        "has_service_account": bool(info),
        "root_folder_id_set": bool(root_id),
        "supports_all_drives": DRIVE_SUPPORTS_ALL,
        "drive_public": DRIVE_PUBLIC,
        "service_built": False,
    }

    if not info:
        out["error"] = "Brak danych service account (CLIENT_EMAIL/PRIVATE_KEY)"
        return out
    if not root_id:
        out["error"] = "FOLDER_ID (DRIVE_ROOT_FOLDER_ID) nie ustawiony w .env"
        return out

    try:
        from google.oauth2.service_account import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
    except Exception as e:
        out["error"] = f"Pakiet Google Drive API nie jest zainstalowany: {e}"
        return out

    try:
        creds = Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)
        service = build("drive", "v3", credentials=creds)
        out["service_built"] = True
    except Exception as e:
        out["error"] = f"Nie udało się utworzyć klienta Drive: {e}"
        return out

    flags_get = {"supportsAllDrives": True} if DRIVE_SUPPORTS_ALL == "1" else {}
    try:
        meta = service.files().get(fileId=root_id, fields="id,name,driveId,parents", **flags_get).execute()
        out["root"] = {k: meta.get(k) for k in ("id", "name", "driveId", "parents")}
    except Exception as e:
        out["root_error"] = str(e)

    flags_list = {"supportsAllDrives": True, "includeItemsFromAllDrives": True} if DRIVE_SUPPORTS_ALL == "1" else {}
    try:
        q = f"'{root_id}' in parents and trashed=false"
        resp = service.files().list(q=q, fields="files(id,name,mimeType)", pageSize=10, **flags_list).execute()
        files = resp.get("files", [])
        out["children_count"] = len(files)
        out["children_sample"] = files
    except Exception as e:
        out["children_error"] = str(e)

    return out

@app.get("/api/containers")
def list_containers() -> List[Container]:
    data = _load_data()
    return data

@app.post("/api/containers", status_code=201)
def create_container(payload: ContainerIn) -> Container:
    c = Container(**payload.dict())
    c.pickupDate = _calc_pickup_date(c.orderDate, c.productionDays)
    data = _load_data()
    data.append(c.dict())
    _save_data(data)
    # zapis do Google Sheets (append); ignoruj błędy
    try:
        _on_created_container_sync_to_sheet(c.dict())
    except Exception:
        pass
    return c.dict()

@app.put("/api/containers/{container_id}")
def update_container(container_id: int, payload: ContainerUpdate) -> Container:
    data = _load_data()
    for i, item in enumerate(data):
        if int(item.get("id")) == container_id:
            # zachowaj products
            products = item.get("products", [])
            # zaktualizuj pola
            updated = {**item, **{k: v for k, v in payload.dict(exclude_unset=True).items()}}
            # przelicz pickupDate jeśli dotyczy
            orderDate = updated.get("orderDate")
            productionDays = updated.get("productionDays")
            updated["pickupDate"] = _calc_pickup_date(orderDate, productionDays)
            updated["products"] = products
            data[i] = updated
            _save_data(data)
            return updated
    raise HTTPException(status_code=404, detail="Container not found")

# Diagnostyka zapisu do Google Sheets
@app.get("/api/sheets/status")
def sheets_status() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "has_client": False,
        "file_id_set": False,
        "containers_title": SHEET_CONTAINERS_TITLE,
        "products_title": SHEET_PRODUCTS_TITLE,
        "containers_ws_exists": False,
        "products_ws_exists": False,
    }
    try:
        client = _get_gspread_client()
        file_id = os.environ.get("FILE_ID")
        info["has_client"] = client is not None
        info["file_id_set"] = bool(file_id)
        if client and file_id:
            sh = client.open_by_key(file_id)
            try:
                ws_c = sh.worksheet(SHEET_CONTAINERS_TITLE)
                info["containers_ws_exists"] = True
                info["containers_headers"] = _sheet_get_headers(ws_c)
            except Exception as e:
                info["containers_error"] = str(e)
            try:
                ws_p = sh.worksheet(SHEET_PRODUCTS_TITLE)
                info["products_ws_exists"] = True
                info["products_headers"] = _sheet_get_headers(ws_p)
            except Exception as e:
                info["products_error"] = str(e)
        return info
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/sheets/append-test")
def sheets_append_test(target: str = "containers") -> Dict[str, Any]:
    # Prosty test append – dodaje wiersz testowy z timestampem do wybranej zakładki
    from datetime import datetime
    if target == "products":
        rec = {
            "name": "TEST-PROD",
            "quantity": "1",
            "totalPrice": "0",
            "totalPriceCurrency": "USD",
            "productCbm": "",
            "customsDutyPercent": "",
            "timestamp": datetime.utcnow().isoformat(),
        }
        ok = _sheet_append_row_dynamic(SHEET_PRODUCTS_TITLE, HEADERS_PRODUCTS, rec)
        return {"ok": ok, "target": "products"}
    else:
        rec = {
            "name": "TEST",
            "orderDate": "",
            "paymentDate": "",
            "productionDays": "",
            "deliveryDate": "",
            "exchangeRate": "4.0",
            "containerCost": "",
            "containerCostCurrency": "USD",
            "customsClearanceCost": "",
            "customsClearanceCostCurrency": "USD",
            "transportChinaCost": "",
            "transportChinaCostCurrency": "USD",
            "transportPolandCost": "",
            "transportPolandCostCurrency": "USD",
            "insuranceCost": "",
            "insuranceCostCurrency": "USD",
            "totalTransportCbm": "",
            "additionalCosts": "",
            "additionalCostsCurrency": "USD",
            "pickedUpInChina": "",
            "customsClearanceDone": "",
            "deliveredToWarehouse": "",
            "documentsInSystem": "",
            "timestamp": datetime.utcnow().isoformat(),
        }
        ok = _sheet_append_row_dynamic(SHEET_CONTAINERS_TITLE, HEADERS_CONTAINERS, rec)
        return {"ok": ok, "target": "containers"}

@app.delete("/api/containers/{container_id}", status_code=204)
def delete_container(container_id: int):
    data = _load_data()
    new_data = [c for c in data if int(c.get("id")) != container_id]
    if len(new_data) == len(data):
        raise HTTPException(status_code=404, detail="Container not found")
    _save_data(new_data)
    return

@app.post("/api/containers/{container_id}/products", status_code=201)
def add_product(container_id: int, payload: ProductIn) -> Product:
    data = _load_data()
    for i, item in enumerate(data):
        if int(item.get("id")) == container_id:
            p = Product(**payload.dict())
            products = item.get("products", [])
            products.append(p.dict())
            item["products"] = products
            data[i] = item
            _save_data(data)
            # zapis do Google Sheets (append); ignoruj błędy
            try:
                _on_added_product_sync_to_sheet(item, p.dict())
            except Exception:
                pass
            return p.dict()
    raise HTTPException(status_code=404, detail="Container not found")

@app.put("/api/containers/{container_id}/products/{product_id}")
def update_product(container_id: int, product_id: int, payload: ProductIn) -> Product:
    data = _load_data()
    for i, item in enumerate(data):
        if int(item.get("id")) == container_id:
            products = item.get("products", [])
            for j, prod in enumerate(products):
                if int(prod.get("id")) == product_id:
                    # zachowujemy id, resztę nadpisujemy
                    new_prod = {"id": product_id, **payload.dict()}
                    products[j] = new_prod
                    item["products"] = products
                    data[i] = item
                    _save_data(data)
                    return new_prod
            raise HTTPException(status_code=404, detail="Product not found")
    raise HTTPException(status_code=404, detail="Container not found")

@app.delete("/api/containers/{container_id}/products/{product_id}", status_code=204)
def delete_product(container_id: int, product_id: int):
    data = _load_data()
    for i, item in enumerate(data):
        if int(item.get("id")) == container_id:
            products = item.get("products", [])
            new_products = [p for p in products if int(p.get("id")) != product_id]
            if len(new_products) == len(products):
                raise HTTPException(status_code=404, detail="Product not found")
            item["products"] = new_products
            data[i] = item
            _save_data(data)
            return
    raise HTTPException(status_code=404, detail="Container not found")

# Sheets API
@app.get("/api/sheets/containers")
def sheet_containers() -> List[Dict[str, Any]]:
    recs = _sheet_records(SHEET_CONTAINERS_TITLE)
    mapped = [_map_sheet_container(r) for r in recs if isinstance(r, dict) and any(str(v).strip() for v in r.values())]
    return mapped

@app.get("/api/sheets/products")
def sheet_products() -> List[Dict[str, Any]]:
    recs = _sheet_records(SHEET_PRODUCTS_TITLE)
    mapped = [_map_sheet_product(r) for r in recs if isinstance(r, dict) and any(str(v).strip() for v in r.values())]
    return mapped

# Fallback na index.html
@app.get("/")
def index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        # jeśli index nie istnieje, zwróć prosty komunikat
        return {"message": "Static UI not found. Create static/index.html"}
    return FileResponse(str(index_file))

# TODO: Integracja z Google Drive – szkic
# - upload/backup pliku data/containers.json na Drive
# - cron/scheduler lub przy zmianach
# - uwierzytelnienie OAuth 2.0
# - endpoiny: /api/backup, /api/restore

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)