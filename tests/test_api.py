from fastapi.testclient import TestClient
from app import main
from app.main import app
import pytest
from unittest.mock import MagicMock, patch
import os

# Wyłącz append do arkuszy
main.SHEETS_SYNC_ON_WRITE = "0"

# Wyczyść handlery startup, aby nie importować danych
app.router.on_startup.clear()

# Użyj with TestClient(app) w fixture, aby obsłużyć cykl życia aplikacji (startup/shutdown)
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(autouse=True)
def clear_data():
    """Wyczyść dane w pamięci przed każdym testem."""
    # Odwołuj się do zmiennej w module, bo _save_data nadpisuje referencję globalną
    main._mem_data = []
    yield
    main._mem_data = []

def test_create_container(client):
    payload = {
        "name": "Test Container 1",
        "orderDate": "2023-01-01",
        "productionDays": "30",
        "exchangeRate": "4.0"
    }
    response = client.post("/api/containers", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Container 1"
    assert "id" in data
    assert isinstance(data["id"], int)
    # Sprawdź czy pickupDate zostało wyliczone
    assert data["pickupDate"] == "2023-01-31"

def test_update_container(client):
    # 1. Utwórz
    payload = {"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"}
    res_create = client.post("/api/containers", json=payload)
    c_id = res_create.json()["id"]

    # 2. Edytuj
    update_payload = {"name": "C1 Updated", "productionDays": "20"}
    response = client.put(f"/api/containers/{c_id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "C1 Updated"
    assert data["productionDays"] == "20"
    # pickupDate powinno się przeliczyć (10 -> 20 dni)
    assert data["pickupDate"] == "2023-01-21"

def test_add_product(client):
    # 1. Utwórz kontener
    c_res = client.post("/api/containers", json={"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"})
    c_id = c_res.json()["id"]

    # 2. Dodaj produkt
    p_payload = {
        "name": "Product A",
        "quantity": "100",
        "totalPrice": "5000",
        "totalPriceCurrency": "USD"
    }
    response = client.post(f"/api/containers/{c_id}/products", json=p_payload)
    assert response.status_code == 201
    p_data = response.json()
    assert p_data["name"] == "Product A"
    assert "id" in p_data

    # Sprawdź czy produkt jest w kontenerze
    c_get = client.get("/api/containers")
    containers = c_get.json()
    assert len(containers) == 1
    assert len(containers[0]["products"]) == 1
    assert containers[0]["products"][0]["name"] == "Product A"

def test_update_product(client):
    # 1. Utwórz kontener i produkt
    c_res = client.post("/api/containers", json={"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"})
    c_id = c_res.json()["id"]
    
    p_res = client.post(f"/api/containers/{c_id}/products", json={"name": "P1", "quantity": "1", "totalPrice": "10"})
    p_id = p_res.json()["id"]

    # 2. Edytuj produkt
    update_payload = {
        "name": "P1 Updated",
        "quantity": "2",
        "totalPrice": "20",
        "totalPriceCurrency": "USD" # wymagane przez model ProductIn (defaults)
    }
    response = client.put(f"/api/containers/{c_id}/products/{p_id}", json=update_payload)
    assert response.status_code == 200
    p_data = response.json()
    assert p_data["name"] == "P1 Updated"
    assert p_data["quantity"] == "2"
    assert p_data["id"] == p_id  # ID bez zmian

    # Weryfikacja pobrania
    c_get = client.get("/api/containers")
    prod = c_get.json()[0]["products"][0]
    assert prod["name"] == "P1 Updated"

def test_delete_product(client):
    # Setup
    c_res = client.post("/api/containers", json={"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"})
    c_id = c_res.json()["id"]
    p_res = client.post(f"/api/containers/{c_id}/products", json={"name": "P1", "quantity": "1", "totalPrice": "10"})
    p_id = p_res.json()["id"]

    # Delete
    response = client.delete(f"/api/containers/{c_id}/products/{p_id}")
    assert response.status_code == 204

    # Verify
    c_get = client.get("/api/containers")
    assert len(c_get.json()[0]["products"]) == 0

def test_delete_container(client):
    # Setup
    c_res = client.post("/api/containers", json={"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"})
    c_id = c_res.json()["id"]

    # Delete
    response = client.delete(f"/api/containers/{c_id}")
    assert response.status_code == 204

    # Verify
    c_get = client.get("/api/containers")
    assert len(c_get.json()) == 0

def test_update_product_invalid_container_id(client):
    # Test błędu "Container not found"
    response = client.put("/api/containers/999999/products/123", json={"name": "X", "quantity": "1", "totalPrice": "1"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Container not found"

def test_update_product_invalid_product_id(client):
    c_res = client.post("/api/containers", json={"name": "C1", "orderDate": "2023-01-01", "productionDays": "10"})
    c_id = c_res.json()["id"]
    
    response = client.put(f"/api/containers/{c_id}/products/999999", json={"name": "X", "quantity": "1", "totalPrice": "1"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"

def test_upload_file(client):
    # Mocki dla googleapiclient i google.oauth2
    mock_discovery = MagicMock()
    mock_credentials = MagicMock()
    mock_auth = MagicMock()
    
    # Symulacja modułów
    modules = {
        "googleapiclient": MagicMock(),
        "googleapiclient.discovery": mock_discovery,
        "googleapiclient.http": MagicMock(),
        "googleapiclient.errors": MagicMock(),
        "google.oauth2": MagicMock(),
        "google.oauth2.credentials": mock_credentials,
        "google.auth": MagicMock(),
        "google.auth.transport": MagicMock(),
        "google.auth.transport.requests": mock_auth,
    }

    with patch.dict("sys.modules", modules):
        # Konfiguracja mocków
        mock_build = mock_discovery.build
        mock_service = MagicMock()
        mock_build.return_value = mock_service
        
        # Mockowanie operacji na plikach
        # 1. Sprawdzenie/szukanie folderu (list) -> pusta lista (nie znaleziono)
        # 2. Szukanie ponownie w create -> pusta
        mock_service.files.return_value.list.return_value.execute.return_value = {"files": []}
        
        # Mockowanie tworzenia: najpierw folder, potem plik
        mock_service.files.return_value.create.return_value.execute.side_effect = [
            {"id": "folder_123"}, # create folder
            {"id": "file_123", "webViewLink": "http://view", "webContentLink": "http://content"} # create file
        ]

        # Środowisko
        env_vars = {
            "OAUTH_CLIENT_ID": "fake_id",
            "OAUTH_CLIENT_SECRET": "fake_secret",
            "OAUTH_REFRESH_TOKEN": "fake_token",
            "FOLDER_ID": "root"
        }
        
        with patch.dict(os.environ, env_vars):
            response = client.post(
                "/api/files/upload",
                data={"productName": "Test Product"},
                files={"file": ("test.txt", b"dummy content", "text/plain")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["url"] == "http://content"
            assert data["fileId"] == "file_123"
            assert data["filename"] == "test.txt"