import { state } from './state.js';
import { els } from './dom.js';
import { 
  num, toUSD, convertPrice, calculateProductCosts, calculateContainerTotals, getStatusClass,
  fileNameFromUrl, extractDriveFileId, needsNameFromDrive, fetchDriveFilesByProductName, renderAttachmentLinksInto 
} from './utils.js';
import { api } from './api.js';

/* Renderowanie */
export function renderProductContainerSelect() {
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

export function renderContainersList() {
  const list = els.containerList;
  list.innerHTML = "";

  (state.filterMonth && typeof state.filterMonth === "string" && state.filterMonth.length === 7 ? state.containers.filter((c) => (((c.orderDate || "").slice(0, 7)) === state.filterMonth)) : state.containers).forEach((c) => {
    const totals = calculateContainerTotals(c);
    const exchangeRate = num(c.exchangeRate, 4.0);
    const statusClass = getStatusClass(c);
    const expanded = !!state.expanded[String(c.id)];

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
      <button class="btn" data-action="download-pdf" data-id="${c.id}">📄 Pobierz PDF</button>
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
          const pkey = encodeURIComponent(String(p.name || ""));
          const attachmentsHtml = '<div class="product-files"><div class="files attachments empty" data-pkey="' + pkey + '">Brak załączników</div></div>';
          row.innerHTML = `
            <div class="product-content-wrapper">
              <div class="product-main">
                <div class="product-name"><strong>${p.name}</strong> <span style="color:#6b7280; font-weight:400">(ilość: ${Math.max(1, num(p.quantity, 1))})</span></div>
                <div class="product-meta">
                  Cena całk.: ${convertPrice(toUSD(num(p.totalPrice, 0), p.totalPriceCurrency, exchangeRate), exchangeRate)} |
                  CBM: ${num(p.productCbm, 0).toFixed(3)} |
                  Cło: ${num(p.customsDutyPercent, 0).toFixed(2)}%
                </div>
              </div>

              <div class="product-costs">
                <div><span>Jednostkowa</span> <strong>${convertPrice(costs.pricePerUnit, exchangeRate)}</strong></div>
                <div><span>Transport/szt.</span> <strong>${convertPrice(costs.transportPerUnit, exchangeRate)}</strong></div>
                <div><span>Cło/szt.</span> <strong>${convertPrice(costs.dutyAmount / costs.quantity, exchangeRate)}</strong></div>
                <div><span>VAT/szt.</span> <strong>${convertPrice(costs.vatAmount / costs.quantity, exchangeRate)}</strong></div>
                <div><span>Dodatkowe/szt.</span> <strong>${convertPrice(costs.additionalPerUnit, exchangeRate)}</strong></div>
                <div class="cost-summary">
                  <div class="summary-item"><span>Netto/szt.</span> <strong>${convertPrice(costs.pricePerUnit + costs.transportPerUnit + (costs.dutyAmount / costs.quantity) + costs.additionalPerUnit, exchangeRate)}</strong></div>
                  <div class="summary-item"><span>Brutto/szt.</span> <strong>${convertPrice(costs.totalCostPerUnit, exchangeRate)}</strong></div>
                </div>
              </div>

              <div class="product-attachments-wrapper">
                ${attachmentsHtml}
              </div>
              
              <div class="product-actions">
                <button class="btn" data-action="download-all" data-cid="${c.id}" data-pid="${p.id}">Pobierz pliki</button>
                <button class="btn" data-action="edit-product" data-cid="${c.id}" data-pid="${p.id}">Edytuj</button>
                <button class="btn danger" data-action="delete-product" data-cid="${c.id}" data-pid="${p.id}">Usuń</button>
              </div>
            </div>
          `;
          // Dociągnij załączniki po nazwie produktu (Drive) gdy lokalnie brak
          (function hydrateAttachments() {
            const attEl = row.querySelector(".attachments");
            if (!attEl) return;
            const localFiles = Array.isArray(p.files) ? p.files : [];
            if (localFiles.length) {
              // Jeśli lokalne linki wyglądają jak linki Drive bez nazwy (np. /uc?export=download&id=...),
              // spróbuj podciągnąć nazwy z Drive i zmapować po fileId.
              const shouldUpgrade = localFiles.some(x => {
                const href = (typeof x === "object" && x !== null) ? (x.url || "") : String(x || "");
                const hasName = (typeof x === "object" && x !== null) && !!x.name;
                return !hasName && needsNameFromDrive(href);
              });
              if (shouldUpgrade) {
                fetchDriveFilesByProductName(p.name).then((objs) => {
                  if (objs && objs.length) {
                    const byId = new Map(objs.map(o => [extractDriveFileId(o.url), o]));
                    const upgraded = localFiles.map(x => {
                      const href = (typeof x === "object" && x !== null) ? (x.url || "") : String(x || "");
                      const id = extractDriveFileId(href);
                      const match = id ? byId.get(id) : null;
                      return match ? match : { url: href, name: fileNameFromUrl(href) };
                    });
                    p.files = upgraded;
                    renderAttachmentLinksInto(attEl, upgraded);
                  } else {
                    renderAttachmentLinksInto(attEl, localFiles);
                  }
                }).catch(() => { renderAttachmentLinksInto(attEl, localFiles); });
              } else {
                renderAttachmentLinksInto(attEl, localFiles);
              }
              return;
            }
            fetchDriveFilesByProductName(p.name).then((objs) => {
              if (objs && objs.length) {
                p.files = objs;
                renderAttachmentLinksInto(attEl, objs);
              }
            }).catch(() => {});
          })();
          productsWrap.appendChild(row);
        });
      }

      card.appendChild(productsWrap);
    }

    list.appendChild(card);
  });
}

export function getAllProducts() {
  const out = [];
  const containers = Array.isArray(state.containers) ? state.containers : [];
  for (const c of containers) {
    const products = Array.isArray(c.products) ? c.products : [];
    for (const p of products) {
      out.push({ container: c, product: p });
    }
  }
  return out;
}

export function renderProductsList() {
  const box = document.getElementById("productsList");
  if (!box) return;
  const items = getAllProducts();
  if (!items.length) {
    box.innerHTML = '<div class="empty">Brak produktów.</div>';
    return;
  }
  const html = items.map(({ container, product }) => {
    const cid = String(container.id);
    const pid = String(product.id);
    const files = Array.isArray(product.files) ? product.files : [];
    const key = encodeURIComponent(String(product.name || ""));
    const filesHtml = files.length
      ? '<div class="attachments" data-pkey="' + key + '" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">'
        + files.map(u => {
            const isObj = typeof u === "object" && u !== null;
            const href = isObj ? (u.url || "") : String(u || "");
            const label = isObj ? (u.name || fileNameFromUrl(href)) : fileNameFromUrl(href);
            return href ? `<a href="${href}" download class="btn small" rel="noopener" target="_blank">${label}</a>` : "";
          }).filter(Boolean).join("")
        + '</div>'
      : '<div class="attachments empty" data-pkey="' + key + '">Brak załączników</div>';

    return `
      <div class="product-row product-card" data-pkey="${key}">
        <div class="product-main">
          <div class="product-name"><strong>${product.name || "Produkt"}</strong></div>
          <div class="product-meta">Kontener: ${container.name || ""} · Ilość: ${product.quantity || 0} · Waluta: ${product.totalPriceCurrency || "USD"} · CBM: ${product.productCbm || 0}</div>
          ${filesHtml}
        </div>
        <div class="product-costs">
          <div>Wartość: ${Number(product.totalPrice || 0)} ${product.totalPriceCurrency || "USD"}</div>
          <div>% cła: ${product.customsDutyPercent || 0}</div>
          <div>Załączniki: ${files.length}</div>
        </div>
        <div class="product-actions">
          <button class="btn small" data-action="edit-product" data-cid="${cid}" data-pid="${pid}">Edytuj</button>
          <button class="btn small" data-action="download-all" data-cid="${cid}" data-pid="${pid}">Pobierz pliki</button>
          <button class="btn small" data-action="delete-product" data-cid="${cid}" data-pid="${pid}">Usuń</button>
        </div>
      </div>
    `;
  }).join("");
  box.innerHTML = html;

  // Po renderze dociągnij załączniki z Google Drive; gdy lokalne linki są z Drive bez nazw – spróbuj ulepszyć
  try {
    for (const { product } of items) {
      const key = encodeURIComponent(String(product.name || ""));
      // Znajdź placeholder attachments w kafelku produktu
      const el = box.querySelector(`.product-card[data-pkey="${key}"] .attachments`);
      if (!el) continue;
      const localFiles = Array.isArray(product.files) ? product.files : [];
      if (localFiles.length > 0) {
        const shouldUpgrade = localFiles.some(x => {
          const href = (typeof x === "object" && x !== null) ? (x.url || "") : String(x || "");
          const hasName = (typeof x === "object" && x !== null) && !!x.name;
          return !hasName && needsNameFromDrive(href);
        });
        if (shouldUpgrade) {
          fetchDriveFilesByProductName(product.name).then((objs) => {
            if (objs && objs.length) {
              const byId = new Map(objs.map(o => [extractDriveFileId(o.url), o]));
              const upgraded = localFiles.map(x => {
                const href = (typeof x === "object" && x !== null) ? (x.url || "") : String(x || "");
                const id = extractDriveFileId(href);
                const match = id ? byId.get(id) : null;
                return match ? match : { url: href, name: fileNameFromUrl(href) };
              });
              product.files = upgraded;
              renderAttachmentLinksInto(el, upgraded);
            } else {
              renderAttachmentLinksInto(el, localFiles);
            }
          }).catch(() => { renderAttachmentLinksInto(el, localFiles); });
        } else {
          renderAttachmentLinksInto(el, localFiles);
        }
        continue;
      }
      // Brak lokalnych plików → dociągnij z Drive (cache w state.productFilesCache)
      fetchDriveFilesByProductName(product.name).then((objs) => {
        if (objs && objs.length) {
          product.files = objs;
          renderAttachmentLinksInto(el, objs);
        }
      }).catch(() => {});
    }
  } catch (_) {}
}