import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Package, ChevronDown, ChevronUp } from 'lucide-react';

export default function ImportTracker() {
  const [containers, setContainers] = useState([]);
  const [displayCurrency, setDisplayCurrency] = useState('PLN');
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingContainerId, setEditingContainerId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedContainerId, setSelectedContainerId] = useState(null);
  const [expandedContainers, setExpandedContainers] = useState({});
  
  const [containerFormData, setContainerFormData] = useState({
    name: '',
    orderDate: '',
    paymentDate: '',
    productionDays: '',
    deliveryDate: '',
    exchangeRate: '4.0',
    containerCost: '',
    containerCostCurrency: 'USD',
    customsClearanceCost: '',
    customsClearanceCostCurrency: 'USD',
    transportChinaCost: '',
    transportChinaCostCurrency: 'USD',
    transportPolandCost: '',
    transportPolandCostCurrency: 'USD',
    insuranceCost: '',
    insuranceCostCurrency: 'USD',
    totalTransportCbm: '',
    additionalCosts: '',
    additionalCostsCurrency: 'USD',
    pickedUpInChina: false,
    customsClearanceDone: false,
    deliveredToWarehouse: false,
    documentsInSystem: false,
  });

  const [productFormData, setProductFormData] = useState({
    name: '',
    quantity: '',
    totalPrice: '',
    totalPriceCurrency: 'USD',
    productCbm: '',
    customsDutyPercent: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('importContainers');
    if (saved) {
      setContainers(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('importContainers', JSON.stringify(containers));
  }, [containers]);

  const calculatePickupDate = (orderDate, productionDays) => {
    if (!orderDate || !productionDays) return null;
    const date = new Date(orderDate);
    date.setDate(date.getDate() + parseInt(productionDays));
    return date;
  };

  const getStatusColor = (container) => {
    if (container.documentsInSystem) {
      return 'bg-green-500 border-green-600';
    }
    
    if (container.deliveredToWarehouse) {
      return 'bg-gradient-to-r from-green-200 to-yellow-200 border-green-400';
    }
    
    if (container.customsClearanceDone) {
      return 'bg-purple-200 border-purple-400';
    }
    
    if (container.pickedUpInChina) {
      return 'bg-gray-200 border-gray-400';
    }
    
    if (!container.pickupDate) return 'bg-gray-100';
    const today = new Date();
    const pickup = new Date(container.pickupDate);
    const daysUntil = Math.ceil((pickup - today) / (1000 * 60 * 60 * 24));
    
    if (!container.paymentDate) {
      if (daysUntil < 0) return 'bg-red-100 border-red-300';
      if (daysUntil <= 3) return 'bg-blue-100 border-blue-300';
      return 'bg-pink-100 border-pink-300';
    }
    
    if (daysUntil < 0) return 'bg-red-100 border-red-300';
    if (daysUntil <= 4) return 'bg-purple-200 border-purple-400';
    
    const payment = new Date(container.paymentDate);
    const daysPassedFromPayment = Math.ceil((today - payment) / (1000 * 60 * 60 * 24));
    
    if (daysPassedFromPayment > 0 && daysUntil <= 7) return 'bg-blue-100 border-blue-300';
    
    return 'bg-pink-100 border-pink-300';
  };

  const toUSD = (amount, currency, exchangeRate) => {
    if (currency === 'USD') return amount;
    return amount / exchangeRate;
  };

  const convertPrice = (priceUSD, exchangeRate) => {
    if (displayCurrency === 'PLN') {
      return (priceUSD * exchangeRate).toFixed(2) + ' zł';
    }
    return priceUSD.toFixed(2) + ' $';
  };

  const calculateProductCosts = (product, container) => {
    const exchangeRate = parseFloat(container.exchangeRate) || 4.0;
    const totalPriceUSD = toUSD(parseFloat(product.totalPrice) || 0, product.totalPriceCurrency, exchangeRate);
    const quantity = parseFloat(product.quantity) || 1;
    const pricePerUnit = totalPriceUSD / quantity;

    const containerCostUSD = toUSD(parseFloat(container.containerCost) || 0, container.containerCostCurrency, exchangeRate);
    const customsClearanceCostUSD = toUSD(parseFloat(container.customsClearanceCost) || 0, container.customsClearanceCostCurrency, exchangeRate);
    const transportChinaCostUSD = toUSD(parseFloat(container.transportChinaCost) || 0, container.transportChinaCostCurrency, exchangeRate);
    const transportPolandCostUSD = toUSD(parseFloat(container.transportPolandCost) || 0, container.transportPolandCostCurrency, exchangeRate);
    const insuranceCostUSD = toUSD(parseFloat(container.insuranceCost) || 0, container.insuranceCostCurrency, exchangeRate);
    
    const totalTransportCostUSD = containerCostUSD + customsClearanceCostUSD + transportChinaCostUSD + transportPolandCostUSD + insuranceCostUSD;
    
    const totalCbm = parseFloat(container.totalTransportCbm) || 1;
    const productCbm = parseFloat(product.productCbm) || 0;
    const costPerCbm = totalTransportCostUSD / totalCbm;
    const transportPerUnit = (costPerCbm * productCbm) / quantity;

    const productValue = totalPriceUSD;
    const transportToEU = (containerCostUSD + transportChinaCostUSD + insuranceCostUSD) * (productCbm / totalCbm);
    const celnaValue = productValue + transportToEU;

    const dutyPercent = parseFloat(product.customsDutyPercent) || 0;
    const dutyAmount = celnaValue * (dutyPercent / 100);

    const transportPolandForProduct = transportPolandCostUSD * (productCbm / totalCbm);
    
    const vatBase = celnaValue + dutyAmount + transportPolandForProduct;
    const vatAmount = vatBase * 0.23;
    
    const totalCustoms = dutyAmount + vatAmount;

    const additionalCostsUSD = toUSD(parseFloat(container.additionalCosts) || 0, container.additionalCostsCurrency, exchangeRate);
    const totalProductCbm = containers
      .find(c => c.id === container.id)?.products
      ?.reduce((sum, p) => sum + (parseFloat(p.productCbm) || 0), 0) || 1;
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
        total: totalTransportCostUSD
      }
    };
  };

  const calculateContainerTotals = (container) => {
    if (!container.products || container.products.length === 0) {
      return { nettoTotal: 0, bruttoTotal: 0, totalProducts: 0 };
    }

    let nettoTotal = 0;
    let bruttoTotal = 0;

    container.products.forEach(product => {
      const costs = calculateProductCosts(product, container);
      const netto = (costs.pricePerUnit + costs.transportPerUnit + (costs.dutyAmount / costs.quantity) + costs.additionalPerUnit) * costs.quantity;
      const brutto = costs.totalCostPerUnit * costs.quantity;
      nettoTotal += netto;
      bruttoTotal += brutto;
    });

    return {
      nettoTotal,
      bruttoTotal,
      totalProducts: container.products.length
    };
  };

  const handleSaveContainer = () => {
    if (!containerFormData.name || !containerFormData.orderDate || !containerFormData.productionDays || !containerFormData.exchangeRate) {
      alert('Wypełnij wszystkie wymagane pola kontenera!');
      return;
    }
    
    const pickupDate = calculatePickupDate(containerFormData.orderDate, containerFormData.productionDays);
    
    const containerData = {
      ...containerFormData,
      pickupDate: pickupDate ? pickupDate.toISOString().split('T')[0] : null,
      products: [],
    };

    if (editingContainerId) {
      setContainers(containers.map(c => 
        c.id === editingContainerId 
          ? {...containerData, id: editingContainerId, products: c.products} 
          : c
      ));
      setEditingContainerId(null);
    } else {
      setContainers([...containers, {...containerData, id: Date.now()}]);
    }
    
    setContainerFormData({
      name: '',
      orderDate: '',
      paymentDate: '',
      productionDays: '',
      deliveryDate: '',
      exchangeRate: '4.0',
      containerCost: '',
      containerCostCurrency: 'USD',
      customsClearanceCost: '',
      customsClearanceCostCurrency: 'USD',
      transportChinaCost: '',
      transportChinaCostCurrency: 'USD',
      transportPolandCost: '',
      transportPolandCostCurrency: 'USD',
      insuranceCost: '',
      insuranceCostCurrency: 'USD',
      totalTransportCbm: '',
      additionalCosts: '',
      additionalCostsCurrency: 'USD',
      pickedUpInChina: false,
      customsClearanceDone: false,
      deliveredToWarehouse: false,
      documentsInSystem: false,
    });
    setShowContainerForm(false);
  };

  const handleSaveProduct = () => {
    if (!productFormData.name || !productFormData.quantity || !productFormData.totalPrice) {
      alert('Wypełnij wszystkie wymagane pola produktu!');
      return;
    }

    if (!selectedContainerId) {
      alert('Wybierz kontener!');
      return;
    }

    const productData = {
      ...productFormData,
      id: editingProductId || Date.now(),
    };

    setContainers(containers.map(c => {
      if (c.id === selectedContainerId) {
        if (editingProductId) {
          return {
            ...c,
            products: c.products.map(p => p.id === editingProductId ? productData : p)
          };
        } else {
          return {
            ...c,
            products: [...(c.products || []), productData]
          };
        }
      }
      return c;
    }));

    setProductFormData({
      name: '',
      quantity: '',
      totalPrice: '',
      totalPriceCurrency: 'USD',
      productCbm: '',
      customsDutyPercent: '',
    });
    setEditingProductId(null);
    setShowProductForm(false);
  };

  const togglePickup = (id) => {
    setContainers(containers.map(c => 
      c.id === id ? {...c, pickedUpInChina: !c.pickedUpInChina} : c
    ));
  };

  const toggleCustoms = (id) => {
    setContainers(containers.map(c => 
      c.id === id ? {...c, customsClearanceDone: !c.customsClearanceDone} : c
    ));
  };

  const toggleWarehouse = (id) => {
    setContainers(containers.map(c => 
      c.id === id ? {...c, deliveredToWarehouse: !c.deliveredToWarehouse} : c
    ));
  };

  const toggleDocuments = (id) => {
    setContainers(containers.map(c => 
      c.id === id ? {...c, documentsInSystem: !c.documentsInSystem} : c
    ));
  };

  const deleteContainer = (id) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten kontener wraz z wszystkimi produktami?')) {
      setContainers(containers.filter(c => c.id !== id));
    }
  };

  const deleteProduct = (containerId, productId) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten produkt?')) {
      setContainers(containers.map(c => 
        c.id === containerId 
          ? {...c, products: c.products.filter(p => p.id !== productId)} 
          : c
      ));
    }
  };

  const toggleExpand = (id) => {
    setExpandedContainers(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="text-indigo-600" />
                Zarządzanie Importem z Chin
              </h1>
              <p className="text-gray-600 mt-1">System śledzenia kontenerów i produktów</p>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayCurrency('PLN')}
                  className={`px-4 py-2 rounded-lg font-semibold ${displayCurrency === 'PLN' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  PLN
                </button>
                <button
                  onClick={() => setDisplayCurrency('USD')}
                  className={`px-4 py-2 rounded-lg font-semibold ${displayCurrency === 'USD' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  USD
                </button>
              </div>
              
              <button
                onClick={() => setShowContainerForm(!showContainerForm)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
              >
                <Plus size={20} />
                Dodaj Kontener
              </button>
            </div>
          </div>

          {showContainerForm && (
            <div className="bg-gray-50 p-6 rounded-lg mb-6 border-2 border-indigo-200">
              <h2 className="text-xl font-bold mb-4">{editingContainerId ? 'Edytuj Kontener' : 'Nowy Kontener'}</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Informacje o kontenerze</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa Kontenera *</label>
                      <input
                        type="text"
                        value={containerFormData.name}
                        onChange={(e) => setContainerFormData({...containerFormData, name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="np. Kontener 2024-11"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kurs USD *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={containerFormData.exchangeRate}
                        onChange={(e) => setContainerFormData({...containerFormData, exchangeRate: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="4.15"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Daty</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Zamówienia *</label>
                      <input
                        type="date"
                        value={containerFormData.orderDate}
                        onChange={(e) => setContainerFormData({...containerFormData, orderDate: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Opłacenia</label>
                      <input
                        type="date"
                        value={containerFormData.paymentDate}
                        onChange={(e) => setContainerFormData({...containerFormData, paymentDate: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Czas Produkcji (dni) *</label>
                      <input
                        type="number"
                        value={containerFormData.productionDays}
                        onChange={(e) => setContainerFormData({...containerFormData, productionDays: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Dostawy</label>
                      <input
                        type="date"
                        value={containerFormData.deliveryDate}
                        onChange={(e) => setContainerFormData({...containerFormData, deliveryDate: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Transport i koszty</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Koszt kontenera</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.containerCost}
                          onChange={(e) => setContainerFormData({...containerFormData, containerCost: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, containerCostCurrency: containerFormData.containerCostCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.containerCostCurrency}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Koszt odprawy</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.customsClearanceCost}
                          onChange={(e) => setContainerFormData({...containerFormData, customsClearanceCost: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, customsClearanceCostCurrency: containerFormData.customsClearanceCostCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.customsClearanceCostCurrency}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transport w Chinach</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.transportChinaCost}
                          onChange={(e) => setContainerFormData({...containerFormData, transportChinaCost: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, transportChinaCostCurrency: containerFormData.transportChinaCostCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.transportChinaCostCurrency}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transport w Polsce</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.transportPolandCost}
                          onChange={(e) => setContainerFormData({...containerFormData, transportPolandCost: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, transportPolandCostCurrency: containerFormData.transportPolandCostCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.transportPolandCostCurrency}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ubezpieczenie</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.insuranceCost}
                          onChange={(e) => setContainerFormData({...containerFormData, insuranceCost: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, insuranceCostCurrency: containerFormData.insuranceCostCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.insuranceCostCurrency}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Całkowite CBM</label>
                      <input
                        type="number"
                        step="0.001"
                        value={containerFormData.totalTransportCbm}
                        onChange={(e) => setContainerFormData({...containerFormData, totalTransportCbm: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="20"
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Koszty Dodatkowe</label>
                        <input
                          type="number"
                          step="0.01"
                          value={containerFormData.additionalCosts}
                          onChange={(e) => setContainerFormData({...containerFormData, additionalCosts: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                        <button
                          type="button"
                          onClick={() => setContainerFormData({...containerFormData, additionalCostsCurrency: containerFormData.additionalCostsCurrency === 'USD' ? 'PLN' : 'USD'})}
                          className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                        >
                          {containerFormData.additionalCostsCurrency}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button 
                  onClick={handleSaveContainer}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Save size={18} />
                  {editingContainerId ? 'Zapisz Zmiany' : 'Dodaj Kontener'}
                </button>
                <button
                  onClick={() => {
                    setShowContainerForm(false);
                    setEditingContainerId(null);
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 flex items-center gap-2"
                >
                  <X size={18} />
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {showProductForm && (
            <div className="bg-green-50 p-6 rounded-lg mb-6 border-2 border-green-300">
              <h2 className="text-xl font-bold mb-4">{editingProductId ? 'Edytuj Produkt' : 'Dodaj Produkt'}</h2>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa Produktu *</label>
                  <input
                    type="text"
                    value={productFormData.name}
                    onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Zabawka XYZ"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ilość *</label>
                  <input
                    type="number"
                    value={productFormData.quantity}
                    onChange={(e) => setProductFormData({...productFormData, quantity: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="1000"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Całkowita Cena *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productFormData.totalPrice}
                      onChange={(e) => setProductFormData({...productFormData, totalPrice: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="5500"
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Waluta</label>
                    <button
                      type="button"
                      onClick={() => setProductFormData({...productFormData, totalPriceCurrency: productFormData.totalPriceCurrency === 'USD' ? 'PLN' : 'USD'})}
                      className="w-full px-2 py-2 border rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
                    >
                      {productFormData.totalPriceCurrency}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CBM</label>
                  <input
                    type="number"
                    step="0.001"
                    value={productFormData.productCbm}
                    onChange={(e) => setProductFormData({...productFormData, productCbm: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="5.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cło (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={productFormData.customsDutyPercent}
                    onChange={(e) => setProductFormData({...productFormData, customsDutyPercent: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="12"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={handleSaveProduct}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Save size={18} />
                  {editingProductId ? 'Zapisz' : 'Dodaj'}
                </button>
                <button
                  onClick={() => {
                    setShowProductForm(false);
                    setEditingProductId(null);
                    setProductFormData({
                      name: '',
                      quantity: '',
                      totalPrice: '',
                      totalPriceCurrency: 'USD',
                      productCbm: '',
                      customsDutyPercent: '',
                    });
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 flex items-center gap-2"
                >
                  <X size={18} />
                  Anuluj
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {containers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <p>Brak kontenerów. Dodaj pierwszy kontener.</p>
              </div>
            ) : (
              containers.map((container) => {
                const totals = calculateContainerTotals(container);
                const isExpanded = expandedContainers[container.id];
                const exchangeRate = parseFloat(container.exchangeRate) || 4.0;
                
                return (
                  <div
                    key={container.id}
                    className={`border-2 rounded-lg p-4 ${getStatusColor(container)}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleExpand(container.id)}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                          </button>
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{container.name}</h3>
                            <p className="text-sm text-gray-600">
                              Produktów: {totals.totalProducts} | 
                              Kurs: {exchangeRate} | 
                              Netto: <span className="font-semibold text-green-700">{convertPrice(totals.nettoTotal, exchangeRate)}</span> | 
                              Brutto: <span className="font-semibold text-indigo-700">{convertPrice(totals.bruttoTotal, exchangeRate)}</span>
                            </p>
                          </div>
                        </div>
                        
                        {container.documentsInSystem && (
                          <p className="text-sm font-bold text-green-700 mt-2 ml-11">✓ Dokumenty w księgowości!</p>
                        )}
                        {!container.documentsInSystem && container.deliveredToWarehouse && (
                          <p className="text-sm font-bold text-green-700 mt-2 ml-11">✓ Towar na magazynie!</p>
                        )}
                        {!container.documentsInSystem && !container.deliveredToWarehouse && container.pickupDate && (() => {
                          const today = new Date();
                          const pickup = new Date(container.pickupDate);
                          const daysUntil = Math.ceil((pickup - today) / (1000 * 60 * 60 * 24));
                          if (daysUntil >= 0 && daysUntil <= 4) {
                            return <p className="text-sm font-semibold text-orange-600 mt-2 ml-11">⚠️ Odbiór za {daysUntil} dni!</p>;
                          } else if (daysUntil < 0) {
                            return <p className="text-sm font-semibold text-red-600 mt-2 ml-11">❗ Termin odbioru minął!</p>;
                          }
                          return null;
                        })()}
                        
                        <div className="flex gap-3 mt-2 ml-11 flex-wrap">
                          <button
                            onClick={() => togglePickup(container.id)}
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              container.pickedUpInChina 
                                ? 'bg-green-500 text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {container.pickedUpInChina ? '✓ Odebrano' : 'Odbiór w Chinach'}
                          </button>
                          <button
                            onClick={() => toggleCustoms(container.id)}
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              container.customsClearanceDone 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {container.customsClearanceDone ? '✓ Odprawa' : 'Odprawa celna'}
                          </button>
                          <button
                            onClick={() => toggleWarehouse(container.id)}
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              container.deliveredToWarehouse 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {container.deliveredToWarehouse ? '✓ Na magazynie' : 'Magazyn'}
                          </button>
                          <button
                            onClick={() => toggleDocuments(container.id)}
                            className={`text-xs px-3 py-1 rounded-full font-semibold ${
                              container.documentsInSystem 
                                ? 'bg-green-700 text-white' 
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {container.documentsInSystem ? '✓ W księgowości' : 'Dokumenty księgowe'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedContainerId(container.id);
                              setShowProductForm(true);
                            }}
                            className="text-xs px-3 py-1 rounded-full font-semibold bg-green-500 text-white hover:bg-green-600"
                          >
                            + Produkt
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setContainerFormData(container);
                            setEditingContainerId(container.id);
                            setShowContainerForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => deleteContainer(container.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-3 ml-11">
                      <div>
                        <p className="text-xs text-gray-600">Zamówienie</p>
                        <p className="font-semibold">{container.orderDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Opłacenie</p>
                        <p className="font-semibold">{container.paymentDate || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Odbiór</p>
                        <p className="font-semibold text-indigo-600">{container.pickupDate || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Dostawa</p>
                        <p className="font-semibold">{container.deliveryDate || '-'}</p>
                      </div>
                    </div>

                    {isExpanded && container.products && container.products.length > 0 && (
                      <div className="ml-11 mt-4 space-y-3 border-l-4 border-indigo-300 pl-4">
                        {container.products.map(product => {
                          const costs = calculateProductCosts(product, container);
                          
                          return (
                            <div key={product.id} className="bg-white bg-opacity-70 rounded-lg p-4 border border-gray-300">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold text-gray-800">{product.name}</h4>
                                  <p className="text-sm text-gray-600">Ilość: {product.quantity} szt.</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setProductFormData(product);
                                      setEditingProductId(product.id);
                                      setSelectedContainerId(container.id);
                                      setShowProductForm(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => deleteProduct(container.id, product.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                                <p className="text-xs font-semibold text-blue-900 mb-1">Należności Celne - Szczegóły</p>
                                <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                                  <div>
                                    <p className="text-gray-600">Wartość towaru</p>
                                    <p className="font-semibold">{convertPrice(costs.productValue, exchangeRate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Transport do UE</p>
                                    <p className="font-semibold">{convertPrice(costs.transportToEU, exchangeRate)}</p>
                                  </div>
                                </div>
                                <div className="border-t border-blue-200 pt-2 mb-2">
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                      <p className="text-gray-600">Wartość celna</p>
                                      <p className="font-semibold text-purple-700">{convertPrice(costs.celnaValue, exchangeRate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Cło ({costs.dutyPercent}%)</p>
                                      <p className="font-semibold text-orange-600">{convertPrice(costs.dutyAmount, exchangeRate)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-blue-200 pt-2">
                                  <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div>
                                      <p className="text-gray-600">Transport w PL</p>
                                      <p className="font-semibold">{convertPrice(costs.transportPolandForProduct, exchangeRate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">Podstawa VAT</p>
                                      <p className="font-semibold text-indigo-700">{convertPrice(costs.vatBase, exchangeRate)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600">VAT (23%)</p>
                                      <p className="font-semibold text-blue-600">{convertPrice(costs.vatAmount, exchangeRate)}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-blue-300 pt-2 mt-2">
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-gray-700">Razem należności (Cło + VAT)</p>
                                    <p className="font-bold text-red-600">{convertPrice(costs.totalCustoms, exchangeRate)}</p>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">Na sztukę: {convertPrice(costs.totalCustoms / costs.quantity, exchangeRate)}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-green-50 rounded p-2">
                                  <p className="text-xs text-gray-600">NETTO</p>
                                  <p className="font-bold text-green-700">{convertPrice(costs.pricePerUnit + costs.transportPerUnit + (costs.dutyAmount / costs.quantity) + costs.additionalPerUnit, exchangeRate)}/szt</p>
                                  <p className="text-xs text-gray-600 mt-1">Razem: {convertPrice((costs.pricePerUnit + costs.transportPerUnit + (costs.dutyAmount / costs.quantity) + costs.additionalPerUnit) * costs.quantity, exchangeRate)}</p>
                                </div>
                                <div className="bg-indigo-50 rounded p-2">
                                  <p className="text-xs text-gray-600">BRUTTO</p>
                                  <p className="font-bold text-indigo-700">{convertPrice(costs.totalCostPerUnit, exchangeRate)}/szt</p>
                                  <p className="text-xs text-gray-600 mt-1">Razem: {convertPrice(costs.totalCostPerUnit * costs.quantity, exchangeRate)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {isExpanded && (!container.products || container.products.length === 0) && (
                      <div className="ml-11 mt-4 text-center py-8 text-gray-500 bg-white bg-opacity-50 rounded-lg">
                        <p>Brak produktów</p>
                        <button
                          onClick={() => {
                            setSelectedContainerId(container.id);
                            setShowProductForm(true);
                          }}
                          className="mt-2 text-sm px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Dodaj produkt
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4">
          <h3 className="font-semibold mb-2">Legenda kolorów:</h3>
          <div className="flex gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 border-2 border-green-600 rounded"></div>
              <span>Dokumenty w księgowości</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gradient-to-r from-green-200 to-yellow-200 border-2 border-green-400 rounded"></div>
              <span>Dostarczono na magazyn</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-200 border-2 border-purple-400 rounded"></div>
              <span>Odprawa celna opłacona</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 border-2 border-gray-400 rounded"></div>
              <span>Odebrano w Chinach</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
              <span>W produkcji</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-100 border-2 border-pink-300 rounded"></div>
              <span>Na czas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
              <span>Po terminie</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}