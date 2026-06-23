
import { state } from './state.js';
import { els } from './dom.js';
import {
  showToast, showLoader, hideLoader, initTheme, num, toUSD, convertPrice, normalizeDateValue, fillSheetContainerSelect, fillSheetProductSelect,
  fileNameFromUrl, extractDriveFileId, needsNameFromDrive, fetchDriveFilesByProductName, renderAttachmentLinksInto,
  loadSheets, syncContainersFromSheet, syncProductsFromSheet, getSheetContainers, getSheetProducts
} from './utils.js';
import { api, loadContainers } from './api.js';
import { renderProductContainerSelect, renderContainersList, renderProductsList, getAllProducts } from './render.js';

/* Obsługa formularzy */
function readContainerForm() {
  const rawOrder = els.cOrderDate ? els.cOrderDate.value : "";
  const rawPayment = els.cPaymentDate ? els.cPaymentDate.value : "";
  const rawDelivery = els.cDeliveryDate ? els.cDeliveryDate.value : "";
  const orderDate = normalizeDateValue(els.cOrderDate);
  const paymentDate = normalizeDateValue(els.cPaymentDate);
  const deliveryDate = normalizeDateValue(els.cDeliveryDate);

  try {
    console.debug("[Form] Container raw", { rawOrder, rawPayment, rawDelivery });
    console.debug("[Form] Container normalized", { orderDate, paymentDate, deliveryDate });
  } catch (_) { }

  const data = {
    name: els.cName.value.trim(),
    orderDate: orderDate || "",
    paymentDate: paymentDate || null,
    productionDays: (els.cProductionDays.value || "30"),
    deliveryDate: deliveryDate || null,
    exchangeRate: els.cExchangeRate.value || "4.0",

    containerCost: els.cContainerCost.value || "",
    containerCostCurrency: (els.cContainerCostCurrency.textContent || "USD").trim(),

    customsClearanceCost: els.cCustomsClearanceCost.value || "",
    customsClearanceCostCurrency: (els.cCustomsClearanceCostCurrency.textContent || "USD").trim(),

    transportChinaCost: els.cTransportChinaCost.value || "",
    transportChinaCostCurrency: (els.cTransportChinaCostCurrency.textContent || "USD").trim(),

    transportPolandCost: els.cTransportPolandCost.value || "",
    transportPolandCostCurrency: (els.cTransportPolandCostCurrency.textContent || "USD").trim(),

    insuranceCost: els.cInsuranceCost.value || "",
    insuranceCostCurrency: (els.cInsuranceCostCurrency.textContent || "USD").trim(),

    totalTransportCbm: els.cTotalTransportCbm.value || "",
    additionalCosts: els.cAdditionalCosts.value || "",
    additionalCostsCurrency: (els.cAdditionalCostsCurrency.textContent || "USD").trim(),

    pickedUpInChina: !!els.cPickedUpInChina.checked,
    customsClearanceDone: !!els.cCustomsClearanceDone.checked,
    deliveredToWarehouse: !!els.cDeliveredToWarehouse.checked,
    documentsInSystem: !!els.cDocumentsInSystem.checked,
  };

  try { console.debug("[Form] Container data", data); } catch (_) { }

  return data;
}

function populateContainerForm(c) {
  els.containerFormTitle.textContent = "Edytuj Kontener";
  els.cName.value = c.name || "";
  els.cExchangeRate.value = c.exchangeRate || "4.0";
  els.cOrderDate.value = c.orderDate || "";
  els.cPaymentDate.value = c.paymentDate || "";
  els.cProductionDays.value = c.productionDays || "";
  els.cDeliveryDate.value = c.deliveryDate || "";

  els.cContainerCost.value = c.containerCost || "";
  els.cContainerCostCurrency.textContent = c.containerCostCurrency || "USD";
  els.cCustomsClearanceCost.value = c.customsClearanceCost || "";
  els.cCustomsClearanceCostCurrency.textContent = c.customsClearanceCostCurrency || "USD";
  els.cTransportChinaCost.value = c.transportChinaCost || "";
  els.cTransportChinaCostCurrency.textContent = c.transportChinaCostCurrency || "USD";
  els.cTransportPolandCost.value = c.transportPolandCost || "";
  els.cTransportPolandCostCurrency.textContent = c.transportPolandCostCurrency || "USD";
  els.cInsuranceCost.value = c.insuranceCost || "";
  els.cInsuranceCostCurrency.textContent = c.insuranceCostCurrency || "USD";
  els.cTotalTransportCbm.value = c.totalTransportCbm || "";
  els.cAdditionalCosts.value = c.additionalCosts || "";
  els.cAdditionalCostsCurrency.textContent = c.additionalCostsCurrency || "USD";

  els.cPickedUpInChina.checked = !!c.pickedUpInChina;
  els.cCustomsClearanceDone.checked = !!c.customsClearanceDone;
  els.cDeliveredToWarehouse.checked = !!c.deliveredToWarehouse;
  els.cDocumentsInSystem.checked = !!c.documentsInSystem;
}

function resetContainerForm() {
  els.containerFormTitle.textContent = "Nowy Kontener";
  els.cName.value = "";
  els.cExchangeRate.value = "4.0";
  els.cOrderDate.value = "";
  els.cPaymentDate.value = "";
  els.cProductionDays.value = "";
  els.cDeliveryDate.value = "";
  els.cContainerCost.value = "";
  els.cContainerCostCurrency.textContent = "USD";
  els.cCustomsClearanceCost.value = "";
  els.cCustomsClearanceCostCurrency.textContent = "USD";
  els.cTransportChinaCost.value = "";
  els.cTransportChinaCostCurrency.textContent = "USD";
  els.cTransportPolandCost.value = "";
  els.cTransportPolandCostCurrency.textContent = "USD";
  els.cInsuranceCost.value = "";
  els.cInsuranceCostCurrency.textContent = "USD";
  els.cTotalTransportCbm.value = "";
  els.cAdditionalCosts.value = "";
  els.cAdditionalCostsCurrency.textContent = "USD";
  els.cPickedUpInChina.checked = false;
  els.cCustomsClearanceDone.checked = false;
  els.cDeliveredToWarehouse.checked = false;
  els.cDocumentsInSystem.checked = false;
}

function readProductForm() {
  return {
    name: els.pName.value.trim(),
    quantity: els.pQuantity.value || "",
    totalPrice: els.pTotalPrice.value || "",
    totalPriceCurrency: (els.pTotalPriceCurrency.textContent || "USD").trim(),
    productCbm: els.pProductCbm.value || "",
    customsDutyPercent: els.pCustomsDutyPercent.value || "",
  };
}

function populateProductForm(cId, p) {
  els.productFormTitle.textContent = "Edytuj Produkt";
  state.selectedContainerId = cId;
  renderProductContainerSelect();
  els.productContainerSelect.value = String(cId);

  els.pName.value = p.name || "";
  els.pQuantity.value = p.quantity || "";
  els.pTotalPrice.value = p.totalPrice || "";
  els.pTotalPriceCurrency.textContent = p.totalPriceCurrency || "USD";
  els.pProductCbm.value = p.productCbm || "";
  els.pCustomsDutyPercent.value = p.customsDutyPercent || "";
  state.productOriginalFiles = Array.isArray(p.files) ? p.files.map(x => (typeof x === "string" ? x : (x && x.url ? x.url : null))).filter(Boolean) : [];
  if (els.pFiles) els.pFiles.value = "";
  if (els.pFilesPreview) els.pFilesPreview.innerHTML = "";
}

function resetProductForm() {
  els.productFormTitle.textContent = "Nowy Produkt";
  els.productContainerSelect.value = "";
  els.pName.value = "";
  els.pQuantity.value = "";
  els.pTotalPrice.value = "";
  els.pTotalPriceCurrency.textContent = "USD";
  els.pProductCbm.value = "";
  els.pCustomsDutyPercent.value = "";
  state.productOriginalFiles = [];
  if (els.pFiles) els.pFiles.value = "";
  if (els.pFilesPreview) els.pFilesPreview.innerHTML = "";
}


/* Zdarzenia globalne */
if (els.currencySelect) {
  els.currencySelect.value = state.displayCurrency || "PLN";
  els.currencySelect.addEventListener("change", () => {
    const v = (els.currencySelect.value || "PLN").toUpperCase();
    state.displayCurrency = v === "USD" ? "USD" : "PLN";
    renderContainersList();
  });
}

// Filtr miesiąca (YYYY-MM)
if (els.filterMonth) {
  const savedMonth = localStorage.getItem("filterMonth");
  if (savedMonth && typeof savedMonth === "string") {
    state.filterMonth = savedMonth;
    els.filterMonth.value = savedMonth;
  }
  els.filterMonth.addEventListener("change", () => {
    const v = (els.filterMonth.value || "").trim();
    state.filterMonth = v || null;
    if (v) {
      localStorage.setItem("filterMonth", v);
    } else {
      localStorage.removeItem("filterMonth");
    }
    renderContainersList();
  });
}

if (els.clearFilterBtn) {
  els.clearFilterBtn.addEventListener("click", () => {
    if (els.filterMonth) els.filterMonth.value = "";
    state.filterMonth = null;
    localStorage.removeItem("filterMonth");
    renderContainersList();
  });
}

/* Odśwież produkty */
const refreshProductsBtnEl = document.getElementById("refreshProductsBtn");
if (refreshProductsBtnEl) {
  refreshProductsBtnEl.addEventListener("click", async () => {
    // Załaduj aktualne kontenery
    await initTheme();
    await loadContainers();
    // Synchronizacja inkrementalna z arkusza (bez kasowania istniejących pozycji)
    await syncProductsFromSheet(false);
    // Ponownie załaduj kontenery
    await initTheme();
    await loadContainers();
    // Przerysuj listę produktów (kafelki)
    renderProductsList();
  });
}

/* Edycja produktu z widoku produktów */
const productsListEl = document.getElementById("productsList");
if (productsListEl) {
  productsListEl.addEventListener("click", async (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target.closest("[data-action]") : null;
    if (!target) return;
    const action = target.getAttribute("data-action");
    if (!action) return;

    if (action === "edit-product") {
      const cidStr = target.getAttribute("data-cid");
      const pidStr = target.getAttribute("data-pid");
      const c = state.containers.find((x) => String(x.id) === cidStr);
      const p = c?.products?.find((x) => String(x.id) === pidStr);
      if (!c || !p) return;
      state.editingProductId = p.id;
      populateProductForm(c.id, p);
      state.showProductForm = true;
      els.productFormSection.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (action === "delete-product") {
      const cidStr = target.getAttribute("data-cid");
      const pidStr = target.getAttribute("data-pid");
      if (!confirm("Czy na pewno chcesz usunąć ten produkt?")) return;
      try {
        await api("DELETE", `/api/containers/${cidStr}/products/${pidStr}`);
        await initTheme();
        await loadContainers();
        renderProductsList();
      } catch (e) {
        if (e.message.includes("Container not found") || e.message.includes("Product not found")) {
          alert("Wykryto nieaktualne dane. Strona zostanie odświeżona.");
          window.location.reload();
          return;
        }
        alert("Błąd usuwania produktu: " + e.message);
      }
    }
  });
}

els.toggleContainerFormBtn.addEventListener("click", () => {
  state.showContainerForm = !state.showContainerForm;
  if (state.showContainerForm) {
    els.containerFormSection.classList.remove("hidden");
    fillSheetContainerSelect();
  } else {
    els.containerFormSection.classList.add("hidden");
    state.editingContainerId = null;
    resetContainerForm();
  }
});

els.saveContainerBtn.addEventListener("click", async () => {
  try { console.log("[UI] SaveContainer: click", { editingContainerId: state.editingContainerId }); } catch (_) { }
  const data = readContainerForm();
  try { console.log("[UI] SaveContainer: payload", data); } catch (_) { }
  if (!data.name || !data.orderDate || !data.productionDays || !data.exchangeRate) {
    try { console.warn("[UI] SaveContainer: validation failed", { name: !!data.name, orderDate: data.orderDate, productionDays: data.productionDays, exchangeRate: data.exchangeRate }); } catch (_) { }
    alert("Wypełnij wszystkie wymagane pola kontenera!");
    return;
  }
  try {
    if (state.editingContainerId) {
      try { console.log("[UI] SaveContainer: PUT", { id: state.editingContainerId }); } catch (_) { }
      await api("PUT", `/api/containers/${state.editingContainerId}`, data);
    } else {
      try { console.log("[UI] SaveContainer: POST", {}); } catch (_) { }
      await api("POST", "/api/containers", data);
    }
    await initTheme();
    await loadContainers();
    state.editingContainerId = null;
    state.showContainerForm = false;
    els.containerFormSection.classList.add("hidden");
    resetContainerForm();
    try { console.log("[UI] SaveContainer: done"); } catch (_) { }
  } catch (e) {
    try { console.error("[UI] SaveContainer: error", e); } catch (_) { }
    if (e.message.includes("Container not found")) {
      alert("Wykryto nieaktualne dane. Strona zostanie odświeżona.");
      window.location.reload();
      return;
    }
    alert("Błąd zapisu kontenera: " + e.message);
  }
});

els.cancelContainerBtn.addEventListener("click", () => {
  state.editingContainerId = null;
  state.showContainerForm = false;
  els.containerFormSection.classList.add("hidden");
  resetContainerForm();
});

function toggleCurrencyButton(btn) {
  const v = (btn.textContent || "USD").trim();
  btn.textContent = v === "USD" ? "PLN" : "USD";
}

/* Przełączniki waluty w formularzu kontenera */
[
  els.cContainerCostCurrency,
  els.cCustomsClearanceCostCurrency,
  els.cTransportChinaCostCurrency,
  els.cTransportPolandCostCurrency,
  els.cInsuranceCostCurrency,
  els.cAdditionalCostsCurrency,
].forEach((btn) => {
  btn.addEventListener("click", () => toggleCurrencyButton(btn));
});

/* Zdarzenia dla plików i załączników */

function renderSelectedFilesPreview() {
  const box = els.pFilesPreview;
  if (!box) return;
  const files = els.pFiles && els.pFiles.files ? Array.from(els.pFiles.files) : [];
  if (!files.length) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = files.map((f) => `<div class="file-chip">${f.name}</div>`).join("");
}

async function uploadProductFiles(productName, files) {
  const urls = [];
  for (const f of files) {
    const form = new FormData();
    form.append("productName", productName || "product");
    form.append("file", f);
    try {
      const opts = { method: "POST", body: form, headers: {} };

      // Dołącz Basic Auth jeśli dostępne (bez zapisu lokalnego – tylko w pamięci)
      try {
        if (state && state.auth && state.auth.username != null && state.auth.password != null) {
          opts.headers["Authorization"] = "Basic " + btoa(unescape(encodeURIComponent(String(state.auth.username) + ":" + String(state.auth.password))));
        }
      } catch (_) { }

      let res = await fetch("/api/files/upload", opts);

      // Jeśli 401 – poproś o login/hasło i spróbuj ponownie
      if (res.status === 401) {
        const u = prompt("Login (Basic Auth):") || "";
        const p = prompt("Hasło (Basic Auth):") || "";
        if (u && p) {
          state.auth = { username: u, password: p }; // przechowywane wyłącznie w pamięci
          try {
            opts.headers["Authorization"] = "Basic " + btoa(unescape(encodeURIComponent(String(u) + ":" + String(p))));
          } catch (_) { }
          res = await fetch("/api/files/upload", opts);
        }
      }

      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      if (json && json.url) urls.push(json.url);
    } catch (e) {
      alert("Błąd uploadu pliku: " + (e?.message || e));
    }
  }
  return urls;
}

/* Pobierz wszystkie załączniki produktu – sekwencyjnie otwiera linki (może otwierać nowe karty) */
async function downloadAllAttachments(items) {
  const list = Array.isArray(items) ? items : [];
  for (const u of list) {
    try {
      const href = (typeof u === "object" && u !== null) ? (u.url || "") : String(u || "");
      if (!href) continue;
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 250));
    } catch (_) {
      // ignore pojedyncze błędy
    }
  }
}

if (els.pFiles) {
  els.pFiles.addEventListener("change", renderSelectedFilesPreview);
}

if (els.loadContainerFromSheetBtn) {
  els.loadContainerFromSheetBtn.addEventListener("click", () => {
    const sel = els.sheetContainerSelect;
    if (!sel) return;
    const idx = parseInt(sel.value || "", 10);
    if (!Number.isFinite(idx)) {
      alert("Wybierz rekord kontenera z arkusza.");
      return;
    }
    const rec = state.sheetContainers[idx];
    if (!rec) {
      alert("Rekord nie istnieje.");
      return;
    }
    state.showContainerForm = true;
    els.containerFormSection.classList.remove("hidden");
    state.editingContainerId = null;
    els.containerFormTitle.textContent = "Nowy Kontener (z arkusza)";
    els.cName.value = rec.name || "";
    els.cExchangeRate.value = rec.exchangeRate || "4.0";
    els.cOrderDate.value = rec.orderDate || "";
    els.cPaymentDate.value = rec.paymentDate || "";
    els.cProductionDays.value = rec.productionDays || "";
    els.cDeliveryDate.value = rec.deliveryDate || "";
    els.cContainerCost.value = rec.containerCost || "";
    els.cContainerCostCurrency.textContent = rec.containerCostCurrency || "USD";
    els.cCustomsClearanceCost.value = rec.customsClearanceCost || "";
    els.cCustomsClearanceCostCurrency.textContent = rec.customsClearanceCostCurrency || "USD";
    els.cTransportChinaCost.value = rec.transportChinaCost || "";
    els.cTransportChinaCostCurrency.textContent = rec.transportChinaCostCurrency || "USD";
    els.cTransportPolandCost.value = rec.transportPolandCost || "";
    els.cTransportPolandCostCurrency.textContent = rec.transportPolandCostCurrency || "USD";
    els.cInsuranceCost.value = rec.insuranceCost || "";
    els.cInsuranceCostCurrency.textContent = rec.insuranceCostCurrency || "USD";
    els.cTotalTransportCbm.value = rec.totalTransportCbm || "";
    els.cAdditionalCosts.value = rec.additionalCosts || "";
    els.cAdditionalCostsCurrency.textContent = rec.additionalCostsCurrency || "USD";
    els.cPickedUpInChina.checked = !!rec.pickedUpInChina;
    els.cCustomsClearanceDone.checked = !!rec.customsClearanceDone;
    els.cDeliveredToWarehouse.checked = !!rec.deliveredToWarehouse;
    els.cDocumentsInSystem.checked = !!rec.documentsInSystem;
  });
}

/* Produkt – pokaz/ukryj formularz */
els.toggleProductFormBtn.addEventListener("click", () => {
  state.showProductForm = !state.showProductForm;
  if (state.showProductForm) {
    els.productFormSection.classList.remove("hidden");
    renderProductContainerSelect();
    fillSheetProductSelect();
  } else {
    els.productFormSection.classList.add("hidden");
    state.editingProductId = null;
    resetProductForm();
  }
});

/* Waluta ceny całkowitej produktu */
els.pTotalPriceCurrency.addEventListener("click", () => toggleCurrencyButton(els.pTotalPriceCurrency));

els.saveProductBtn.addEventListener("click", async () => {
  const containerId = els.productContainerSelect.value;
  if (!containerId || containerId === "0" || containerId === "") {
    alert("Wybierz kontener!");
    return;
  }
  const data = readProductForm();
  if (!data.name || !data.quantity || !data.totalPrice) {
    alert("Wypełnij wszystkie wymagane pola produktu!");
    return;
  }
  try {
    const filesInput = els.pFiles;
    const filesToUpload = filesInput && filesInput.files ? Array.from(filesInput.files) : [];
    let uploadedUrls = [];
    if (filesToUpload.length > 0) {
      uploadedUrls = await uploadProductFiles(data.name, filesToUpload);
    }
    const normalize = (arr) => (Array.isArray(arr) ? arr.map(x => (typeof x === "string" ? x : (x && x.url ? x.url : null))).filter(Boolean) : []);
    data.files = [...normalize(state.productOriginalFiles || []), ...normalize(uploadedUrls)];

    if (state.editingProductId) {
      await api("PUT", `/api/containers/${containerId}/products/${state.editingProductId}`, data);
    } else {
      await api("POST", `/api/containers/${containerId}/products`, data);
    }
    await initTheme();
    await loadContainers();
    state.editingProductId = null;
    state.showProductForm = false;
    els.productFormSection.classList.add("hidden");
    resetProductForm();
    if (els.pFiles) els.pFiles.value = "";
    if (els.pFilesPreview) els.pFilesPreview.innerHTML = "";
    state.productOriginalFiles = [];
  } catch (e) {
    if (e.message.includes("Container not found") || e.message.includes("Product not found")) {
      alert("Wykryto nieaktualne dane (np. po restarcie aplikacji). Strona zostanie odświeżona, aby pobrać najnowsze identyfikatory.");
      window.location.reload();
      return;
    }
    alert("Błąd zapisu produktu: " + e.message);
  }
});

els.cancelProductBtn.addEventListener("click", () => {
  state.editingProductId = null;
  state.showProductForm = false;
  els.productFormSection.classList.add("hidden");
  resetProductForm();
});

if (els.loadProductFromSheetBtn) {
  els.loadProductFromSheetBtn.addEventListener("click", () => {
    const sel = els.sheetProductSelect;
    if (!sel) return;
    const idx = parseInt(sel.value || "", 10);
    if (!Number.isFinite(idx)) {
      alert("Wybierz rekord produktu z arkusza.");
      return;
    }
    const rec = state.sheetProducts[idx];
    if (!rec) {
      alert("Rekord nie istnieje.");
      return;
    }
    state.showProductForm = true;
    els.productFormSection.classList.remove("hidden");
    state.editingProductId = null;
    els.productFormTitle.textContent = "Nowy Produkt (z arkusza)";
    els.pName.value = rec.name || "";
    els.pQuantity.value = rec.quantity || "";
    els.pTotalPrice.value = rec.totalPrice || "";
    els.pTotalPriceCurrency.textContent = rec.totalPriceCurrency || "USD";
    els.pProductCbm.value = rec.productCbm || "";
    els.pCustomsDutyPercent.value = rec.customsDutyPercent || "";
  });
}

els.refreshBtn.addEventListener("click", async () => {
  // Najpierw upewnij się, że stan jest aktualny
  await initTheme();
  await loadContainers();

  // Następnie wymuś pełną synchronizację (replace) kontenerów
  await syncContainersFromSheet(true);
  await initTheme();
  await loadContainers();

  // Teraz wymuś pełną synchronizację (replace) produktów
  await syncProductsFromSheet(true);

  // Na końcu odśwież widok i dane
  await initTheme();
  await loadContainers();
  renderProductsList();
});

/* Zdarzenia na liście (delegacja) */
els.containerList.addEventListener("click", async (ev) => {
  // Użyj closest() aby obsłużyć kliknięcia w elementy wewnątrz przycisków
  const target = ev.target instanceof HTMLElement ? ev.target.closest("[data-action]") : null;
  if (!target) return;
  const action = target.getAttribute("data-action");
  if (!action) return;


  if (action === "download-pdf") {
    const cid = target.getAttribute("data-id");
    if (!cid) return;
    window.open(`/api/containers/${cid}/report.pdf`, "_blank");
    return;
  }
  if (action === "toggle-expand") {
    // Użyj string ID do mapy expanded (unikamy utraty precyzji parseInt dla dużych ID)
    const idStr = target.getAttribute("data-id");
    state.expanded[idStr] = !state.expanded[idStr];
    renderContainersList();
  }

  if (action === "edit-container") {
    const idStr = target.getAttribute("data-id");
    const c = state.containers.find((x) => String(x.id) === idStr);
    if (!c) return;
    state.editingContainerId = c.id;
    populateContainerForm(c);
    state.showContainerForm = true;
    els.containerFormSection.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (action === "delete-container") {
    const idStr = target.getAttribute("data-id");
    if (!confirm("Czy na pewno chcesz usunąć ten kontener wraz z wszystkimi produktami?")) return;
    try {
      await api("DELETE", `/api/containers/${idStr}`);
      await initTheme();
      await loadContainers();
    } catch (e) {
      if (e.message.includes("Container not found")) {
        alert("Wykryto nieaktualne dane. Strona zostanie odświeżona.");
        window.location.reload();
        return;
      }
      alert("Błąd usuwania kontenera: " + e.message);
    }
  }

  if (action === "edit-product") {
    const cidStr = target.getAttribute("data-cid");
    const pidStr = target.getAttribute("data-pid");
    const c = state.containers.find((x) => String(x.id) === cidStr);
    const p = c?.products?.find((x) => String(x.id) === pidStr);
    if (!c || !p) return;
    state.editingProductId = p.id;
    populateProductForm(c.id, p);
    state.showProductForm = true;
    els.productFormSection.classList.remove("hidden");
  }

  if (action === "delete-product") {
    const cidStr = target.getAttribute("data-cid");
    const pidStr = target.getAttribute("data-pid");
    if (!confirm("Czy na pewno chcesz usunąć ten produkt?")) return;
    try {
      await api("DELETE", `/api/containers/${cidStr}/products/${pidStr}`);
      await initTheme();
      await loadContainers();
    } catch (e) {
      if (e.message.includes("Container not found") || e.message.includes("Product not found")) {
        alert("Wykryto nieaktualne dane. Strona zostanie odświeżona.");
        window.location.reload();
        return;
      }
      alert("Błąd usuwania produktu: " + e.message);
    }
  }
});

els.containerList.addEventListener("change", async (ev) => {
  const target = ev.target instanceof HTMLElement ? ev.target.closest("[data-action]") : null;
  if (!target) return;
  const action = target.getAttribute("data-action");
  if (action !== "toggle-status") return;
  const idStr = target.getAttribute("data-id");
  const field = target.getAttribute("data-field");
  const checked = !!(target instanceof HTMLInputElement ? target.checked : false);
  try {
    await api("PUT", `/api/containers/${idStr}`, { [field]: checked });
    await initTheme();
    await loadContainers();
  } catch (e) {
    alert("Błąd aktualizacji statusu: " + e.message);
  }
});

/* Wersja aplikacji – pobierz label i short SHA, pokaż w badge */
async function updateVersionBadge() {
  const el = document.getElementById("versionBadge");
  if (!el) return;
  try {
    const res = await fetch("/api/version", { method: "GET" });
    if (!res.ok) throw new Error("version fetch failed");
    const data = await res.json();
    const sha = String(data?.shortSha || data?.version || "").trim();
    const hasBuild = data && data.buildNumber !== undefined && data.buildNumber !== null && !Number.isNaN(Number(data.buildNumber));
    const label = String(data?.versionLabel || "").trim();
    const text = label || (sha ? `Version ${sha}${hasBuild ? ` (build ${Number(data.buildNumber)})` : ""}` : "Version local");
    el.textContent = text;
    if (data?.env) el.title = "Wersja aplikacji (" + String(data.env) + ")";
    el.classList.remove("hidden");
  } catch (_) {
    el.textContent = "Version local";
    el.classList.remove("hidden");
  }
}
/* Inicjalizacja */
window.addEventListener("DOMContentLoaded", async () => {
  await loadSheets();
  await initTheme();
  await loadContainers();
  renderProductsList();

  // Automatyczny import z arkusza jest obsługiwany przez backend (_auto_import_from_sheets_on_start).
  // Frontend NIE reimportuje z arkusza przy każdym odświeżeniu strony,
  // żeby nie przywracać celowo usuniętych kontenerów/produktów.
  // Pełna resynchronizacja z arkusza jest dostępna przez przycisk "Odśwież" (refreshBtn).
});

/* Download all attachments (delegacja na cały dokument) */
document.addEventListener("click", async (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-action");
  if (action !== "download-all") return;
  const cidStr = target.getAttribute("data-cid") || "";
  const pidStr = target.getAttribute("data-pid") || "";
  const c = state.containers.find((x) => String(x.id) === cidStr);
  const p = c?.products?.find((x) => String(x.id) === pidStr);
  let urls = Array.isArray(p?.files) ? p.files : [];
  // Brak lokalnych linków → spróbuj pobrać z Drive wg nazwy produktu
  if (!urls.length && p?.name) {
    try {
      urls = await fetchDriveFilesByProductName(p.name);
    } catch (_) {
      urls = [];
    }
  }
  if (!urls.length) {
    alert("Brak załączników do pobrania.");
    return;
  }
  await downloadAllAttachments(urls);
});

/* Skanowanie i Import z Google Drive (UI modal + interaktywne drzewo) */
function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderImportTree(containers) {
  const treeEl = els.importTree;
  if (!treeEl) return;
  if (!containers || containers.length === 0) {
    treeEl.innerHTML = '<div class="empty">Brak folderów w wybranym katalogu Google Drive.</div>';
    return;
  }

  let html = '<ul style="margin: 0; padding: 0; list-style: none;">';

  containers.forEach(c => {
    const products = Array.isArray(c.products) ? c.products : [];
    const hasProducts = products.length > 0;

    html += `
      <li class="tree-node" data-type="container" data-id="${c.id}">
        <div class="tree-node-content">
          <input type="checkbox" class="tree-node-checkbox container-checkbox" data-id="${c.id}">
          <span class="tree-node-icon">📦</span>
          <span class="tree-node-label">${escapeHtml(c.name)}</span>
          <span class="tree-node-meta" style="margin-left: auto; font-size: 0.8rem; color: var(--text-muted);">${products.length} prod.</span>
        </div>
    `;

    if (hasProducts) {
      html += `<ul class="tree-children" style="margin-left: 24px; padding-left: 12px; border-left: 1px dashed var(--border);">`;
      products.forEach(p => {
        const files = Array.isArray(p.files) ? p.files : [];
        html += `
          <li class="tree-node" data-type="product" data-id="${p.id}" data-parent-id="${c.id}">
            <div class="tree-node-content">
              <input type="checkbox" class="tree-node-checkbox product-checkbox" data-id="${p.id}" data-parent-id="${c.id}">
              <span class="tree-node-icon">🛍️</span>
              <span class="tree-node-label">${escapeHtml(p.name)}</span>
              <span class="tree-node-meta" style="margin-left: auto; font-size: 0.8rem; color: var(--text-muted);">${files.length} zał.</span>
            </div>
          </li>
        `;
      });
      html += `</ul>`;
    }

    html += `</li>`;
  });

  html += '</ul>';
  treeEl.innerHTML = html;

  // Obsługa kliknięcia całego elementu do zaznaczania
  treeEl.querySelectorAll('.container-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const containerId = e.target.getAttribute('data-id');
      const isChecked = e.target.checked;

      treeEl.querySelectorAll(`.product-checkbox[data-parent-id="${containerId}"]`).forEach(pcb => {
        pcb.checked = isChecked;
      });
    });
  });

  treeEl.querySelectorAll('.product-checkbox').forEach(pcb => {
    pcb.addEventListener('change', (e) => {
      const parentId = e.target.getAttribute('data-parent-id');
      const parentCb = treeEl.querySelector(`.container-checkbox[data-id="${parentId}"]`);

      if (!e.target.checked) {
        if (parentCb) parentCb.checked = false;
      } else {
        const siblings = Array.from(treeEl.querySelectorAll(`.product-checkbox[data-parent-id="${parentId}"]`));
        const allChecked = siblings.every(s => s.checked);
        if (allChecked && parentCb) parentCb.checked = true;
      }
    });
  });
}

let currentImportRootId = null;

if (els.importFromDriveBtn) {
  els.importFromDriveBtn.addEventListener("click", async () => {
    showLoader();
    try {
      const res = await api("GET", "/api/drive/scan");
      currentImportRootId = res?.rootId || null;
      const containers = Array.isArray(res?.containers) ? res.containers : [];
      renderImportTree(containers);
      if (els.importModal) {
        els.importModal.classList.remove("hidden");
      }
    } catch (e) {
      alert("Błąd skanowania dysku Google Drive: " + e.message);
    } finally {
      hideLoader();
    }
  });
}

if (els.importCloseBtn) {
  els.importCloseBtn.addEventListener("click", () => {
    if (els.importModal) {
      els.importModal.classList.add("hidden");
    }
  });
}

if (els.importRunBtn) {
  els.importRunBtn.addEventListener("click", async () => {
    const treeEl = els.importTree;
    if (!treeEl) return;

    const containerIds = [];
    const productIds = [];

    treeEl.querySelectorAll('.container-checkbox:checked').forEach(cb => {
      containerIds.push(cb.getAttribute('data-id'));
    });

    treeEl.querySelectorAll('.product-checkbox:checked').forEach(pcb => {
      const parentId = pcb.getAttribute('data-parent-id');
      const parentChecked = containerIds.includes(parentId);
      if (!parentChecked) {
        productIds.push(pcb.getAttribute('data-id'));
      }
    });

    if (containerIds.length === 0 && productIds.length === 0) {
      alert("Zaznacz przynajmniej jeden folder kontenera lub produktu do zaimportowania!");
      return;
    }

    showLoader();
    try {
      const body = {
        containerIds,
        productIds,
        rootId: currentImportRootId
      };

      const res = await api("POST", "/api/containers/import/drive", body);
      showToast(`Pomyślnie zaimportowano z Drive! (Kontenery: ${res?.imported?.containers ?? 0}, Produkty: ${res?.imported?.products ?? 0})`, "success");

      if (els.importModal) {
        els.importModal.classList.add("hidden");
      }

      await initTheme();
      await loadContainers();
    } catch (e) {
      alert("Błąd podczas importu z Google Drive: " + e.message);
    } finally {
      hideLoader();
    }
  });
}

// Auto-init wersji w prawym górnym rogu
window.addEventListener("DOMContentLoaded", () => {
  if (typeof updateVersionBadge === "function") {
    updateVersionBadge();
  }
});