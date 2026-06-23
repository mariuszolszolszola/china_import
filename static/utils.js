import { state } from './state.js';
import { els } from './dom.js';
import { api, loadContainers } from './api.js';

/* UI Utilities (Toasts, Loaders, Dark Mode) */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function showLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.remove('hidden');
}

export function hideLoader() {
  const loader = document.getElementById('globalLoader');
  if (loader) loader.classList.add('hidden');
}

export function initDarkMode() {
  const toggleBtn = document.getElementById('darkModeToggle');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      if (current === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        toggleBtn.textContent = '🌙';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        toggleBtn.textContent = '☀️';
      }
    });
  }
}
export function initTheme() { initDarkMode(); }

/* Pomocnicze */
export function num(v, def = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

export function toUSD(amount, currency, exchangeRate) {
  const a = num(amount, 0);
  const er = num(exchangeRate, 4.0);
  if (currency === "USD") return a;
  return a / er;
}

export function convertPrice(priceUSD, exchangeRate) {
  const er = num(exchangeRate, 4.0);
  if (state.displayCurrency === "PLN") {
    return (priceUSD * er).toFixed(2) + " zł";
  }
  return priceUSD.toFixed(2) + " $";
}

/* Normalizacja daty z inputu (obsługa ręcznie wpisanego formatu dd.mm.rrrr oraz dd-mm-rrrr) */
export function normalizeDateValue(el) {
  const raw = (el && el.value ? String(el.value).trim() : "");
  if (!raw) return "";
  // Usuń spacje (np. "21 . 11 . 2025" → "21.11.2025")
  const v = raw.replace(/\s+/g, "");
  // Jeśli input typu date – zwróci ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Obsłuż format dd.mm.rrrr
  const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  // Obsłuż format dd-mm-rrrr
  const m2 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) {
    const d = m2[1].padStart(2, "0");
    const mo = m2[2].padStart(2, "0");
    const y = m2[3];
    return `${y}-${mo}-${d}`;
  }
  // Inne formaty – zwróć oryginał
  return v;
}

export function fillSheetContainerSelect() {
  const sel = els.sheetContainerSelect;
  if (!sel) return;
  sel.innerHTML = "";
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "— wybierz —";
  sel.appendChild(optEmpty);
  state.sheetContainers.forEach((rec, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = rec.name ? rec.name : `Kontener ${idx + 1}`;
    sel.appendChild(opt);
  });
}

export function fillSheetProductSelect() {
  const sel = els.sheetProductSelect;
  if (!sel) return;
  sel.innerHTML = "";
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "— wybierz —";
  sel.appendChild(optEmpty);
  state.sheetProducts.forEach((rec, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = rec.name ? rec.name : `Produkt ${idx + 1}`;
    sel.appendChild(opt);
  });
}

export async function loadSheets() {
  console.log("[Sheets] loadSheets() called...");
  try {
    const cs = await api("GET", "/api/sheets/containers");
    state.sheetContainers = Array.isArray(cs) ? cs : [];
    console.log(`[Sheets] loadSheets(): ${state.sheetContainers.length} containers from sheet`);
  } catch (e) {
    console.error("[Sheets] loadSheets() containers FAILED:", e);
    state.sheetContainers = [];
  }
  try {
    const ps = await api("GET", "/api/sheets/products");
    state.sheetProducts = Array.isArray(ps) ? ps : [];
    console.log(`[Sheets] loadSheets(): ${state.sheetProducts.length} products from sheet`);
  } catch (e) {
    console.error("[Sheets] loadSheets() products FAILED:", e);
    state.sheetProducts = [];
  }
  fillSheetContainerSelect();
  fillSheetProductSelect();
}

/* Arkusz → pobierz wiersze kontenerów (bez persystencji) */
export async function getSheetContainers() {
  try {
    const cs = await api("GET", "/api/sheets/containers");
    console.log(`[Sheets] getSheetContainers(): ${Array.isArray(cs) ? cs.length : 0} rows`);
    return Array.isArray(cs) ? cs : [];
  } catch (e) {
    console.error("[Sheets] getSheetContainers() FAILED:", e);
    return [];
  }
}

/* Arkusz → pobierz wiersze produktów (bez persystencji) */
export async function getSheetProducts() {
  try {
    const ps = await api("GET", "/api/sheets/products");
    console.log(`[Sheets] getSheetProducts(): ${Array.isArray(ps) ? ps.length : 0} rows`);
    return Array.isArray(ps) ? ps : [];
  } catch (e) {
    console.error("[Sheets] getSheetProducts() FAILED:", e);
    return [];
  }
}

/* Synchronizacja kontenerów z arkusza:
   - replaceExisting=true: usuń wszystkie istniejące kontenery i zaimportuj z arkusza
   - replaceExisting=false: tylko zaimportuj, jeśli lista jest pusta (np. na starcie)
*/
export async function syncContainersFromSheet(replaceExisting = false) {
  // Straż reentrancyjna – zapobiega jednoczesnym wywołaniom
  if (state.isSyncingFromSheet) return;
  state.isSyncingFromSheet = true;
  console.log(`[Sync] syncContainersFromSheet(replace=${replaceExisting}) begin`);
  try {
    const sheetRows = await getSheetContainers();
    console.log(`[Sync] syncContainersFromSheet: ${sheetRows.length} sheet rows`);
    if (!sheetRows.length) {
      console.warn("[Sync] syncContainersFromSheet: 0 rows from sheet — nothing to sync");
      return;
    }

    if (replaceExisting) {
      // Upewnij się, że mamy aktualny stan kontenerów przed kasowaniem
      if (!Array.isArray(state.containers) || state.containers.length === 0) {
        try { await loadContainers(); } catch (e) { console.error("[Sync] loadContainers pre-delete failed:", e); }
      }
      const current = Array.isArray(state.containers) ? state.containers : [];
      console.log(`[Sync] syncContainersFromSheet: deleting ${current.length} existing containers...`);
      for (const c of current) {
        try { await api("DELETE", `/api/containers/${c.id}`); } catch (e) { console.error(`[Sync] Delete container ${c.id} failed:`, e); }
      }
    } else {
      // Jeśli nie wymuszamy podmiany, a lista nie jest pusta – nie rób duplikacji
      const current = Array.isArray(state.containers) ? state.containers : [];
      if (current.length > 0) {
        console.log(`[Sync] syncContainersFromSheet: already have ${current.length} containers, skipping (replaceExisting=false)`);
        return;
      }
    }

    // Utwórz kontenery na podstawie wierszy arkusza
    let created = 0, failed = 0;
    for (const rec of sheetRows) {
      const data = {
        name: rec.name || "",
        orderDate: rec.orderDate || "",
        paymentDate: rec.paymentDate || null,
        productionDays: rec.productionDays || "",
        deliveryDate: rec.deliveryDate || null,
        exchangeRate: rec.exchangeRate || "4.0",

        containerCost: rec.containerCost || "",
        containerCostCurrency: (rec.containerCostCurrency || "USD").trim(),

        customsClearanceCost: rec.customsClearanceCost || "",
        customsClearanceCostCurrency: (rec.customsClearanceCostCurrency || "USD").trim(),

        transportChinaCost: rec.transportChinaCost || "",
        transportChinaCostCurrency: (rec.transportChinaCostCurrency || "USD").trim(),

        transportPolandCost: rec.transportPolandCost || "",
        transportPolandCostCurrency: (rec.transportPolandCostCurrency || "USD").trim(),

        insuranceCost: rec.insuranceCost || "",
        insuranceCostCurrency: (rec.insuranceCostCurrency || "USD").trim(),

        totalTransportCbm: rec.totalTransportCbm || "",
        additionalCosts: rec.additionalCosts || "",
        additionalCostsCurrency: (rec.additionalCostsCurrency || "USD").trim(),

        pickedUpInChina: !!rec.pickedUpInChina,
        customsClearanceDone: !!rec.customsClearanceDone,
        deliveredToWarehouse: !!rec.deliveredToWarehouse,
        documentsInSystem: !!rec.documentsInSystem,
      };
      try {
        // Oznacz import z arkusza, aby backend mógł pominąć append do Sheets
        await api("POST", "/api/containers?source=sheet", data);
        created++;
      } catch (e) {
        failed++;
        console.error(`[Sync] syncContainersFromSheet: failed to create container '${data.name}':`, e);
      }
    }
    console.log(`[Sync] syncContainersFromSheet done: ${created} created, ${failed} failed`);
  } catch (e) {
    console.error("[Sync] syncContainersFromSheet FAILED:", e);
  } finally {
    state.isSyncingFromSheet = false;
  }
}

/* Synchronizacja produktów z arkusza:
   - replaceExisting=true: usuń wszystkie istniejące produkty i zaimportuj z arkusza
   - replaceExisting=false: zaimportuj tylko, jeśli w kontenerach nie ma żadnych produktów
*/
export async function syncProductsFromSheet(replaceExisting = false) {
  if (state.isSyncingProducts) return;
  state.isSyncingProducts = true;
  console.log(`[Sync] syncProductsFromSheet(replace=${replaceExisting}) begin`);
  try {
    // Upewnij się, że mamy kontenery
    if (!Array.isArray(state.containers) || state.containers.length === 0) {
      try { await loadContainers(); } catch (e) { console.error("[Sync] loadContainers pre-sync failed:", e); }
    }

    const sheetRows = await getSheetProducts();
    console.log(`[Sync] syncProductsFromSheet: ${sheetRows.length} sheet rows`);
    if (!sheetRows.length) {
      console.warn("[Sync] syncProductsFromSheet: 0 rows from sheet — nothing to sync");
      return;
    }

    // Jeśli nie wymuszamy podmiany, a istnieją już produkty – nie duplikuj
    const anyProducts = (Array.isArray(state.containers) ? state.containers : [])
      .some(c => Array.isArray(c.products) && c.products.length > 0);
    if (!replaceExisting && anyProducts) {
      console.log("[Sync] syncProductsFromSheet: products already exist, skipping (replaceExisting=false)");
      return;
    }

    // Czyszczenie istniejących produktów (replace)
    if (replaceExisting) {
      const current = Array.isArray(state.containers) ? state.containers : [];
      let deleted = 0;
      for (const c of current) {
        const products = Array.isArray(c.products) ? c.products : [];
        for (const p of products) {
          try { await api("DELETE", `/api/containers/${c.id}/products/${p.id}`); deleted++; } catch (e) { console.error(`[Sync] Delete product ${p.id} failed:`, e); }
        }
      }
      console.log(`[Sync] syncProductsFromSheet: deleted ${deleted} existing products`);
      try { await loadContainers(); } catch (e) { console.error("[Sync] loadContainers post-delete failed:", e); }
    }

    const containers = Array.isArray(state.containers) ? state.containers.slice() : [];
    const byId = new Map(containers.map(c => [String(c.id), c]));
    const byName = new Map(containers.map(c => [String(c.name || "").trim().toLowerCase(), c]));
    console.log(`[Sync] syncProductsFromSheet: matching against ${containers.length} containers, names: [${Array.from(byName.keys()).join(', ')}]`);

    // Dedup: grupuj po nazwie produktu, preferuj rekordy z containerId; unikalnie po (containerId,name).
    const norm = (s) => String(s || "").trim().toLowerCase();
    const groups = new Map();
    for (const rec of sheetRows) {
      const key = norm(rec.name);
      const arr = groups.get(key) || [];
      arr.push(rec);
      groups.set(key, arr);
    }
    const deduped = [];
    for (const [nameKey, arr] of groups.entries()) {
      const withCid = arr.filter(r => r.containerId != null && String(r.containerId).trim() !== "");
      if (withCid.length > 0) {
        const seenCid = new Set();
        for (const r of withCid) {
          const cidS = String(r.containerId).trim();
          if (!seenCid.has(cidS)) {
            seenCid.add(cidS);
            deduped.push(r);
          }
        }
      } else {
        const seenCname = new Set();
        for (const r of arr) {
          const cnameN = norm(r.containerName);
          if (!seenCname.has(cnameN)) {
            seenCname.add(cnameN);
            deduped.push(r);
          }
        }
      }
    }
    console.log(`[Sync] syncProductsFromSheet: ${deduped.length} deduped products to import`);

    let created = 0, failed = 0, unmatched = 0;
    for (const rec of deduped) {
      const cid = rec.containerId != null ? String(rec.containerId).trim() : null;
      const cname = String(rec.containerName || "").trim().toLowerCase();
      let container = (cid && byId.get(cid)) || (cname ? byName.get(cname) : undefined);
      if (!container) {
        // Fallback: przypisz produkt do pierwszego dostępnego kontenera (aby nie skończyć z pustą listą)
        container = containers[0];
        if (!container) {
          unmatched++;
          console.warn(`[Sync] Product '${rec.name}' — no container match (cid=${cid}, cname='${cname}') and no fallback container`);
          continue;
        }
        console.warn(`[Sync] Product '${rec.name}' — no exact container match (cid=${cid}, cname='${cname}'), using fallback '${container.name}'`);
      }
 
      const data = {
        name: rec.name || "",
        quantity: rec.quantity || "",
        totalPrice: rec.totalPrice || "",
        totalPriceCurrency: (rec.totalPriceCurrency || "USD").trim(),
        productCbm: rec.productCbm || "",
        customsDutyPercent: rec.customsDutyPercent || "",
        files: [],
      };
      try {
        // Oznacz import z arkusza, aby backend mógł pominąć append do Sheets
        await api("POST", `/api/containers/${container.id}/products?source=sheet`, data);
        created++;
      } catch (e) {
        failed++;
        console.error(`[Sync] syncProductsFromSheet: failed to create product '${data.name}' in container ${container.id}:`, e);
      }
    }
    console.log(`[Sync] syncProductsFromSheet done: ${created} created, ${failed} failed, ${unmatched} unmatched`);
  } catch (e) {
    console.error("[Sync] syncProductsFromSheet FAILED:", e);
  } finally {
    state.isSyncingProducts = false;
  }
}

export function calculateProductCosts(product, container) {
  const exchangeRate = num(container.exchangeRate, 4.0);
  const totalPriceUSD = toUSD(num(product.totalPrice, 0), product.totalPriceCurrency, exchangeRate);
  const quantity = Math.max(1, num(product.quantity, 1));
  const pricePerUnit = totalPriceUSD / quantity;

  const containerCostUSD = toUSD(num(container.containerCost, 0), container.containerCostCurrency, exchangeRate);
  const customsClearanceCostUSD = toUSD(num(container.customsClearanceCost, 0), container.customsClearanceCostCurrency, exchangeRate);
  const transportChinaCostUSD = toUSD(num(container.transportChinaCost, 0), container.transportChinaCostCurrency, exchangeRate);
  const transportPolandCostUSD = toUSD(num(container.transportPolandCost, 0), container.transportPolandCostCurrency, exchangeRate);
  const insuranceCostUSD = toUSD(num(container.insuranceCost, 0), container.insuranceCostCurrency, exchangeRate);

  const totalTransportCostUSD = containerCostUSD + customsClearanceCostUSD + transportChinaCostUSD + transportPolandCostUSD + insuranceCostUSD;

  const totalCbm = Math.max(1, num(container.totalTransportCbm, 1));
  const productCbm = Math.max(0, num(product.productCbm, 0));
  const costPerCbm = totalTransportCostUSD / totalCbm;
  const transportPerUnit = (costPerCbm * productCbm) / quantity;

  const productValue = totalPriceUSD;
  const transportToEU = (containerCostUSD + transportChinaCostUSD + insuranceCostUSD) * (productCbm / totalCbm);
  const celnaValue = productValue + transportToEU;

  const dutyPercent = Math.max(0, num(product.customsDutyPercent, 0));
  const dutyAmount = celnaValue * (dutyPercent / 100);

  const transportPolandForProduct = transportPolandCostUSD * (productCbm / totalCbm);

  const vatBase = celnaValue + dutyAmount + transportPolandForProduct;
  const vatAmount = vatBase * 0.23;

  const totalCustoms = dutyAmount + vatAmount;

  const additionalCostsUSD = toUSD(num(container.additionalCosts, 0), container.additionalCostsCurrency, exchangeRate);
  const totalProductCbm = (container.products || []).reduce((sum, p) => sum + Math.max(0, num(p.productCbm, 0)), 0) || 1;
  const additionalPerUnit = (additionalCostsUSD * (productCbm / totalProductCbm)) / quantity;

  const totalCostPerUnit = pricePerUnit + transportPerUnit + (totalCustoms / quantity) + additionalPerUnit;

  return {
    pricePerUnit,
    transportPerUnit,
    dutyAmount,
    vatAmount,
    totalCustoms,
    additionalPerUnit,
    totalCostPerUnit,
    quantity,
    productValue,
    dutyPercent,
    celnaValue,
    vatBase,
    transportToEU,
    transportPolandForProduct,
    transportBreakdown: {
      containerCost: containerCostUSD,
      customsClearanceCost: customsClearanceCostUSD,
      transportChinaCost: transportChinaCostUSD,
      transportPolandCost: transportPolandCostUSD,
      insuranceCost: insuranceCostUSD,
      total: totalTransportCostUSD,
    },
  };
}

export function calculateContainerTotals(container) {
  if (!container.products || container.products.length === 0) {
    return { nettoTotal: 0, bruttoTotal: 0, totalProducts: 0 };
  }
  let nettoTotal = 0;
  let bruttoTotal = 0;
  container.products.forEach((product) => {
    const costs = calculateProductCosts(product, container);
    const netto = (costs.pricePerUnit + costs.transportPerUnit + (costs.dutyAmount / costs.quantity) + costs.additionalPerUnit) * costs.quantity;
    const brutto = costs.totalCostPerUnit * costs.quantity;
    nettoTotal += netto;
    bruttoTotal += brutto;
  });
  return {
    nettoTotal,
    bruttoTotal,
    totalProducts: container.products.length,
  };
}

export function getStatusClass(container) {
  // Mapowanie na proste klasy CSS
  if (container.documentsInSystem) return "status-green";
  if (container.deliveredToWarehouse) return "status-green-yellow";
  if (container.customsClearanceDone) return "status-purple";
  if (container.pickedUpInChina) return "status-gray";

  if (!container.pickupDate) return "status-gray-light";
  const today = new Date();
  const pickup = new Date(container.pickupDate);
  const daysUntil = Math.ceil((pickup - today) / (1000 * 60 * 60 * 24));

  if (!container.paymentDate) {
    if (daysUntil < 0) return "status-red";
    if (daysUntil <= 3) return "status-blue";
    return "status-pink";
  }

  if (daysUntil < 0) return "status-red";
  if (daysUntil <= 4) return "status-purple";

  const payment = new Date(container.paymentDate);
  const daysPassedFromPayment = Math.ceil((today - payment) / (1000 * 60 * 60 * 24));
  if (daysPassedFromPayment > 0 && daysUntil <= 7) return "status-blue";

  return "status-pink";
}

/* Załączniki produktu – podgląd wybranych plików i upload */
export function fileNameFromUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    const path = u.pathname || url;
    const parts = path.split("/");
    return parts.pop() || url;
  } catch (_) {
    const parts = String(url).split("/");
    return parts.pop() || String(url);
  }
}

/* Ekstrakcja fileId z różnych wariantów URL Google Drive */
export function extractDriveFileId(url) {
  try {
    const u = new URL(String(url), window.location.origin);
    const qid = u.searchParams.get("id");
    if (qid) return qid;
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) return m[1];
    const m2 = String(url).match(/[?&]id=([^&]+)/);
    if (m2) return m2[1];
    return null;
  } catch (_) {
    const m = String(url).match(/\/file\/d\/([^/]+)/);
    if (m) return m[1];
    const m2 = String(url).match(/[?&]id=([^&]+)/);
    if (m2) return m2[1];
    return null;
  }
}

/* Czy link wygląda na Google Drive i ma generyczną etykietę (np. 'uc') → potrzebna nazwa z API */
export function needsNameFromDrive(url) {
  const href = String(url || "");
  const isDrive = href.includes("drive.google.com");
  const label = fileNameFromUrl(href);
  const generic = (label === "uc" || label === "open" || label === "file" || label === "view" || label === "download");
  const hasExt = /\.[a-zA-Z0-9]{2,6}$/.test(label);
  return isDrive && (generic || !hasExt);
}

/* Pobieranie załączników z Google Drive wg nazwy produktu (folder = nazwa produktu) */
export async function fetchDriveFilesByProductName(name) {
  const key = String(name || "").trim();
  if (!key) return [];
  if (!state.productFilesCache) state.productFilesCache = {};
  if (state.productFilesCache[key]) return state.productFilesCache[key];
  try {
    console.log(`[Google Drive] Próba pobrania plików dla produktu: "${key}"...`);
    const res = await api("GET", "/api/drive/product-files?name=" + encodeURIComponent(key));
    const entries = Array.isArray(res?.files) ? res.files : [];
    const list = entries.map(f => {
      const url = f?.url || "";
      const nm = f?.name || "";
      if (url && nm) return { url, name: nm };
      if (url) return { url, name: fileNameFromUrl(url) };
      return null;
    }).filter(Boolean);
    console.log(`[Google Drive] Sukces dla "${key}" - znaleziono ${list.length} plików.`);
    state.productFilesCache[key] = list;
    return list;
  } catch (e) {
    console.error(`[Google Drive] Błąd pobierania plików dla "${key}". Czy token dostępu wygasł?`, e);
    state.productFilesCache[key] = [];
    return [];
  }
}

/* Wstaw/aktualizuj linki do załączników w podanym elemencie kontenera */
export function renderAttachmentLinksInto(containerEl, urls) {
  if (!containerEl) return;
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) {
    containerEl.classList.add("empty");
    containerEl.innerHTML = "Brak załączników";
    return;
  }
  containerEl.classList.remove("empty");
  // Jeśli to nie jest kontener flex – ustaw style minimalne dla siatki
  if (!containerEl.style.display) {
    containerEl.style.display = "flex";
    containerEl.style.flexWrap = "wrap";
    containerEl.style.gap = "8px";
    containerEl.style.marginTop = "8px";
  }
  containerEl.innerHTML = list.map(u => {
    const isObj = typeof u === "object" && u !== null;
    const href = isObj ? (u.url || "") : String(u || "");
    const label = isObj ? (u.name || fileNameFromUrl(href)) : fileNameFromUrl(href);
    return href ? `<a href="${href}" download class="btn small" rel="noopener" target="_blank">${label}</a>` : "";
  }).filter(Boolean).join("");
}