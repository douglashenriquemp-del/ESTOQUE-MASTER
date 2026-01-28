
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Transaction, TransactionType } from './types';
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
  TrendingUpIcon,
  CalendarIcon,
  CopyIcon,
  FileTextIcon
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
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  
  // Modal states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
    
    return {
      totalItems,
      criticalCount: criticalProducts.length,
      totalValue,
      totalSaleValue,
      uniqueItemsCount: products.length
    };
  }, [products]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpandHistory = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedHistoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedHistoryIds(next);
  };

  const handleDuplicateProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const newProduct: Product = {
      ...product,
      id: crypto.randomUUID(),
      name: `${product.name} (Cópia)`,
      currentStock: 0,
      previousStock: 0,
      costHistory: product.costHistory ? [...product.costHistory] : []
    };
    setProducts([newProduct, ...products]);
  };

  const handleProductReport = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const productTransactions = transactions.filter(t => t.productId === product.id);
    exportService.exportSingleProductPDF(product, productTransactions);
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
        
        const costChanged = newCostPrice !== p.costPrice;
        const previousCostPrice = costChanged ? p.costPrice : p.previousCostPrice;
        
        let updatedHistory = [...(p.costHistory || [])];
        if (costChanged || updatedHistory.length === 0) {
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

  const closeModal = () => {
    setSelectedProduct(null);
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

  const handleBulkZeroStock = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Zerar o estoque de ${selectedIds.size} itens?`)) return;
    const updatedProducts = products.map(p => {
      if (selectedIds.has(p.id)) return { ...p, currentStock: 0 };
      return p;
    });
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} itens?`)) return;
    setProducts(products.filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setShowBulkMenu(false);
  };

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.category) return;
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

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64 bg-slate-50/50 text-slate-900 transition-all duration-500">
      {/* Sidebar / Bottom Nav (Mobile Friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex justify-around p-3 pb-safe z-40 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-screen md:flex-col md:justify-start md:p-6 md:border-r md:border-t-0 shadow-2xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-10 text-indigo-600 font-bold text-xl px-2">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-100"><PackageIcon /></div>
          <span>EstoqueMaster</span>
        </div>
        
        <div className="flex w-full justify-around md:flex-col md:gap-3">
          <button onClick={() => setCurrentView('inventory')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-2xl transition-all active:scale-90 md:active:scale-100 ${currentView === 'inventory' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <PackageIcon /> <span className="text-[10px] md:text-base">Estoque</span>
          </button>
          <button onClick={() => setCurrentView('history')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-2xl transition-all active:scale-90 md:active:scale-100 ${currentView === 'history' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <HistoryIcon /> <span className="text-[10px] md:text-base">Histórico</span>
          </button>
          <button onClick={() => setCurrentView('stats')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-2xl transition-all active:scale-90 md:active:scale-100 ${currentView === 'stats' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <StatsIcon /> <span className="text-[10px] md:text-base">Painel</span>
          </button>
        </div>
      </nav>

      {/* Header - Fixed on top */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 pt-safe z-30 flex flex-col md:flex-row justify-between items-center gap-4 md:px-8 md:py-6 shadow-sm">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">
          {currentView === 'inventory' ? 'Inventário' : currentView === 'history' ? 'Histórico' : 'Painel de Controle'}
        </h1>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          {currentView === 'inventory' && (
            <>
              <div className="relative flex-1 md:w-64 group">
                <input 
                  type="text" 
                  placeholder="Buscar material..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-slate-100 border-none rounded-2xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                />
              </div>
              <CategoryFilter categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
              <button onClick={() => setModalType('add')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95">
                <PlusIcon /> <span className="hidden sm:inline">Novo</span>
              </button>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => exportService.exportToExcel(products, transactions)} className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 active:scale-95" title="Exportar Excel">
              <DownloadIcon />
            </button>
            {currentView === 'inventory' && (
              <button onClick={() => exportService.exportToPDF(processedProducts)} className="p-2.5 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-100 active:scale-95" title="Exportar PDF do Inventário">
                <FileTextIcon />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto relative min-h-[calc(100vh-140px)]">
        {currentView === 'inventory' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 pb-32">
            {processedProducts.length > 0 ? processedProducts.map(product => {
              const isOutOfStock = product.currentStock === 0;
              const isRed = product.currentStock <= product.minStock;
              const isYellow = !isRed && product.currentStock <= product.minStock * 1.5;
              const isSelected = selectedIds.has(product.id);
              const history = product.costHistory || [];
              const isHistoryExpanded = expandedHistoryIds.has(product.id);
              const autonomyDays = product.monthlyConsumption > 0 
                ? Math.floor((product.currentStock / product.monthlyConsumption) * 30) 
                : null;
              const isCostUp = product.previousCostPrice !== undefined && product.costPrice > product.previousCostPrice;

              return (
                <div 
                  key={product.id} 
                  onClick={() => toggleSelection(product.id)}
                  className={`group relative bg-white rounded-[40px] border-2 p-6 md:p-8 shadow-sm transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-indigo-100' : isOutOfStock ? 'border-slate-800' : isRed ? 'border-red-400' : 'border-slate-100 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1'}`}
                >
                  <div className={`absolute top-6 right-6 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white opacity-100 md:opacity-0 group-hover:opacity-100'}`}>
                    {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {isOutOfStock ? (
                      <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1"><OutOfStockIcon /> Esgotado</span>
                    ) : isRed && (
                      <span className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1 animate-pulse"><AlertTriangleIcon /> Crítico</span>
                    )}
                    <span className="text-[9px] font-black text-slate-400 px-3 py-1.5 bg-slate-50 rounded-full uppercase border border-slate-100">COD: {product.code}</span>
                  </div>

                  <div className="flex items-start gap-3 mb-2">
                    <div 
                      className={`w-4 h-4 mt-1.5 rounded-full flex-shrink-0 shadow-sm border border-white/20 ${isRed ? 'bg-red-500 animate-pulse' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                      title={isRed ? 'Status Crítico' : isYellow ? 'Atenção Necessária' : 'Status Estável'}
                    ></div>
                    <h3 className="font-extrabold text-slate-800 text-lg md:text-xl leading-tight h-14 line-clamp-2 flex-1">{product.name}</h3>
                  </div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">{product.category}</p>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-5 mb-5">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Unitário</p>
                      <div className="flex items-center gap-1.5">
                        <p className={`font-black text-base transition-all duration-500 ${isCostUp ? 'text-red-500 animate-cost-bounce' : 'text-slate-700'}`}>
                          {currencyFormatter.format(product.costPrice)}
                        </p>
                        {isCostUp && <TrendingUpIcon />}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Preço Venda</p>
                      <p className="font-black text-emerald-700 text-base">{currencyFormatter.format(product.salePrice)}</p>
                    </div>
                  </div>

                  {/* SEÇÃO: AUTONOMIA EM DIAS */}
                  <div className={`p-4 rounded-3xl border transition-all duration-300 mb-5 flex items-center justify-between ${autonomyDays !== null && autonomyDays <= 10 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-indigo-50/30 border-indigo-100/30 text-indigo-600'}`}>
                    <div className="flex items-center gap-2">
                      <CalendarIcon />
                      <span className="text-[10px] font-black uppercase tracking-tight">Autonomia estimada</span>
                    </div>
                    <span className="text-lg font-black tabular-nums">{autonomyDays !== null ? `${Math.floor(autonomyDays)}d` : '--'}</span>
                  </div>

                  {/* SEÇÃO: HISTÓRICO DE CUSTOS (Expansível) */}
                  <div 
                    onClick={(e) => toggleExpandHistory(e, product.id)}
                    className="bg-slate-50/50 rounded-[32px] p-5 mb-0 border border-slate-100/50 hover:bg-slate-100/80 transition-all active:scale-95"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <HistoryIcon /> Histórico de Custos
                      </p>
                      <span className={`text-slate-300 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </span>
                    </div>
                    <div className={`space-y-2.5 overflow-hidden transition-all duration-300 ${isHistoryExpanded ? 'max-h-64' : 'max-h-24'}`}>
                      {history.length > 0 ? history.slice(0, isHistoryExpanded ? 5 : 3).map((h, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] animate-in fade-in slide-in-from-top-1">
                          <span className="text-slate-500 font-bold">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-slate-800 font-black">{currencyFormatter.format(h.price)}</span>
                        </div>
                      )) : (
                        <p className="text-[10px] text-slate-400 italic">Sem registros anteriores</p>
                      )}
                      {!isHistoryExpanded && history.length > 3 && (
                        <p className="text-[9px] text-indigo-500 font-black text-center mt-2 uppercase tracking-tight">Ver mais +{history.length - 3}</p>
                      )}
                    </div>
                  </div>

                  {!isSelected && (
                    <div onClick={e => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out border-t border-slate-100 shadow-inner rounded-t-[40px] flex flex-col gap-3">
                       <div className="flex gap-2">
                          <button onClick={() => openTransactionModal(product, TransactionType.ENTRY)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight shadow-md shadow-emerald-50"><PlusIcon /> Entrada</button>
                          <button onClick={() => openTransactionModal(product, TransactionType.EXIT)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight shadow-md shadow-slate-200"><MinusIcon /> Consumo</button>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => openEditModal(product)} className="flex-1 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><EditIcon /> Editar</button>
                          <button onClick={(e) => handleDuplicateProduct(e, product)} className="flex-1 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><CopyIcon /> Clonar</button>
                          <button onClick={(e) => handleProductReport(e, product)} className="flex-1 bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><FileTextIcon /> PDF</button>
                       </div>
                    </div>
                  )}
                </div>
              ) : null) : (
                <div className="col-span-full py-20 text-center">
                   <p className="text-slate-400 font-bold text-lg">Nenhum material encontrado.</p>
                </div>
              )}
          </div>
        ) : currentView === 'history' ? (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center"><h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Histórico de Movimentações</h2></div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="px-6 py-5">Data</th><th className="px-6 py-5">Produto</th><th className="px-6 py-5">Tipo</th><th className="px-6 py-5 text-right">Quantidade</th><th className="px-6 py-5 text-right">Custo Unit.</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 text-xs font-bold text-slate-500">{new Date(t.date).toLocaleString('pt-BR')}</td>
                      <td className="px-6 py-5 text-xs font-black">{t.productName}</td>
                      <td className="px-6 py-5"><span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase ${t.type === TransactionType.ENTRY ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{t.type}</span></td>
                      <td className="px-6 py-5 text-xs font-black text-right tabular-nums">{t.quantity}</td>
                      <td className="px-6 py-5 text-xs font-black text-right tabular-nums">{currencyFormatter.format(t.unitCost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-indigo-200 transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Custo Estoque</p>
              <h4 className="text-3xl font-black text-indigo-600 group-hover:scale-105 transition-transform origin-left">{stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-emerald-200 transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Estimado Venda</p>
              <h4 className="text-3xl font-black text-emerald-600 group-hover:scale-105 transition-transform origin-left">{stats.totalSaleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-red-200 transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Materiais Críticos</p>
              <h4 className="text-3xl font-black text-red-600 group-hover:scale-105 transition-transform origin-left">{stats.criticalCount}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-slate-300 transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de SKUs</p>
              <h4 className="text-3xl font-black text-slate-800 group-hover:scale-105 transition-transform origin-left">{stats.uniqueItemsCount}</h4>
            </div>
          </div>
        )}

        {/* Floating Bulk Menu */}
        {selectedIds.size > 0 && currentView === 'inventory' && (
          <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-[calc(50%+128px)] md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[40px] shadow-2xl z-50 flex items-center justify-between gap-6 animate-in slide-in-from-bottom-10">
             <span className="text-sm font-black text-indigo-400 uppercase">{selectedIds.size} selecionados</span>
             <div className="relative">
                <button onClick={() => setShowBulkMenu(!showBulkMenu)} className="bg-indigo-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/50">Ações em Massa</button>
                {showBulkMenu && (
                  <div className="absolute bottom-full right-0 mb-4 w-52 bg-slate-800 rounded-[32px] overflow-hidden shadow-2xl border border-slate-700">
                    <button onClick={handleBulkZeroStock} className="w-full p-4 text-left hover:bg-white/10 border-b border-white/5 text-[10px] font-black uppercase transition-colors">Zerar Estoque</button>
                    <button onClick={handleBulkAddStock} className="w-full p-4 text-left hover:bg-white/10 border-b border-white/5 text-[10px] font-black uppercase transition-colors">Adicionar Entrada</button>
                    <button onClick={handleBulkDelete} className="w-full p-4 text-left hover:bg-red-600 text-[10px] font-black uppercase transition-colors">Excluir Itens</button>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Modals - Common style across app */}
      {selectedProduct && modalType && ['ENTRADA', 'SAÍDA', 'AJUSTE', 'bulkAdd'].includes(modalType) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter text-slate-800">{modalType}: <span className="text-indigo-600">{selectedProduct.name}</span></h2>
              <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Quantidade ({selectedProduct.unit})</label>
                    <input type="number" autoFocus inputMode="decimal" value={quantity || ''} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-100 p-5 rounded-3xl text-3xl font-black text-indigo-600 outline-none border-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                  </div>
                  {(modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário Atualizado (R$)</label>
                      <input type="number" step="0.01" inputMode="decimal" value={transactionCost || ''} onChange={(e) => setTransactionCost(parseFloat(e.target.value) || 0)} className="w-full bg-slate-100 p-5 rounded-3xl text-2xl font-black text-amber-600 outline-none border-none focus:ring-4 focus:ring-amber-50 transition-all" />
                    </div>
                  )}
                  <div className="flex gap-4 pt-2">
                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-[24px] active:scale-95 transition-all">Voltar</button>
                    <button onClick={handleTransaction} disabled={quantity <= 0} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-[24px] shadow-xl active:scale-95 transition-all disabled:opacity-50">Confirmar</button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 pt-safe">
          <div className="bg-white rounded-[48px] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in duration-300 no-scrollbar">
            <h2 className="text-3xl font-black mb-10 tracking-tighter text-slate-800">{modalType === 'edit' ? 'Editar Material' : 'Novo Material'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Descritivo do Item</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none border-none focus:ring-4 focus:ring-indigo-100 transition-all" />
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Código Referência</label><input type="text" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none border-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Categoria</label><input type="text" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none border-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário (R$)</label><input type="number" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-black text-indigo-600 border-none outline-none" /></div>
              <div><label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block">Venda Sugerida (R$)</label><input type="number" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm, salePrice: parseFloat(e.target.value)})} className="w-full bg-emerald-50 p-5 rounded-3xl font-black text-emerald-700 border-none outline-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Estoque Mínimo</label><input type="number" value={productForm.minStock} onChange={e => setProductForm({...productForm, minStock: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold border-none outline-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Consumo Mensal Estimado</label><input type="number" value={productForm.monthlyConsumption} onChange={e => setProductForm({...productForm, monthlyConsumption: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold border-none outline-none" /></div>
            </div>
            <div className="flex flex-col gap-4 mt-12">
              <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[32px] shadow-2xl shadow-indigo-200 active:scale-95 transition-all text-lg">Salvar Alterações</button>
              <button onClick={closeModal} className="w-full text-slate-400 font-bold py-4 active:scale-95 transition-all">Cancelar e Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
