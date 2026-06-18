/* Stan aplikacji */
export const _rawState = {
  containers: [],
  displayCurrency: "PLN",
  showContainerForm: false,
  showProductForm: false,
  editingContainerId: null,
  editingProductId: null,
  selectedContainerId: null,
  expanded: {},
  sheetContainers: [],
  sheetProducts: [],
  productOriginalFiles: [],
  filterMonth: null,
  isSyncingFromSheet: false,
  isSyncingProducts: false,
  productFilesCache: {},
};

// State modification wrapper for better stability
export const state = new Proxy(_rawState, {
  set(target, prop, value) {
    // Optionally log or validate state changes here
    target[prop] = value;
    return true;
  }
});