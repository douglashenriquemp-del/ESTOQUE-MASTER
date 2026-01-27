
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Transaction, TransactionType, CostHistoryEntry } from './types';
import { storageService } from './services/storageService';
import { exportService } from './services/exportService';
import { 
  PlusIcon, 
  MinusIcon, 
  EditIcon, 
  DownloadIcon, 
  HistoryIcon, 
  PackageIcon,
  SortIcon,
  AlertTriangleIcon,
  StatsIcon,
  OutOfStockIcon,
  TrashIcon,
  TrendingUpIcon,
  CalendarIcon
} from './components/Icons';

type View = 'inventory' | 'history' | 'stats';
type SortField = 'name' | 'code' | 'currentStock';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const CategoryFilter: React.FC<{
  categories: string[];
  selected: string;
  onSelect: (cat: string) => void;
}> = ({ categories, selected, onSelect }) => (
  <div className="flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2 border border-slate-200 shadow-sm transition-all hover:border-indigo-300">
    <span className="text-slate-500">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
    </span>
    <select 
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="bg-transparent border-none text-[11px] md:text-xs font-semibold text-slate-700 focus:ring-0 outline-none cursor-pointer pr-1"
    >
      <option value="Todas">Todas Categorias</option>
      {categories.map(cat => (
        <option key={cat} value={cat}>{cat}</option>
      ))}
    </select>
  </div>
);

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentView, setCurrentView] = useState<View>('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  
  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productForAnalysis, setProductForAnalysis] = useState<Product | null>(null);
  const [modalType, setModalType] = useState<TransactionType | 'add' | 'edit' | 'bulkAdd' | null>(null);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  
  // Form states
  const [quantity, setQuantity] = useState<number>(0);
  const [transactionCost, setTransactionCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
    monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0
  });

  useEffect(() => {
    setProducts(storageService.getProducts());
    setTransactions(storageService.getTransactions());
  }, []);

  useEffect(() => {
    if (products.length > 0) storageService.saveProducts(products);
  }, [products]);

  useEffect(() => {
    storageService.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const processedProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'Todas') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      p.code.includes(debouncedSearchTerm)
    );
    return [...filtered].sort((a, b) => {
      let aValue = a[sortConfig.field];
      let bValue = b[sortConfig.field];
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }
      if (aValue === bValue) return 0;
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [products, debouncedSearchTerm, sortConfig, selectedCategory]);

  const stats = useMemo(() => {
    const totalItems = products.reduce((acc, p) => acc + p.currentStock, 0);
    const criticalProducts = products.filter(p => p.currentStock <= p.minStock);
    const totalValue = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    const totalSaleValue = products.reduce((acc, p) => acc + (p.currentStock * p.salePrice), 0);
    
    const categoryValues = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + (p.currentStock * p.costPrice);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems,
      criticalCount: criticalProducts.length,
      totalValue,
      totalSaleValue,
      uniqueItemsCount: products.length,
      categoryValues,
      criticalProducts: criticalProducts.slice(0, 5)
    };
  }, [products]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === processedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedProducts.map(p => p.id)));
    }
  };

  const handleTransaction = () => {
    if (!selectedProduct || quantity <= 0) return;
    if (modalType === TransactionType.EXIT && !showConfirmStep) {
      setShowConfirmStep(true);
      return;
    }

    const timestamp = new Date().toISOString();
    const newTransactions: Transaction[] = [
      {
        id: crypto.randomUUID(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: modalType as TransactionType,
        quantity,
        unitCost: transactionCost,
        date: timestamp,
        notes: modalType !== TransactionType.EXIT && transactionCost !== selectedProduct.costPrice 
          ? `${notes ? notes + ' | ' : ''}Preço atualizado de ${currencyFormatter.format(selectedProduct.costPrice)} para ${currencyFormatter.format(transactionCost)}`
          : notes
      },
      ...transactions
    ];

    const updatedProducts = products.map(p => {
      if (p.id === selectedProduct.id) {
        let newStock = p.currentStock;
        if (modalType === TransactionType.ENTRY) newStock += quantity;
        if (modalType === TransactionType.EXIT) newStock -= quantity;
        if (modalType === TransactionType.ADJUSTMENT) newStock = quantity;
        
        const newCostPrice = (modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) 
          ? transactionCost 
          : p.costPrice;
        
        // Verifica se o preço realmente mudou para atualizar o preço anterior e o histórico
        const costChanged = newCostPrice !== p.costPrice;
        const previousCostPrice = costChanged ? p.costPrice : p.previousCostPrice;
        
        let updatedHistory = [...(p.costHistory || [])];
        if (costChanged || updatedHistory.length === 0) {
          // Adiciona novo registro e mantém apenas os últimos 5
          updatedHistory = [{ price: newCostPrice, date: timestamp }, ...updatedHistory].slice(0, 5);
        }

        return { 
          ...p, 
          previousStock: p.currentStock,
          currentStock: Math.max(0, newStock), 
          costPrice: newCostPrice,
          previousCostPrice: previousCostPrice,
          costHistory: updatedHistory
        };
      }
      return p;
    });

    setTransactions(newTransactions);
    setProducts(updatedProducts);
    closeModal();
  };

  const handleBulkZeroStock = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Zerar o estoque de ${selectedIds.size} itens selecionados?`)) return;

    const timestamp = new Date().toISOString();
    const newTransactions: Transaction[] = [];
    
    const updatedProducts = products.map(p => {
      if (selectedIds.has(p.id)) {
        if (p.currentStock > 0) {
          newTransactions.push({
            id: crypto.randomUUID(),
            productId: p.id,
            productName: p.name,
            type: TransactionType.ADJUSTMENT,
            quantity: 0,
            unitCost: p.costPrice,
            date: timestamp,
            notes: 'Ajuste em massa: Zerar estoque'
          });
        }
        return { ...p, previousStock: p.currentStock, currentStock: 0 };
      }
      return p;
    });

    setTransactions([...newTransactions, ...transactions]);
    setProducts(updatedProducts);
    setSelectedIds(new Set());
    setShowBulkMenu(false);
  };

  const handleBulkAddStock = () => {
    if (selectedIds.size === 0) return;
    setModalType('bulkAdd');
    setQuantity(0);
    setShowBulkMenu(false);
  };

  const confirmBulkAdd = () => {
    if (quantity <= 0) return;
    const timestamp = new Date().toISOString();
    const newTransactions: Transaction[] = [];

    const updatedProducts = products.map(p => {
      if (selectedIds.has(p.id)) {
        newTransactions.push({
          id: crypto.randomUUID(),
          productId: p.id,
          productName: p.name,
          type: TransactionType.ENTRY,
          quantity: quantity,
          unitCost: p.costPrice,
          date: timestamp,
          notes: `Entrada em massa: +${quantity} unidades`
        });
        return { ...p, previousStock: p.currentStock, currentStock: p.currentStock + quantity };
      }
      return p;
    });

    setTransactions([...newTransactions, ...transactions]);
    setProducts(updatedProducts);
    setSelectedIds(new Set());
    closeModal();
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir permanentemente os ${selectedIds.size} itens selecionados?`)) return;
    
    setProducts(products.filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setShowBulkMenu(false);
  };

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.category) {
      alert("Por favor, preencha o nome e a categoria.");
      return;
    }

    const timestamp = new Date().toISOString();

    if (modalType === 'edit' && selectedProduct) {
      const updated = products.map(p => {
        if (p.id === selectedProduct.id) {
          let updatedHistory = [...(p.costHistory || [])];
          if (productForm.costPrice !== undefined && productForm.costPrice !== p.costPrice) {
            updatedHistory = [{ price: productForm.costPrice, date: timestamp }, ...updatedHistory].slice(0, 5);
          }
          return { ...p, ...productForm, costHistory: updatedHistory } as Product;
        }
        return p;
      });
      setProducts(updated);
    } else {
      const product: Product = {
        id: crypto.randomUUID(),
        name: productForm.name!,
        code: productForm.code || 'N/A',
        category: productForm.category!,
        unit: productForm.unit || 'KG',
        safetyStock: Number(productForm.safetyStock) || 0,
        minStock: Number(productForm.minStock) || 0,
        monthlyConsumption: Number(productForm.monthlyConsumption) || 0,
        currentStock: Number(productForm.currentStock) || 0,
        previousStock: Number(productForm.currentStock) || 0,
        costPrice: Number(productForm.costPrice) || 0,
        salePrice: Number(productForm.salePrice) || 0,
        previousCostPrice: Number(productForm.costPrice) || 0,
        costHistory: [{ price: Number(productForm.costPrice) || 0, date: timestamp }]
      };
      setProducts([product, ...products]);
    }
    closeModal();
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setProductToDelete(null);
    setProductForAnalysis(null);
    setModalType(null);
    setQuantity(0);
    setTransactionCost(0);
    setNotes('');
    setShowConfirmStep(false);
    setProductForm({
      name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
      monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0
    });
  };

  const openTransactionModal = (product: Product, type: TransactionType) => {
    setSelectedProduct(product);
    setModalType(type);
    setTransactionCost(product.costPrice);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({ ...product });
    setModalType('edit');
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64 bg-slate-50/50 text-slate-900">
      {/* Sidebar - Desktop */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-40 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-screen md:flex-col md:justify-start md:p-6 md:border-r md:border-t-0 shadow-xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-10 text-indigo-600 font-bold text-xl px-2">
          <div className="bg-indigo-600 text-white p-2 rounded-xl"><PackageIcon /></div>
          <span>EstoqueMaster</span>
        </div>
        
        <div className="flex w-full justify-around md:flex-col md:gap-2">
          <button onClick={() => setCurrentView('inventory')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'inventory' ? 'text-indigo-600 md:bg-indigo-50 font-bold scale-105 md:scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
            <PackageIcon /> <span className="text-[10px] md:text-base">Estoque</span>
          </button>
          <button onClick={() => setCurrentView('history')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'history' ? 'text-indigo-600 md:bg-indigo-50 font-bold scale-105 md:scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
            <HistoryIcon /> <span className="text-[10px] md:text-base">Histórico</span>
          </button>
          <button onClick={() => setCurrentView('stats')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'stats' ? 'text-indigo-600 md:bg-indigo-50 font-bold scale-105 md:scale-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
            <StatsIcon /> <span className="text-[10px] md:text-base">Painel</span>
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 p-4 z-30 flex flex-col md:flex-row justify-between items-center gap-4 md:px-8 md:py-6">
        <div className="w-full md:w-auto flex items-center gap-4">
          {currentView === 'inventory' && (
            <button 
              onClick={selectAll} 
              className={`p-2 rounded-xl transition-all border-2 ${selectedIds.size === processedProducts.length && processedProducts.length > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}
              title="Selecionar Todos"
            >
              <SortIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
              {currentView === 'inventory' ? 'Inventário' : currentView === 'history' ? 'Histórico' : 'Dashboard'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">Gestão inteligente de insumos</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          {currentView === 'inventory' && (
            <>
              <div className="relative flex-1 md:w-64">
                <input type="text" placeholder="Buscar material..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-100 border-none rounded-2xl py-2.5 px-5 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
              </div>
              <CategoryFilter categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
              <button onClick={() => setModalType('add')} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                <PlusIcon /> Novo Item
              </button>
            </>
          )}
          <button 
            onClick={() => exportService.exportToExcel(products, transactions)} 
            className="p-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            title="Exportar Excel Completo"
          >
            <DownloadIcon />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto relative">
        {currentView === 'inventory' ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3 pb-32">
            {processedProducts.map(product => {
              const isOutOfStock = product.currentStock === 0;
              const isRed = product.currentStock <= product.minStock;
              const isYellow = !isRed && product.currentStock <= product.minStock * 1.5;
              
              const isSelected = selectedIds.has(product.id);
              const history = product.costHistory || [];

              const autonomyDays = product.monthlyConsumption > 0 
                ? Math.floor((product.currentStock / product.monthlyConsumption) * 30) 
                : null;

              const isCostUp = product.previousCostPrice !== undefined && product.costPrice > product.previousCostPrice;

              return (
                <div 
                  key={product.id} 
                  onClick={() => toggleSelection(product.id)}
                  className={`group relative bg-white rounded-[40px] border-2 p-8 shadow-sm transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-indigo-100' : isOutOfStock ? 'border-slate-800' : isRed ? 'border-red-400' : 'border-slate-100 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1'}`}
                >
                  <div className={`absolute top-6 right-6 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white opacity-0 group-hover:opacity-100'}`}>
                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {isOutOfStock ? (
                      <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1"><OutOfStockIcon /> Esgotado</span>
                    ) : isRed && (
                      <span className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1 animate-pulse">
                        <AlertTriangleIcon /> 
                        Crítico 
                        {autonomyDays !== null && (
                          <span className="ml-1 opacity-90 border-l border-white/20 pl-1.5 flex items-center gap-1">
                             <CalendarIcon /> {autonomyDays} dias
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-[9px] font-black text-slate-400 px-3 py-1.5 bg-slate-100 rounded-full uppercase">COD: {product.code}</span>
                  </div>

                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`mt-2 w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm border border-white/20 ${isRed ? 'bg-red-500 animate-pulse' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`} title={isRed ? 'Estoque Crítico' : isYellow ? 'Atenção: Nível Baixo' : 'Estoque Estável'}></div>
                    <h3 className="font-bold text-slate-800 text-xl leading-tight h-14 line-clamp-2">{product.name}</h3>
                  </div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">{product.category}</p>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-6 mb-6">
                    <div className="relative group/cost">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Unitário</p>
                      <div className="flex items-center gap-1.5">
                        <p 
                          key={product.costPrice} 
                          className={`font-black text-base transition-all duration-500 ${isCostUp ? 'animate-cost-bounce animate-cost-up-glow' : 'text-slate-700'}`}
                        >
                          {currencyFormatter.format(product.costPrice)}
                        </p>
                        {isCostUp && (
                          <span className="text-red-500 animate-bounce scale-75" title="Aumento de custo detectado!">
                            <TrendingUpIcon />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Preço Venda</p>
                      <p className="font-black text-emerald-700 text-base">{currencyFormatter.format(product.salePrice)}</p>
                    </div>
                  </div>

                  <div className="mb-6 space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Estoque Atual</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black tabular-nums ${isOutOfStock ? 'text-slate-900' : isRed ? 'text-red-600' : isYellow ? 'text-amber-600' : 'text-emerald-600'}`}>{product.currentStock}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{product.unit}</span>
                      </div>
                    </div>
                    
                    <div className={`flex justify-between items-center p-3 px-4 rounded-xl border transition-all duration-500 ${autonomyDays !== null && autonomyDays < 10 ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' : 'bg-indigo-50/30 border-indigo-100/50 text-indigo-400'}`}>
                      <div className="flex items-center gap-2">
                        <CalendarIcon />
                        <p className="text-[9px] font-black uppercase tracking-tight">Tempo de Autonomia</p>
                      </div>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg shadow-sm ${autonomyDays !== null && autonomyDays < 10 ? 'bg-red-600 text-white' : 'bg-white text-indigo-600'}`}>
                        {autonomyDays !== null ? `${Math.floor(autonomyDays)} dias` : 'Indeterminado'}
                      </span>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="bg-slate-50/50 rounded-3xl p-5 mb-0 border border-slate-100/50 transition-all group-hover:opacity-40">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                        <HistoryIcon /> Evolução de Preços
                      </p>
                      <div className="space-y-2.5">
                        {history.slice(0, 3).map((h, i) => {
                          const nextPrice = history[i + 1]?.price;
                          const hasChanged = nextPrice !== undefined;
                          const isUp = hasChanged && h.price > nextPrice;
                          const isDown = hasChanged && h.price < nextPrice;

                          return (
                            <div key={i} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">
                                  {new Date(h.date).toLocaleDateString('pt-BR')}
                                </span>
                                {isUp && <span className="text-red-500 scale-75"><TrendingUpIcon /></span>}
                                {isDown && <span className="text-emerald-500 scale-75 rotate-180"><TrendingUpIcon /></span>}
                              </div>
                              <span className="text-[10px] font-black text-slate-700">
                                {currencyFormatter.format(h.price)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ações Rápidas (Overlay no Hover) */}
                  {!isSelected && (
                    <div 
                      onClick={e => e.stopPropagation()}
                      className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out flex gap-3 border-t border-slate-100 shadow-inner rounded-t-[32px]"
                    >
                       <button onClick={() => openTransactionModal(product, TransactionType.ENTRY)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight" title="Entrada">
                         <PlusIcon /> Entrada
                       </button>
                       <button onClick={() => openTransactionModal(product, TransactionType.EXIT)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight" title="Saída">
                         <MinusIcon /> Consumo
                       </button>
                       <button onClick={() => openEditModal(product)} className="w-14 bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-indigo-100 flex items-center justify-center" title="Editar">
                         <EditIcon />
                       </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : currentView === 'history' ? (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-800">Últimas Movimentações</h2>
              <button 
                onClick={() => exportService.exportToExcel(products, transactions)}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
              >
                <DownloadIcon /> Exportar Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Data</th>
                    <th className="px-8 py-5">Produto</th>
                    <th className="px-8 py-5">Tipo</th>
                    <th className="px-8 py-5 text-right">Quantidade</th>
                    <th className="px-8 py-5 text-right">Custo Unit.</th>
                    <th className="px-8 py-5">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 text-xs text-slate-500 font-bold">{new Date(t.date).toLocaleString('pt-BR')}</td>
                      <td className="px-8 py-5 text-xs text-slate-800 font-black">{t.productName}</td>
                      <td className="px-8 py-5">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase ${t.type === TransactionType.ENTRY ? 'bg-emerald-50 text-emerald-600' : t.type === TransactionType.EXIT ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-xs text-slate-800 font-black text-right tabular-nums">{t.quantity}</td>
                      <td className="px-8 py-5 text-xs text-slate-800 font-black text-right tabular-nums">{currencyFormatter.format(t.unitCost || 0)}</td>
                      <td className="px-8 py-5 text-[11px] text-slate-400 italic max-w-xs truncate">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total em Estoque</p>
              <h4 className="text-3xl font-black text-indigo-600">{stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
              <p className="text-xs text-slate-400 mt-2 font-bold">{stats.totalItems} unidades totais</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor de Venda</p>
              <h4 className="text-3xl font-black text-emerald-600">{stats.totalSaleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
              <p className="text-xs text-slate-400 mt-2 font-bold">Expectativa de faturamento</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens Críticos</p>
              <h4 className={`text-3xl font-black ${stats.criticalCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{stats.criticalCount}</h4>
              <p className="text-xs text-slate-400 mt-2 font-bold">Produtos abaixo do mínimo</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de SKUs</p>
              <h4 className="text-3xl font-black text-slate-800">{stats.uniqueItemsCount}</h4>
              <p className="text-xs text-slate-400 mt-2 font-bold">Itens cadastrados</p>
            </div>
          </div>
        )}

        {/* Floating Bulk Actions Bar */}
        {selectedIds.size > 0 && currentView === 'inventory' && (
          <div className="fixed bottom-8 left-4 right-4 md:left-[calc(50%+128px)] md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[32px] shadow-2xl z-50 flex flex-wrap items-center justify-between gap-6 animate-in slide-in-from-bottom-8 duration-300 border border-white/10 backdrop-blur-2xl">
             <div className="flex flex-col">
                <span className="text-sm font-black text-indigo-400 uppercase tracking-tighter">{selectedIds.size} materiais selecionados</span>
                <button onClick={() => {setSelectedIds(new Set()); setShowBulkMenu(false);}} className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase text-left">Desmarcar tudo</button>
             </div>
             
             <div className="relative">
                <button 
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${showBulkMenu ? 'bg-white text-slate-900' : 'bg-indigo-600 text-white'}`}
                >
                  <SortIcon /> Ações em Massa
                </button>

                {showBulkMenu && (
                  <div className="absolute bottom-full right-0 mb-4 w-64 bg-slate-800 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-200 backdrop-blur-xl">
                    <button 
                      onClick={handleBulkZeroStock}
                      className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/5 transition-colors border-b border-white/5 text-[11px] font-black uppercase tracking-tight text-slate-300 hover:text-white"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-slate-400"><OutOfStockIcon /></div>
                      Zerar Estoque
                    </button>
                    <button 
                      onClick={handleBulkAddStock}
                      className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/5 transition-colors border-b border-white/5 text-[11px] font-black uppercase tracking-tight text-indigo-400 hover:text-indigo-300"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><PlusIcon /></div>
                      Adicionar Qtd Padrão
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-red-600 transition-colors text-[11px] font-black uppercase tracking-tight text-red-400 hover:text-white"
                    >
                      <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-transparent"><TrashIcon /></div>
                      Excluir Selecionados
                    </button>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Modal Quantidade em Massa */}
      {modalType === 'bulkAdd' && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
           <div className="bg-white rounded-[48px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in duration-300">
             <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tighter">Entrada Padrão</h2>
             <p className="text-slate-500 text-sm mb-8 font-medium">Defina a quantidade que será adicionada a cada um dos <b>{selectedIds.size}</b> itens.</p>
             
             <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Quantidade Adicional</label>
                  <input type="number" autoFocus value={quantity || ''} onChange={(e) => setQuantity(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full border-none bg-slate-50 rounded-[24px] p-7 focus:ring-2 focus:ring-indigo-500 outline-none text-4xl font-black text-indigo-600 placeholder:text-slate-200" placeholder="0" />
                </div>
                
                <div className="flex gap-4">
                   <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-[24px] hover:bg-slate-200 transition-all">Cancelar</button>
                   <button onClick={confirmBulkAdd} disabled={quantity <= 0} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-[24px] shadow-2xl shadow-indigo-100 disabled:opacity-50 transition-all active:scale-95">Aplicar em Lote</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* MODAL ADICIONAR/EDITAR PRODUTO */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-3xl p-10 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{modalType === 'edit' ? 'Editar Cadastro' : 'Novo Material'}</h2>
                <button onClick={closeModal} className="w-12 h-12 bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nome Completo do Material</label>
                <input type="text" placeholder="Ex: AÇAFRÃO RAIZ 25KG" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">COD Sistema / Referência</label>
                <input type="text" placeholder="2170" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Categoria de Insumo</label>
                <input type="text" placeholder="Especiarias" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Preço de Custo (Unitário)</label>
                <input type="number" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 block">Preço de Venda (Unitário)</label>
                <input type="number" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm, salePrice: parseFloat(e.target.value)})} className="w-full bg-emerald-50 border-none p-5 rounded-2xl font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Unidade de Medida</label>
                <select value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="KG">KG</option>
                  <option value="SC">Saco (SC)</option>
                  <option value="BB">Bombona (BB)</option>
                  <option value="CX">Caixa (CX)</option>
                  <option value="FD">Fardo (FD)</option>
                  <option value="L">Litro (L)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estoque Mínimo (Alerta)</label>
                <input type="number" value={productForm.minStock} onChange={e => setProductForm({...productForm, minStock: parseFloat(e.target.value)})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estoque de Segurança</label>
                <input type="number" value={productForm.safetyStock} onChange={e => setProductForm({...productForm, safetyStock: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Consumo Mensal Estimado</label>
                <input type="number" value={productForm.monthlyConsumption} onChange={e => setProductForm({...productForm, monthlyConsumption: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border-none p-5 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            
            <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[24px] mt-10 shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all">
               {modalType === 'edit' ? 'Salvar Alterações' : 'Cadastrar Material'}
            </button>
          </div>
        </div>
      )}

      {selectedProduct && modalType && ['ENTRADA', 'SAÍDA', 'AJUSTE'].includes(modalType) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-300">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{modalType}: {selectedProduct.name}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Ref: {selectedProduct.code}</p>
                </div>
                <button onClick={closeModal} className="text-slate-300 hover:text-slate-500 transition-colors">✕</button>
              </div>
              
              <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quantidade ({selectedProduct.unit})</label>
                    <input 
                      type="number" 
                      autoFocus 
                      value={quantity || ''} 
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} 
                      className="w-full bg-slate-50 p-5 rounded-2xl text-2xl font-black text-indigo-600 border-none focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="0" 
                    />
                  </div>

                  {(modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Custo Unitário da Operação (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={transactionCost || ''} 
                        onChange={(e) => setTransactionCost(parseFloat(e.target.value) || 0)} 
                        className="w-full bg-slate-50 p-5 rounded-2xl text-xl font-black text-amber-600 border-none focus:ring-2 focus:ring-amber-500 outline-none" 
                        placeholder="0.00" 
                      />
                    </div>
                  )}

                  {showConfirmStep && modalType === TransactionType.EXIT && (
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="text-amber-500 mt-0.5"><AlertTriangleIcon /></div>
                      <p className="text-xs text-amber-700 font-medium">Você está registrando uma saída de estoque. Confirma a operação?</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all">Cancelar</button>
                    <button 
                      onClick={handleTransaction} 
                      disabled={quantity <= 0}
                      className={`flex-1 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 ${modalType === TransactionType.ENTRY ? 'bg-emerald-600 hover:bg-emerald-700' : modalType === TransactionType.EXIT ? 'bg-slate-900 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {showConfirmStep ? 'Confirmar Saída' : 'Registrar'}
                    </button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
