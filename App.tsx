
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Transaction, TransactionType } from './types';
import { storageService } from './services/storageService';
import { exportService } from './services/exportService';
import { GoogleGenAI } from "@google/genai";
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
  BrainIcon,
  CopyIcon,
  FileTextIcon
} from './components/Icons';

type View = 'inventory' | 'history' | 'stats' | 'ai';
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
  
  // AI States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');

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

  // AI Assistant Logic
  const handleAskAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    setAiResponse(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      const context = {
        products: products.map(p => ({
          name: p.name,
          code: p.code,
          stock: p.currentStock,
          min: p.minStock,
          safety: p.safetyStock,
          cost: p.costPrice,
          category: p.category,
          consumption: p.monthlyConsumption,
          autonomy: p.monthlyConsumption > 0 ? Math.floor((p.currentStock / p.monthlyConsumption) * 30) : 0
        })),
        recentTransactions: transactions.slice(0, 15)
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analise estrategicamente meu estoque e responda à consulta: "${aiPrompt}". 
        DADOS DO SISTEMA: ${JSON.stringify(context)}.`,
        config: {
          thinkingConfig: { thinkingBudget: 32768 },
          systemInstruction: "Você é um Analista de Suprimentos Sênior. Sua missão é fornecer recomendações de compra, alertas de risco e análise de custos baseada em dados reais. Use o Thinking Mode para processar cenários complexos."
        },
      });

      setAiResponse(response.text || "Sem resposta da IA.");
    } catch (error) {
      console.error("AI Error:", error);
      setAiResponse("Erro ao consultar a IA. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

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
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64 bg-slate-50/50 text-slate-900">
      {/* Sidebar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-40 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-screen md:flex-col md:justify-start md:p-6 md:border-r md:border-t-0 shadow-xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-10 text-indigo-600 font-bold text-xl px-2">
          <div className="bg-indigo-600 text-white p-2 rounded-xl"><PackageIcon /></div>
          <span>EstoqueMaster</span>
        </div>
        
        <div className="flex w-full justify-around md:flex-col md:gap-2">
          <button onClick={() => setCurrentView('inventory')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'inventory' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <PackageIcon /> <span className="text-[10px] md:text-base">Estoque</span>
          </button>
          <button onClick={() => setCurrentView('history')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'history' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <HistoryIcon /> <span className="text-[10px] md:text-base">Histórico</span>
          </button>
          <button onClick={() => setCurrentView('stats')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'stats' ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <StatsIcon /> <span className="text-[10px] md:text-base">Painel</span>
          </button>
          <button onClick={() => setCurrentView('ai')} className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-xl transition-all ${currentView === 'ai' ? 'text-purple-600 md:bg-purple-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
            <BrainIcon /> <span className="text-[10px] md:text-base">Analista IA</span>
          </button>
        </div>
      </nav>

      {/* Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 p-4 z-30 flex flex-col md:flex-row justify-between items-center gap-4 md:px-8 md:py-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight uppercase">
          {currentView === 'inventory' ? 'Inventário' : currentView === 'history' ? 'Histórico' : currentView === 'ai' ? 'Analista IA (Thinking Mode)' : 'Dashboard'}
        </h1>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          {currentView === 'inventory' && (
            <>
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 md:w-64 bg-slate-100 border-none rounded-2xl py-2 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              <CategoryFilter categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
              <button onClick={() => setModalType('add')} className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                <PlusIcon /> Novo
              </button>
            </>
          )}
          <button onClick={() => exportService.exportToExcel(products, transactions)} className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg">
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
              const isHistoryExpanded = expandedHistoryIds.has(product.id);
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
                      <span className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1 animate-pulse"><AlertTriangleIcon /> Crítico</span>
                    )}
                    <span className="text-[9px] font-black text-slate-400 px-3 py-1.5 bg-slate-100 rounded-full uppercase">COD: {product.code}</span>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div 
                      className={`w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/20 ${isRed ? 'bg-red-500 animate-pulse' : isYellow ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                      title={isRed ? 'Status Crítico' : isYellow ? 'Atenção Necessária' : 'Status Estável'}
                    ></div>
                    <h3 className="font-bold text-slate-800 text-xl leading-tight h-14 line-clamp-2 flex-1">{product.name}</h3>
                  </div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">{product.category}</p>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-6 mb-6">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Custo Unitário</p>
                      <div className="flex items-center gap-1.5">
                        <p className={`font-black text-base transition-all duration-500 ${isCostUp ? 'text-red-500 animate-bounce' : 'text-slate-700'}`}>
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
                  <div className={`p-4 rounded-2xl border transition-all duration-300 mb-6 flex items-center justify-between ${autonomyDays !== null && autonomyDays <= 10 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-indigo-50/30 border-indigo-100/50 text-indigo-600'}`}>
                    <div className="flex items-center gap-2">
                      <div className="opacity-80 scale-90"><CalendarIcon /></div>
                      <span className="text-[10px] font-black uppercase tracking-tight">Autonomia em Dias</span>
                    </div>
                    <span className="text-xl font-black tabular-nums">{autonomyDays !== null ? `${Math.floor(autonomyDays)}` : '--'}</span>
                  </div>

                  {/* SEÇÃO: HISTÓRICO DE CUSTOS (Expansível) */}
                  <div 
                    onClick={(e) => toggleExpandHistory(e, product.id)}
                    className="bg-slate-50/50 rounded-3xl p-5 mb-0 border border-slate-100/50 hover:bg-slate-100/80 transition-all group-hover:opacity-40"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                        <HistoryIcon /> Histórico de Custos
                      </p>
                      <span className={`text-slate-300 transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </span>
                    </div>
                    <div className={`space-y-2.5 overflow-hidden transition-all duration-300 ${isHistoryExpanded ? 'max-h-48' : 'max-h-24'}`}>
                      {history.length > 0 ? history.slice(0, isHistoryExpanded ? 5 : 3).map((h, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] animate-in fade-in slide-in-from-top-1">
                          <span className="text-slate-500 font-bold">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-slate-800 font-black">{currencyFormatter.format(h.price)}</span>
                        </div>
                      )) : (
                        <p className="text-[10px] text-slate-400 italic">Sem registros anteriores</p>
                      )}
                      {!isHistoryExpanded && history.length > 3 && (
                        <p className="text-[9px] text-indigo-500 font-black text-center mt-2 uppercase tracking-tight">Clique para ver mais (+{history.length - 3})</p>
                      )}
                    </div>
                  </div>

                  {!isSelected && (
                    <div onClick={e => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out border-t border-slate-100 shadow-inner rounded-t-[32px] flex flex-col gap-3">
                       {/* Ações Primárias */}
                       <div className="flex gap-3">
                          <button onClick={() => openTransactionModal(product, TransactionType.ENTRY)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight" title="Entrada"><PlusIcon /> Entrada</button>
                          <button onClick={() => openTransactionModal(product, TransactionType.EXIT)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tight" title="Consumo"><MinusIcon /> Consumo</button>
                       </div>
                       {/* Ações Secundárias Expandidas */}
                       <div className="flex gap-2 justify-between">
                          <button onClick={() => openEditModal(product)} className="flex-1 bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase" title="Editar"><EditIcon /> Editar</button>
                          <button onClick={(e) => handleDuplicateProduct(e, product)} className="flex-1 bg-slate-100 hover:bg-blue-50 text-slate-400 hover:text-blue-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase" title="Duplicar"><CopyIcon /> Clonar</button>
                          <button onClick={(e) => handleProductReport(e, product)} className="flex-1 bg-slate-100 hover:bg-amber-50 text-slate-400 hover:text-amber-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase" title="Relatório"><FileTextIcon /> PDF</button>
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : currentView === 'history' ? (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center"><h2 className="text-2xl font-black uppercase tracking-tighter">Histórico de Movimentações</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr><th className="px-8 py-5">Data</th><th className="px-8 py-5">Produto</th><th className="px-8 py-5">Tipo</th><th className="px-8 py-5 text-right">Quantidade</th><th className="px-8 py-5 text-right">Custo Unit.</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(t.date).toLocaleString('pt-BR')}</td>
                      <td className="px-8 py-5 text-xs font-black">{t.productName}</td>
                      <td className="px-8 py-5"><span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase ${t.type === TransactionType.ENTRY ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{t.type}</span></td>
                      <td className="px-8 py-5 text-xs font-black text-right tabular-nums">{t.quantity}</td>
                      <td className="px-8 py-5 text-xs font-black text-right tabular-nums">{currencyFormatter.format(t.unitCost || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : currentView === 'stats' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Custo</p>
              <h4 className="text-3xl font-black text-indigo-600">{stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Venda</p>
              <h4 className="text-3xl font-black text-emerald-600">{stats.totalSaleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Críticos</p>
              <h4 className="text-3xl font-black text-red-600">{stats.criticalCount}</h4>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">SKUs</p>
              <h4 className="text-3xl font-black text-slate-800">{stats.uniqueItemsCount}</h4>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[48px] shadow-2xl border border-slate-100 p-8 md:p-12">
               <div className="flex items-center gap-6 mb-12">
                  <div className="w-16 h-16 bg-purple-100 rounded-3xl flex items-center justify-center text-purple-600">
                    <BrainIcon />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">Analista Estratégico IA</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gemini 3 Pro + Thinking Mode</p>
                  </div>
               </div>

               <form onSubmit={handleAskAI} className="relative mb-12">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Quais insumos estão com estoque crítico para as próximas semanas?"
                    className="w-full bg-slate-50 border-none rounded-[32px] p-8 pb-20 text-xl font-medium focus:ring-4 focus:ring-purple-200 outline-none min-h-[160px] resize-none"
                  />
                  <button type="submit" disabled={aiLoading} className="absolute bottom-6 right-6 bg-purple-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all">
                    {aiLoading ? "Pensando..." : "Consultar Analista"}
                  </button>
               </form>

               {aiLoading && (
                 <div className="p-8 bg-purple-50 rounded-[32px] animate-pulse">
                    <div className="h-4 bg-purple-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-purple-200 rounded w-full mb-4"></div>
                    <p className="text-purple-600 font-bold text-xs uppercase text-center pt-2">Processando análise preditiva de estoque...</p>
                 </div>
               )}

               {aiResponse && !aiLoading && (
                 <div className="p-10 bg-slate-50 rounded-[48px] border border-slate-100 prose prose-slate max-w-none shadow-inner leading-relaxed whitespace-pre-wrap font-medium text-lg">
                    <div className="flex items-center gap-2 mb-6 text-purple-600 font-black uppercase text-xs tracking-widest"><BrainIcon /> Insights Estratégicos</div>
                    {aiResponse}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Floating Bulk Menu */}
        {selectedIds.size > 0 && currentView === 'inventory' && (
          <div className="fixed bottom-8 left-4 right-4 md:left-[calc(50%+128px)] md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[32px] shadow-2xl z-50 flex items-center justify-between gap-6">
             <span className="text-sm font-black text-indigo-400 uppercase">{selectedIds.size} selecionados</span>
             <div className="relative">
                <button onClick={() => setShowBulkMenu(!showBulkMenu)} className="bg-indigo-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">Ações em Massa</button>
                {showBulkMenu && (
                  <div className="absolute bottom-full right-0 mb-4 w-48 bg-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <button onClick={handleBulkZeroStock} className="w-full p-4 text-left hover:bg-white/5 border-b border-white/5 text-[10px] font-black uppercase">Zerar Estoque</button>
                    <button onClick={handleBulkAddStock} className="w-full p-4 text-left hover:bg-white/5 border-b border-white/5 text-[10px] font-black uppercase">Adicionar Entrada</button>
                    <button onClick={handleBulkDelete} className="w-full p-4 text-left hover:bg-red-600 text-[10px] font-black uppercase">Excluir Itens</button>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Transaction Modal */}
      {selectedProduct && modalType && ['ENTRADA', 'SAÍDA', 'AJUSTE', 'bulkAdd'].includes(modalType) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-300">
              <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter">{modalType}: {selectedProduct.name}</h2>
              <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Quantidade ({selectedProduct.unit})</label>
                    <input type="number" autoFocus value={quantity || ''} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 p-5 rounded-2xl text-2xl font-black text-indigo-600 outline-none" />
                  </div>
                  {(modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário (R$)</label>
                      <input type="number" step="0.01" value={transactionCost || ''} onChange={(e) => setTransactionCost(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 p-5 rounded-2xl text-xl font-black text-amber-600 outline-none" />
                    </div>
                  )}
                  <div className="flex gap-4 pt-2">
                    <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-4 rounded-2xl">Cancelar</button>
                    <button onClick={handleTransaction} disabled={quantity <= 0} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Confirmar</button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-3xl p-10 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in">
            <h2 className="text-3xl font-black mb-8 tracking-tighter">{modalType === 'edit' ? 'Editar Cadastro' : 'Novo Material'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Comercial</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none" />
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Código</label><input type="text" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Categoria</label><input type="text" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário</label><input type="number" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl font-black text-indigo-600 outline-none" /></div>
              <div><label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block">Venda Unitário</label><input type="number" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm, salePrice: parseFloat(e.target.value)})} className="w-full bg-emerald-50 p-5 rounded-2xl font-black text-emerald-700 outline-none" /></div>
            </div>
            <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[24px] mt-10 shadow-xl active:scale-[0.98] transition-all">Salvar Dados</button>
            <button onClick={closeModal} className="w-full text-slate-400 font-bold py-4 mt-2">Cancelar Operação</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
