/* Elementy DOM */
export const els = {
  currencySelect: document.getElementById("currencySelect"),
  importFromDriveBtn: document.getElementById("importFromDriveBtn"), filterMonth: document.getElementById("filterMonth"), clearFilterBtn: document.getElementById("clearFilterBtn"),
  toggleContainerFormBtn: document.getElementById("toggleContainerFormBtn"),
  containerFormSection: document.getElementById("containerFormSection"),
  containerFormTitle: document.getElementById("containerFormTitle"),
  saveContainerBtn: document.getElementById("saveContainerBtn"),
  cancelContainerBtn: document.getElementById("cancelContainerBtn"),

  // Arkusz (kontener/produkt)
  sheetContainerSelect: document.getElementById("sheetContainerSelect"),
  loadContainerFromSheetBtn: document.getElementById("loadContainerFromSheetBtn"),
  sheetProductSelect: document.getElementById("sheetProductSelect"),
  loadProductFromSheetBtn: document.getElementById("loadProductFromSheetBtn"),

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
  pFiles: document.getElementById("pFiles"),
  pFilesPreview: document.getElementById("pFilesPreview"),

  // Lista
  refreshBtn: document.getElementById("refreshBtn"),
  containerList: document.getElementById("containerList"),

   // Import modal elements
   importModal: document.getElementById("importModal"),
   importTree: document.getElementById("importTree"),
   importRootId: document.getElementById("importRootId"),
   importRunBtn: document.getElementById("importRunBtn"),
   importCloseBtn: document.getElementById("importCloseBtn"),
  };