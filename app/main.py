from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

# W Vercel filesystem jest read-only; zapisy dozwolone tylko w /tmp (efemeryczne)
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("NOW_REGION"))
DATA_DIR = Path("/tmp/china_import") if IS_VERCEL else (BASE_DIR / "data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE = DATA_DIR / "containers.json"

# jeśli plik nie istnieje, zainicjalizuj pustą listą
if not DATA_FILE.exists():
    DATA_FILE.write_text("[]", encoding="utf-8")

_file_lock = threading.Lock()

def _load_data() -> List[Dict[str, Any]]:
    with _file_lock:
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

def _save_data(data: List[Dict[str, Any]]) -> None:
    with _file_lock:
        DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

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

class ProductIn(BaseModel):
    name: str
    quantity: str
    totalPrice: str
    totalPriceCurrency: str = "USD"
    productCbm: str = ""
    customsDutyPercent: str = ""

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

# Serwowanie plików statycznych
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=False), name="static")

@app.get("/api/health")
def health():
    return {"status": "ok"}

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