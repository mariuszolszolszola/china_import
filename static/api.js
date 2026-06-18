import { state } from './state.js';
import { els } from './dom.js';
import { renderProductContainerSelect, renderContainersList, renderProductsList } from './render.js';
import { showToast, showLoader, hideLoader, fillSheetContainerSelect, fillSheetProductSelect } from './utils.js';

/* Narzędzia API */
export async function api(method, url, body, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: controller.signal };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const isMutate = String(method).toUpperCase() !== "GET";

  const authHeader = () => {
    try {
      if (state && state.auth && state.auth.username != null && state.auth.password != null) {
        return "Basic " + btoa(unescape(encodeURIComponent(String(state.auth.username) + ":" + String(state.auth.password))));
      }
    } catch (_) {}
    return null;
  };

  if (isMutate) {
    const ah = authHeader();
    if (ah) opts.headers["Authorization"] = ah;
  }

  try {
    let res = await fetch(url, opts);
    clearTimeout(id);

    if (res.status === 401 && isMutate) {
      const u = prompt("Login (Basic Auth):") || "";
      const p = prompt("Hasło (Basic Auth):") || "";
      if (u && p) {
        state.auth = { username: u, password: p };
        const ah2 = authHeader();
        if (ah2) {
          opts.headers["Authorization"] = ah2;
          res = await fetch(url, opts);
        }
      }
    }

    if (!res.ok) {
      let msg = "Wystąpił błąd komunikacji z serwerem.";
      try { const data = await res.json(); msg = data?.detail || JSON.stringify(data); } catch (_){}
      if (isMutate) showToast(msg, 'error');
      throw new Error(msg);
    }
    
    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      const msg = "Przekroczono czas oczekiwania na odpowiedź serwera (timeout).";
      if (isMutate) showToast(msg, 'error');
      throw new Error(msg);
    }
    if (isMutate && !err.message.includes('Wystąpił błąd')) showToast(err.message, 'error');
    throw err;
  }
}


export async function loadContainers() {
  console.log("[API] loadContainers() called...");
  try {
    const data = await api("GET", "/api/containers");
    state.containers = Array.isArray(data) ? data : [];
    const totalProducts = state.containers.reduce((sum, c) => sum + (Array.isArray(c.products) ? c.products.length : 0), 0);
    console.log(`[API] loadContainers() OK: ${state.containers.length} containers, ${totalProducts} total products`);
    if (state.containers.length === 0) {
      console.warn("[API] loadContainers(): 0 containers returned — check server logs for Google Sheets errors");
    } else if (totalProducts === 0) {
      console.warn("[API] loadContainers(): containers loaded but 0 products — check server logs for product import errors");
    }
    renderProductContainerSelect();
    renderContainersList();
    renderProductsList();
  } catch (e) {
    console.error("[API] loadContainers() FAILED:", e);
    state.containers = [];
    renderProductContainerSelect();
    renderContainersList();
    renderProductsList();
  }
}