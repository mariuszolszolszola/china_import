/* Zarządzanie Importem z Chin - UI/JS (FastAPI + HTML) */
"use strict";

/* Stan aplikacji */
const state = {
  containers: [],
  displayCurrency: "PLN",
  showContainerForm: false,
  showProductForm: false,
  editingContainerId: null,
  editingProductId: null,
  selectedContainerId: null,
  expanded: {}, // { [containerId]: boolean }
};

/* Elementy DOM */
const els = {
  currencyPLNBtn: document.getElementById("currencyPLNBtn"),
  currencyUSDBtn: document.getElementById("currencyUSDBtn"),
  toggleContainerFormBtn: document.getElementById("toggleContainerFormBtn"),
  containerFormSection: document.getElementById("containerFormSection"),
  containerFormTitle: document.getElementById("containerFormTitle"),
  saveContainerBtn: document.getElementById("saveContainerBtn"),
  cancelContainerBtn: document.getElementById("cancelContainerBtn"),

  // Pola kontenera
  cName: document.getElementById("cName"),
  cExchangeRate: document.getElementById("cExchangeRate"),
  cOrderDate: document.getElementById("cOrderDate"),
  cPaymentDate: document.getElementById("cPaymentDate"),
  cProductionDays: document.getElementById("cProductionDays"),
  cDeliveryDate: document.getElementById("cDeliveryDate"),

  cContainerCost: document.getElementById("cContainerCost"),
  cContainerCostCurrency: document.getElementById("cContainerCostCurrency"),
  cCustomsClearanceCost: document.getElementById("cCustomsClearanceCost"),
  cCustomsClearanceCostCurrency: document.getElementById("cCustomsClearanceCostCurrency"),
  cTransportChinaCost: document.getElementById("cTransportChinaCost"),
  cTransportChinaCostCurrency: document.getElementById("cTransportChinaCostCurrency"),
  cTransportPolandCost: document.getElementById("cTransportPolandCost"),
  cTransportPolandCostCurrency: document.getElementById("cTransportPolandCostCurrency"),
  cInsuranceCost: document.getElementById("cInsuranceCost"),
  cInsuranceCostCurrency: document.getElementById("cInsuranceCostCurrency"),
  cTotalTransportCbm: document.getElementById("cTotalTransportCbm"),
  cAdditionalCosts: document.getElementById("cAdditionalCosts"),
  cAdditionalCostsCurrency: document.getElementById("cAdditionalCostsCurrency"),

  cPickedUpInChina: document.getElementById("cPickedUpInChina"),
  cCustomsClearanceDone: document.getElementById("cCustomsClearanceDone"),
  cDeliveredToWarehouse: document.getElementById("cDeliveredToWarehouse"),
  cDocumentsInSystem: document.getElementById("cDocumentsInSystem"),

  // Produkty
  productFormSection: document.getElementById("productFormSection"),
  productFormTitle: document.getElementById("productFormTitle"),
  toggleProductFormBtn: document.getElementById("toggleProductFormBtn"),
  productContainerSelect: document.getElementById("productContainerSelect"),
  pName: document.getElementById("pName"),
  pQuantity: document.getElementById("pQuantity"),
  pTotalPrice: document.getElementById("pTotalPrice"),
  pTotalPriceCurrency: document.getElementById("pTotalPriceCurrency"),
  pProductCbm: document.getElementById("pProductCbm"),
  pCustomsDutyPercent: document.getElementById("pCustomsDutyPercent"),
  saveProductBtn: document.getElementById("saveProductBtn"),
  cancelProductBtn: document.getElementById("cancelProductBtn"),

  // Lista
  refreshBtn: document.getElementById("refreshBtn"),
  containerList: document.getElementById("containerList"),
};

/* Narzędzia API */
async function api(method, url, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = "Request failed";
    try {
      const data = await res.json();
      msg = data?.detail || JSON.stringify(data);
    } catch (_) {
      // ignore
    }
    throw new Error(msg);
  }
  // No content
  if (res.status === 204) return null;
  return res.json();
}

async function loadContainers() {
  const data = await api("GET", "/api/containers");
  state.containers = Array.isArray(data) ? data : [];
  renderProductContainerSelect();
  renderContainersList();
}

/* Pomocnicze */
function num(v, def = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function toUSD(amount, currency, exchangeRate) {
  const a = num(amount, 0);
  const er = num(exchangeRate, 4.0);
  if (currency === "USD") return a;
  return a / er;
}

function convertPrice(priceUSD, exchangeRate) {
  const er = num(exchangeRate, 4.0);
  if (state.displayCurrency === "PLN") {
    return (priceUSD * er).toFixed(2) + " zł";
  }
  return priceUSD.toFixed(2) + " $";
}

function calculateProductCosts(product, container) {
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

function calculateContainerTotals(container) {
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

function getStatusClass(container) {
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

/* Renderowanie */
function renderProductContainerSelect() {
  const sel = els.productContainerSelect;
  sel.innerHTML = "";
  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "— wybierz —";
  sel.appendChild(optEmpty);

  state.containers.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = c.name || ("Kontener " + c.id);
    sel.appendChild(opt);
  });

  if (state.selectedContainerId) {
    sel.value = String(state.selectedContainerId);
  }
}

function renderContainersList() {
  const list = els.containerList;
  list.innerHTML = "";

  state.containers.forEach((c) => {
    const totals = calculateContainerTotals(c);
    const exchangeRate = num(c.exchangeRate, 4.0);
    const statusClass = getStatusClass(c);
    const expanded = !!state.expanded[c.id];

    const card = document.createElement("div");
    card.className = `container-card card ${statusClass}`;

    const header = document.createElement("div");
    header.className = "container-header";

    const left = document.createElement("div");
    left.className = "header-left";
    const h3 = document.createElement("h3");
    h3.textContent = c.name || ("Kontener " + c.id);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [
      c.orderDate ? `Zamówienie: ${c.orderDate}` : null,
      c.pickupDate ? `Pickup: ${c.pickupDate}` : null,
      c.deliveryDate ? `Dostawa: ${c.deliveryDate}` : null,
    ].filter(Boolean).join(" · ");

    left.appendChild(h3);
    left.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "header-actions";
    actions.innerHTML = `
      <button class="btn" data-action="toggle-expand" data-id="${c.id}">${expanded ? "Zwiń" : "Rozwiń"}</button>
      <button class="btn" data-action="edit-container" data-id="${c.id}">Edytuj</button>
      <button class="btn danger" data-action="delete-container" data-id="${c.id}">Usuń</button>
    `;

    header.appendChild(left);
    header.appendChild(actions);
    card.appendChild(header);

    const statusRow = document.createElement("div");
    statusRow.className = "status-row";
    statusRow.innerHTML = `
      <label class="checkbox"><input type="checkbox" data-action="toggle-status" data-field="pickedUpInChina" data-id="${c.id}" ${c.pickedUpInChina ? "checked" : ""}> Odebrany w Chinach</label>
      <label class="checkbox"><input type="checkbox" data-action="toggle-status" data-field="customsClearanceDone" data-id="${c.id}" ${c.customsClearanceDone ? "checked" : ""}> Odprawa celna</label>
      <label class="checkbox"><input type="checkbox" data-action="toggle-status" data-field="deliveredToWarehouse" data-id="${c.id}" ${c.deliveredToWarehouse ? "checked" : ""}> Dostarczony do magazynu</label>
      <label class="checkbox"><input type="checkbox" data-action="toggle-status" data-field="documentsInSystem" data-id="${c.id}" ${c.documentsInSystem ? "checked" : ""}> Dokumenty w systemie</label>
    `;
    card.appendChild(statusRow);

    const totalsRow = document.createElement("div");
    totalsRow.className = "totals-row";
    totalsRow.innerHTML = `
      <div>Netto: <strong>${convertPrice(totals.nettoTotal, exchangeRate)}</strong></div>
      <div>Brutto: <strong>${convertPrice(totals.bruttoTotal, exchangeRate)}</strong></div>
      <div>Produkty: <strong>${totals.totalProducts}</strong></div>
    `;
    card.appendChild(totalsRow);

    if (expanded) {
      const productsWrap = document.createElement("div");
      productsWrap.className = "products";

      if (!c.products || c.products.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "Brak produktów";
        productsWrap.appendChild(empty);
      } else {
        c.products.forEach((p) => {
          const costs = calculateProductCosts(p, c);

          const row = document.createElement("div");
          row.className = "product-row";
          row.innerHTML = `
            <div class="product-main">
              <div class="product-name"><strong>${p.name}</strong> (ilość: ${Math.max(1, num(p.quantity, 1))})</div>
              <div class="product-meta">Cena całkowita: ${convertPrice(toUSD(num(p.totalPrice, 0), p.totalPriceCurrency, exchangeRate), exchangeRate)} | CBM: ${num(p.productCbm, 0).toFixed(3)} | Cło: ${num(p.customsDutyPercent, 0).toFixed(2)}%</div>
            </div>
            <div class="product-costs">
              <div>Jednostkowa: <strong>${convertPrice(costs.pricePerUnit, exchangeRate)}</strong></div>
              <div>Transport/szt.: <strong>${convertPrice(costs.transportPerUnit, exchangeRate)}</strong></div>
              <div>Cło: <strong>${convertPrice(costs.dutyAmount, exchangeRate)}</strong></div>
              <div>VAT: <strong>${convertPrice(costs.vatAmount, exchangeRate)}</strong></div>
              <div>Dodatkowe/szt.: <strong>${convertPrice(costs.additionalPerUnit, exchangeRate)}</strong></div>
              <div>Razem/szt.: <strong>${convertPrice(costs.totalCostPerUnit, exchangeRate)}</strong></div>
            </div>
            <div class="product-actions">
              <button class="btn" data-action="edit-product" data-cid="${c.id}" data-pid="${p.id}">Edytuj</button>
              <button class="btn danger" data-action="delete-product" data-cid="${c.id}" data-pid="${p.id}">Usuń</button>
            </div>
          `;
          productsWrap.appendChild(row);
        });
      }

      card.appendChild(productsWrap);
    }

    list.appendChild(card);
  });
}

/* Obsługa formularzy */
function readContainerForm() {
  return {
    name: els.cName.value.trim(),
    orderDate: els.cOrderDate.value || "",
    paymentDate: els.cPaymentDate.value || null,
    productionDays: els.cProductionDays.value || "",
    deliveryDate: els.cDeliveryDate.value || null,
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
}

/* Zdarzenia globalne */
els.currencyPLNBtn.addEventListener("click", () => {
  state.displayCurrency = "PLN";
  renderContainersList();
});
els.currencyUSDBtn.addEventListener("click", () => {
  state.displayCurrency = "USD";
  renderContainersList();
});

els.toggleContainerFormBtn.addEventListener("click", () => {
  state.showContainerForm = !state.showContainerForm;
  if (state.showContainerForm) {
    els.containerFormSection.classList.remove("hidden");
  } else {
    els.containerFormSection.classList.add("hidden");
    state.editingContainerId = null;
    resetContainerForm();
  }
});

els.saveContainerBtn.addEventListener("click", async () => {
  const data = readContainerForm();
  if (!data.name || !data.orderDate || !data.productionDays || !data.exchangeRate) {
    alert("Wypełnij wszystkie wymagane pola kontenera!");
    return;
  }
  try {
    if (state.editingContainerId) {
      await api("PUT", `/api/containers/${state.editingContainerId}`, data);
    } else {
      await api("POST", "/api/containers", data);
    }
    await loadContainers();
    state.editingContainerId = null;
    state.showContainerForm = false;
    els.containerFormSection.classList.add("hidden");
    resetContainerForm();
  } catch (e) {
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

/* Produkt – pokaz/ukryj formularz */
els.toggleProductFormBtn.addEventListener("click", () => {
  state.showProductForm = !state.showProductForm;
  if (state.showProductForm) {
    els.productFormSection.classList.remove("hidden");
    renderProductContainerSelect();
  } else {
    els.productFormSection.classList.add("hidden");
    state.editingProductId = null;
    resetProductForm();
  }
});

/* Waluta ceny całkowitej produktu */
els.pTotalPriceCurrency.addEventListener("click", () => toggleCurrencyButton(els.pTotalPriceCurrency));

els.saveProductBtn.addEventListener("click", async () => {
  const containerId = parseInt(els.productContainerSelect.value || "0", 10);
  if (!containerId) {
    alert("Wybierz kontener!");
    return;
  }
  const data = readProductForm();
  if (!data.name || !data.quantity || !data.totalPrice) {
    alert("Wypełnij wszystkie wymagane pola produktu!");
    return;
  }
  try {
    if (state.editingProductId) {
      await api("PUT", `/api/containers/${containerId}/products/${state.editingProductId}`, data);
    } else {
      await api("POST", `/api/containers/${containerId}/products`, data);
    }
    await loadContainers();
    state.editingProductId = null;
    state.showProductForm = false;
    els.productFormSection.classList.add("hidden");
    resetProductForm();
  } catch (e) {
    alert("Błąd zapisu produktu: " + e.message);
  }
});

els.cancelProductBtn.addEventListener("click", () => {
  state.editingProductId = null;
  state.showProductForm = false;
  els.productFormSection.classList.add("hidden");
  resetProductForm();
});

els.refreshBtn.addEventListener("click", () => {
  loadContainers();
});

/* Zdarzenia na liście (delegacja) */
els.containerList.addEventListener("click", async (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-action");
  if (!action) return;

  if (action === "toggle-expand") {
    const id = parseInt(target.getAttribute("data-id"), 10);
    state.expanded[id] = !state.expanded[id];
    renderContainersList();
  }

  if (action === "edit-container") {
    const id = parseInt(target.getAttribute("data-id"), 10);
    const c = state.containers.find((x) => parseInt(x.id, 10) === id);
    if (!c) return;
    state.editingContainerId = id;
    populateContainerForm(c);
    state.showContainerForm = true;
    els.containerFormSection.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (action === "delete-container") {
    const id = parseInt(target.getAttribute("data-id"), 10);
    if (!confirm("Czy na pewno chcesz usunąć ten kontener wraz z wszystkimi produktami?")) return;
    try {
      await api("DELETE", `/api/containers/${id}`);
      await loadContainers();
    } catch (e) {
      alert("Błąd usuwania kontenera: " + e.message);
    }
  }

  if (action === "edit-product") {
    const cid = parseInt(target.getAttribute("data-cid"), 10);
    const pid = parseInt(target.getAttribute("data-pid"), 10);
    const c = state.containers.find((x) => parseInt(x.id, 10) === cid);
    const p = c?.products?.find((x) => parseInt(x.id, 10) === pid);
    if (!c || !p) return;
    state.editingProductId = pid;
    populateProductForm(cid, p);
    state.showProductForm = true;
    els.productFormSection.classList.remove("hidden");
  }

  if (action === "delete-product") {
    const cid = parseInt(target.getAttribute("data-cid"), 10);
    const pid = parseInt(target.getAttribute("data-pid"), 10);
    if (!confirm("Czy na pewno chcesz usunąć ten produkt?")) return;
    try {
      await api("DELETE", `/api/containers/${cid}/products/${pid}`);
      await loadContainers();
    } catch (e) {
      alert("Błąd usuwania produktu: " + e.message);
    }
  }
});

els.containerList.addEventListener("change", async (ev) => {
  const target = ev.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute("data-action");
  if (action !== "toggle-status") return;
  const id = parseInt(target.getAttribute("data-id"), 10);
  const field = target.getAttribute("data-field");
  const checked = !!(target instanceof HTMLInputElement ? target.checked : false);
  try {
    await api("PUT", `/api/containers/${id}`, { [field]: checked });
    await loadContainers();
  } catch (e) {
    alert("Błąd aktualizacji statusu: " + e.message);
  }
});

/* Inicjalizacja */
window.addEventListener("DOMContentLoaded", () => {
  loadContainers();
});