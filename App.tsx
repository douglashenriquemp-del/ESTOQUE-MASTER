
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, Transaction, TransactionType, TRANSACTION_TYPES, User, UserRole } from './types.ts';
import { storageService } from './services/storageService.ts';
import { exportService } from './services/exportService.ts';
import { INITIAL_PRODUCTS } from './data/initialData.ts';
import { 
  PlusIcon, EditIcon, DownloadIcon, HistoryIcon, 
  PackageIcon, StatsIcon, XIcon, FileTextIcon,
  AlertTriangleIcon, BarcodeIcon,
  TrendingUpIcon, TrendingUpIcon as CostIcon,
  FilterIcon, TrashIcon, CalendarIcon
} from './components/Icons.tsx';

type ViewMode = 'grid' | 'list';
type ViewType = 'inventory' | 'history' | 'stats';
type ProductGroup = 'RAW_MATERIAL' | 'FINISHED_GOOD';
type CardInternalView = 'stock' | 'coverage';
type AuthMode = 'login' | 'register';
type AlertType = 'CRITICAL' | 'ATTENTION' | 'COST_ALARM';

interface SortConfig {
  key: keyof Product;
  direction: 'asc' | 'desc';
}

interface ToastNotification {
  id: string;
  message: string;
  type: 'error' | 'success' | 'warning';
}

interface ProductCardProps {
  product: Product;
  canEdit: boolean;
  onEntry: (p: Product) => void;
  onExit: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onExportPDF: (p: Product) => void;
  currencyFormatter: Intl.NumberFormat;
}

const ProductCard = React.memo<ProductCardProps>(({ 
  product, 
  canEdit, 
  onEntry, 
  onExit, 
  onEdit, 
  onDelete,
  onExportPDF,
  currencyFormatter 
}) => {
  const [view, setView] = useState<CardInternalView>('stock');

  const daysCoverage = useMemo(() => {
    if (product.monthlyConsumption <= 0) return 999;
    return Math.round((product.currentStock / product.monthlyConsumption) * 30);
  }, [product.currentStock, product.monthlyConsumption]);

  const coveragePercent = useMemo(() => {
    return Math.min(100, (daysCoverage / 60) * 100);
  }, [daysCoverage]);

  const isCostUp = product.previousCostPrice !== undefined && product.costPrice > product.previousCostPrice;

  return (
    <div className={`bg-white rounded-[44px] p-8 border-4 transition-all shadow-sm flex flex-col h-full group ${product.currentStock <= product.minStock ? 'border-red-400 bg-red-50/10' : 'border-white hover:border-indigo-100'}`}>
      <div className="mb-6 text-left">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{product.category}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 group-hover:bg-white transition-colors">
            <span className="text-slate-300"><BarcodeIcon /></span>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{product.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-black text-slate-800 uppercase line-clamp-2 leading-tight flex-1">{product.name}</h3>
          {isCostUp && (
            <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg animate-cost-bounce" title="Aumento de Custo Detectado">
              <CostIcon />
            </div>
          )}
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 shadow-inner">
        <button onClick={() => setView('stock')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${view === 'stock' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Saldo</button>
        <button onClick={() => setView('coverage')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${view === 'coverage' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Cobertura</button>
      </div>

      <div className="flex-1 mb-8 min-h-[140px]">
        {view === 'stock' ? (
          <div className="bg-slate-50 rounded-[32px] p-6 flex justify-between items-center h-full shadow-inner animate-in fade-in zoom-in duration-300">
            <div className="text-left">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Atual</p>
              <p className={`text-3xl font-black tracking-tighter ${product.currentStock <= product.minStock ? 'text-red-600' : 'text-slate-800'}`}>
                {product.currentStock} <span className="text-xs uppercase font-bold text-slate-400 ml-1">{product.unit}</span>
              </p>
              <div className="mt-2 text-[9px] font-bold text-slate-400 italic">Estoque Mínimo: {product.minStock}</div>
            </div>
            {product.currentStock <= product.minStock && (
              <div className="bg-red-100 p-3 rounded-2xl text-red-600 animate-pulse">
                <AlertTriangleIcon />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-[32px] p-6 h-full shadow-inner animate-in fade-in slide-in-from-right-4 duration-300 text-left">
             <div className="flex justify-between items-end mb-4">
               <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Autonomia</p>
                  <p className={`text-2xl font-black tracking-tighter ${daysCoverage < 15 ? 'text-red-600' : 'text-indigo-600'}`}>
                    {daysCoverage >= 999 ? '∞' : daysCoverage} <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">Dias</span>
                  </p>
               </div>
               <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Consumo/Mês</p>
                  <p className="text-xs font-black text-slate-600">{product.monthlyConsumption} {product.unit}</p>
               </div>
             </div>
             <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden border border-white">
                <div className={`h-full transition-all duration-700 rounded-full ${daysCoverage < 15 ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${coveragePercent}%` }}></div>
             </div>
             <p className="text-[7px] font-bold text-slate-400 uppercase mt-3 tracking-tighter text-center italic">Meta: 60 dias de cobertura</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 mt-auto">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex flex-col items-center">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Custo</span>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-black ${isCostUp ? 'text-orange-600' : 'text-slate-700'}`}>
                {currencyFormatter.format(product.costPrice)}
              </span>
            </div>
          </div>
          <div className="bg-indigo-50 p-2.5 rounded-2xl border border-indigo-100 flex flex-col items-center">
            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Venda</span>
            <span className="text-[10px] font-black text-indigo-700">{currencyFormatter.format(product.salePrice)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {canEdit ? (
            <div className="flex gap-2">
              <button onClick={() => onEntry(product)} className="flex-1 bg-emerald-600 text-white py-4 rounded-[20px] text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all hover:bg-emerald-700">Entrada</button>
              <button onClick={() => onExit(product)} className="flex-1 bg-slate-900 text-white py-4 rounded-[20px] text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all hover:bg-black">Saída</button>
            </div>
          ) : (
            <div className="bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest py-4 rounded-[20px] flex items-center justify-center cursor-not-allowed opacity-60">Somente Leitura</div>
          )}
          
          <div className="flex gap-2">
            <button 
              onClick={() => onExportPDF(product)} 
              className="flex-1 bg-indigo-600 text-white py-4 rounded-[20px] text-[9px] font-black uppercase shadow-md active:scale-95 transition-all hover:bg-indigo-700 flex items-center justify-center gap-2"
              title="Gerar Relatório Detalhado do Produto"
            >
              <FileTextIcon /> Relatório Detalhado
            </button>
            {canEdit && (
              <>
                <button onClick={() => onEdit(product)} className="p-4 bg-indigo-50 text-indigo-600 rounded-[20px] hover:bg-indigo-100 transition-all active:scale-95"><EditIcon /></button>
                <button onClick={() => onDelete(product)} className="p-4 bg-red-50 text-red-600 rounded-[20px] hover:bg-red-100 transition-all active:scale-95"><TrashIcon /></button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

const AuthScreen: React.FC<{ onAuth: (u: User) => void }> = ({ onAuth }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'VIEWER' as UserRole });
  const [isLocked, setIsLocked] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    setUsers(storageService.getUsers());
    if (storageService.getFailedAttempts() >= 5) setIsLocked(true);
  }, []);

  const handleAction = () => {
    if (isLocked) return alert("SISTEMA BLOQUEADO. Procure suporte técnico.");

    if (mode === 'login') {
      const u = users.find(x => x.username === form.username && x.password === form.password);
      if (u) {
        storageService.resetFailedAttempts();
        onAuth(u);
      } else {
        const attempts = storageService.incrementFailedAttempts();
        if (attempts >= 5) setIsLocked(true);
        alert(`Credenciais inválidas. Tentativa ${attempts}/5`);
      }
    } else {
      const newUser: User = { id: crypto.randomUUID(), ...form };
      const updated = [...users, newUser];
      storageService.saveUsers(updated);
      setUsers(updated);
      alert("Usuário cadastrado com sucesso!");
      setMode('login');
    }
  };

  return (
    <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6 pb-safe pt-safe">
      <div className="bg-white p-10 md:p-14 rounded-[48px] shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-inner"><PackageIcon /></div>
        <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter text-slate-800">Estoque Master</h1>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-12">{mode === 'login' ? 'Acesso ao Painel' : 'Novo Cadastro'}</p>

        {isLocked ? (
          <div className="bg-red-50 p-8 rounded-[32px] border-4 border-red-100 text-red-600 font-black uppercase text-xs text-center">
            <AlertTriangleIcon />
            <p className="mt-4">Bloqueio de Segurança Ativado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mode === 'register' && (
              <>
                <input type="text" placeholder="Nome Completo" className="w-full bg-slate-100 p-6 rounded-[24px] font-bold outline-none border-4 border-transparent focus:border-indigo-600 transition-all" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <select className="w-full bg-slate-100 p-6 rounded-[24px] font-bold outline-none border-4 border-transparent focus:border-indigo-600 transition-all appearance-none" value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                  <option value="VIEWER">Visualizador (Leitura)</option>
                  <option value="ADMIN">Administrador (Total)</option>
                </select>
              </>
            )}
            <input type="text" placeholder="Usuário" className="w-full bg-slate-100 p-6 rounded-[24px] font-bold outline-none border-4 border-transparent focus:border-indigo-600 transition-all" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
            <input type="password" placeholder="Senha" className="w-full bg-slate-100 p-6 rounded-[24px] font-bold outline-none border-4 border-transparent focus:border-indigo-600 transition-all" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            
            <button onClick={handleAction} className="w-full bg-indigo-600 text-white font-black py-7 rounded-[24px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-widest text-xs mt-4">
              {mode === 'login' ? 'Conectar' : 'Criar Conta'}
            </button>

            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="mt-8 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors">
              {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('inventory');
  const [activeGroup, setActiveGroup] = useState<ProductGroup>('FINISHED_GOOD');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [activeAlerts, setActiveAlerts] = useState<AlertType[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'name', direction: 'asc' });
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [transCost, setTransCost] = useState(0);
  const [form, setForm] = useState<Partial<Product>>({});
  const [showTutorial, setShowTutorial] = useState(false);

  const [statsCategoryFilter, setStatsCategoryFilter] = useState('Todas');

  const cf = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  useEffect(() => {
    const savedProducts = storageService.getProducts();
    setProducts(savedProducts);
    setTransactions(storageService.getTransactions());
    if (!localStorage.getItem('tutorial_completed')) setShowTutorial(true);
  }, []);

  useEffect(() => { storageService.saveProducts(products); }, [products]);
  useEffect(() => { storageService.saveTransactions(transactions); }, [transactions]);

  // Derived Values - Moving before callbacks to fix 'used before its declaration' error
  const canEdit = useMemo(() => currentUser?.role === 'ADMIN', [currentUser]);

  const categories = useMemo(() => {
    const activeProducts = products.filter(p => p.type === activeGroup);
    return Array.from(new Set(activeProducts.map(p => p.category))).sort();
  }, [products, activeGroup]);

  const filteredProducts = useMemo(() => {
    if (currentView !== 'inventory') return [];

    let result = products.filter(p => {
      const groupMatch = p.type === activeGroup;
      const categoryMatch = selectedCategory === 'Todas' || p.category === selectedCategory;
      const searchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.ean?.includes(searchTerm) || p.dun?.includes(searchTerm);
      
      let alertMatch = activeAlerts.length === 0;
      if (!alertMatch) {
        const isCritical = p.currentStock <= p.minStock;
        const isAttention = p.currentStock > p.minStock && p.currentStock <= p.safetyStock;
        const isCostAlarm = p.previousCostPrice !== undefined && p.costPrice > p.previousCostPrice;
        
        alertMatch = (activeAlerts.includes('CRITICAL') && isCritical) ||
                     (activeAlerts.includes('ATTENTION') && isAttention) ||
                     (activeAlerts.includes('COST_ALARM') && isCostAlarm);
      }

      return groupMatch && categoryMatch && searchMatch && alertMatch;
    });

    result.sort((a, b) => {
      const aCrit = a.currentStock <= a.minStock ? 1 : 0;
      const bCrit = b.currentStock <= b.minStock ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;

      if (sortConfig) {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (typeof aVal === 'string' && typeof bVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        if (typeof aVal === 'number' && typeof bVal === 'number') return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return result;
  }, [products, currentView, activeGroup, selectedCategory, searchTerm, activeAlerts, sortConfig]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const transDate = new Date(t.date);
      const isAfterStart = !startDate || transDate >= new Date(startDate + 'T00:00:00');
      const isBeforeEnd = !endDate || transDate <= new Date(endDate + 'T23:59:59');
      return isAfterStart && isBeforeEnd;
    });
  }, [transactions, startDate, endDate]);

  const statsData = useMemo(() => {
    const dataByCat: Record<string, { raw: number, finished: number }> = {};
    products.forEach(p => {
      if (!dataByCat[p.category]) dataByCat[p.category] = { raw: 0, finished: 0 };
      const value = p.currentStock * p.costPrice;
      if (p.type === 'RAW_MATERIAL') dataByCat[p.category].raw += value;
      else dataByCat[p.category].finished += value;
    });
    return Object.entries(dataByCat)
      .filter(([cat]) => statsCategoryFilter === 'Todas' || cat === statsCategoryFilter)
      .sort((a, b) => (b[1].raw + b[1].finished) - (a[1].raw + a[1].finished));
  }, [products, statsCategoryFilter]);

  const globalStats = useMemo(() => {
    return {
      totalValue: products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0),
      criticalCount: products.filter(p => p.currentStock <= p.minStock).length,
      totalItems: products.reduce((acc, p) => acc + p.currentStock, 0)
    };
  }, [products]);

  // Callbacks and Handlers
  const addToast = useCallback((message: string, type: 'error' | 'success' | 'warning' = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const handleEntry = useCallback((prod: Product) => {
    setSelectedProduct(prod);
    setModalType(TRANSACTION_TYPES.ENTRY);
    setTransCost(prod.costPrice);
  }, []);

  const handleExit = useCallback((prod: Product) => {
    setSelectedProduct(prod);
    setModalType(TRANSACTION_TYPES.EXIT);
  }, []);

  const handleEdit = useCallback((prod: Product) => {
    setSelectedProduct(prod);
    setForm(prod);
    setModalType('edit');
  }, []);

  const handleDeleteClick = useCallback((prod: Product) => {
    setSelectedProduct(prod);
    setModalType('delete');
  }, []);

  const handleExportPDF = useCallback((prod: Product) => {
    const productTransactions = transactions.filter(t => t.productId === prod.id);
    exportService.exportSingleProductPDF(prod, productTransactions);
  }, [transactions]);

  const handleFullInventoryPDF = useCallback(() => {
    exportService.exportFullInventoryPDF(filteredProducts);
  }, [filteredProducts]);

  const toggleAlert = (alert: AlertType) => {
    setActiveAlerts(prev => prev.includes(alert) ? prev.filter(a => a !== alert) : [...prev, alert]);
  };

  const handleTransaction = () => {
    if (!selectedProduct || !currentUser || !modalType) return;
    const isEntry = modalType === TRANSACTION_TYPES.ENTRY;
    const newTrans: Transaction = {
      id: crypto.randomUUID(), productId: selectedProduct.id, productName: selectedProduct.name,
      type: modalType as TransactionType, quantity: quantity,
      unitCost: isEntry ? transCost : selectedProduct.costPrice,
      date: new Date().toISOString(), notes: '', userName: currentUser.name
    };
    
    setTransactions(prev => [newTrans, ...prev]);
    setProducts(prev => prev.map(p => {
      if (p.id !== selectedProduct.id) return p;
      let newStock = p.currentStock;
      if (modalType === TRANSACTION_TYPES.ENTRY) newStock += quantity;
      else if (modalType === TRANSACTION_TYPES.EXIT) newStock -= quantity;
      
      const updatedStock = Math.max(0, newStock);
      
      if (updatedStock === 0 && p.currentStock > 0) {
        addToast(`ITEM ESGOTADO: ${p.name}`, 'error');
      }
      
      return { 
        ...p, 
        currentStock: updatedStock, 
        previousCostPrice: isEntry && transCost !== p.costPrice ? p.costPrice : p.previousCostPrice,
        costPrice: isEntry ? transCost : p.costPrice
      };
    }));
    setModalType(null); setQuantity(0); setSelectedProduct(null);
  };

  const confirmDelete = () => {
    if (!selectedProduct) return;
    setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
    setModalType(null);
    setSelectedProduct(null);
  };

  if (!currentUser) return <AuthScreen onAuth={setCurrentUser} />;

  return (
    <div className="min-h-screen md:pl-64 bg-slate-50 pb-safe pt-safe">
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-4 p-5 rounded-[24px] shadow-2xl animate-in slide-in-from-right-10 duration-500 bg-white border-2 ${t.type === 'error' ? 'border-red-100' : 'border-emerald-100'}`}>
            <div className={`p-3 rounded-xl ${t.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangleIcon />
            </div>
            <p className="text-[10px] font-black uppercase text-slate-800 tracking-tight flex-1">{t.message}</p>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-300 hover:text-slate-600 transition-colors">
              <XIcon />
            </button>
            <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 animate-notice-progress rounded-full opacity-30"></div>
          </div>
        ))}
      </div>

      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 p-8 hidden md:flex flex-col z-50">
        <div className="flex items-center gap-4 mb-14 text-indigo-600 font-black text-xl">
          <div className="bg-indigo-600 text-white p-3 rounded-[18px] shadow-lg shadow-indigo-200"><PackageIcon /></div>
          <span className="tracking-tighter uppercase text-left leading-tight">Estoque<br/>Master</span>
        </div>
        <div className="space-y-3 flex-1">
          <button 
            onClick={() => { setCurrentView('inventory'); setActiveGroup('RAW_MATERIAL'); setSelectedCategory('Todas'); }} 
            className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'inventory' && activeGroup === 'RAW_MATERIAL' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <BarcodeIcon /> Matéria Prima
          </button>
          <button 
            onClick={() => { setCurrentView('inventory'); setActiveGroup('FINISHED_GOOD'); setSelectedCategory('Todas'); }} 
            className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'inventory' && activeGroup === 'FINISHED_GOOD' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <PackageIcon /> Produto Acabado
          </button>
          <button 
            onClick={() => setCurrentView('stats')} 
            className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'stats' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <StatsIcon /> Dashboards
          </button>
          <button 
            onClick={() => setCurrentView('history')} 
            className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'history' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <HistoryIcon /> Atividades
          </button>
        </div>
        <div className="pt-8 border-t border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[18px] bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-100 text-lg uppercase">{currentUser.name[0]}</div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-[10px] font-black uppercase text-slate-800 truncate">{currentUser.name}</p>
            <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">{currentUser.role === 'ADMIN' ? 'Admin' : 'Leitor'}</p>
          </div>
          <button onClick={() => setCurrentUser(null)} className="p-3 text-slate-300 hover:text-red-500 transition-colors bg-slate-50 rounded-xl"><XIcon /></button>
        </div>
      </nav>

      <header className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 p-4 md:p-6 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 w-full">
          <div className="relative flex-1 md:w-96 group">
            <input type="text" placeholder="Buscar por Nome, Código, EAN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-100 rounded-[22px] px-8 py-4.5 text-sm outline-none font-bold border-2 border-transparent focus:bg-white focus:border-indigo-600 transition-all shadow-inner" />
          </div>
          <div className="flex items-center gap-4">
             <button onClick={handleFullInventoryPDF} className="bg-red-600 text-white px-8 py-4.5 rounded-[22px] text-[10px] font-black uppercase shadow-xl flex items-center gap-3 hover:bg-red-700 transition-all active:scale-95" title="Relatório de Estoque Completo"><FileTextIcon /> PDF Geral</button>
             <button onClick={() => exportService.exportToExcel(products, transactions, startDate, endDate)} className="bg-slate-900 text-white px-8 py-4.5 rounded-[22px] text-[10px] font-black uppercase shadow-xl flex items-center gap-3 hover:bg-black transition-all active:scale-95"><DownloadIcon /> Excel Filtrado</button>
             {canEdit && currentView === 'inventory' && (
               <button onClick={() => { setForm({ type: activeGroup, category: categories[0] || 'Diversos', unit: 'UN' }); setModalType('add'); }} className="bg-indigo-600 text-white px-10 py-4.5 rounded-[22px] font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 active:scale-95 transition-all w-full md:w-auto flex items-center justify-center gap-3"><PlusIcon /> Novo Cadastro</button>
             )}
          </div>
        </div>
      </header>

      <main className="p-4 md:p-10 max-w-7xl mx-auto">
        {currentView === 'inventory' && (
          <>
            <div className="flex flex-col gap-6 mb-10">
               <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-3 text-[10px] font-black shadow-sm flex items-center gap-2">
                    <span className="text-slate-300 uppercase">Categoria:</span>
                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="bg-transparent outline-none cursor-pointer text-indigo-600 uppercase font-black">
                      <option value="Todas">Todas</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="ml-auto flex items-center bg-white border-2 border-slate-100 rounded-[18px] p-1 shadow-sm">
                    <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><PackageIcon /></button>
                    <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}><FileTextIcon /></button>
                  </div>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2"><FilterIcon /> Alertas:</span>
                  <button onClick={() => toggleAlert('CRITICAL')} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border-2 transition-all ${activeAlerts.includes('CRITICAL') ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>Crítico 🔴</button>
                  <button onClick={() => toggleAlert('ATTENTION')} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border-2 transition-all ${activeAlerts.includes('ATTENTION') ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>Atenção 🟠</button>
               </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProducts.map(p => (
                  <ProductCard key={p.id} product={p} canEdit={canEdit} currencyFormatter={cf}
                    onEntry={handleEntry} onExit={handleExit} onEdit={handleEdit} onDelete={handleDeleteClick} onExportPDF={handleExportPDF} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[40px] overflow-hidden border-2 border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-6">Código / EAN</th>
                      <th className="px-6 py-6">Nome do Item</th>
                      <th className="px-6 py-6 text-center">Estoque Mín.</th>
                      <th className="px-6 py-6 text-center">Consumo Mês</th>
                      <th className="px-6 py-6 text-center">Saldo</th>
                      <th className="px-6 py-6 text-center">Autonomia</th>
                      <th className="px-6 py-6 text-right">Custo Un.</th>
                      <th className="px-6 py-6 text-right">P. Venda</th>
                      <th className="px-6 py-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className={`hover:bg-indigo-50/30 transition-all ${p.currentStock <= p.minStock ? 'bg-red-50/20' : ''}`}>
                        <td className="px-6 py-5 text-[10px] font-bold text-slate-400">#{p.code}<br/>{p.ean || '---'}</td>
                        <td className="px-6 py-5 text-xs font-black uppercase text-slate-800">{p.name}<br/><span className="text-[8px] font-bold text-slate-300">{p.category}</span></td>
                        <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{p.minStock} {p.unit}</td>
                        <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{p.monthlyConsumption} {p.unit}</td>
                        <td className="px-6 py-5 text-center"><span className={`font-black text-[13px] ${p.currentStock <= p.minStock ? 'text-red-600' : 'text-slate-800'}`}>{p.currentStock} {p.unit}</span></td>
                        <td className="px-6 py-5 text-center text-[10px] font-bold text-slate-500">{p.monthlyConsumption > 0 ? `${Math.round((p.currentStock / p.monthlyConsumption) * 30)}d` : '∞'}</td>
                        <td className="px-6 py-5 text-right text-[11px] font-black text-slate-600">{cf.format(p.costPrice)}</td>
                        <td className="px-6 py-5 text-right text-[11px] font-black text-indigo-600">{cf.format(p.salePrice)}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-1">
                             <button onClick={() => handleExportPDF(p)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg" title="Gerar Relatório Detalhado do Produto"><FileTextIcon /></button>
                             {canEdit ? (
                               <>
                                 <button onClick={() => handleEntry(p)} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg"><PlusIcon /></button>
                                 <button onClick={() => handleEdit(p)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg"><EditIcon /></button>
                                 <button onClick={() => handleDeleteClick(p)} className="text-red-600 p-2 hover:bg-red-50 rounded-lg"><TrashIcon /></button>
                               </>
                             ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {currentView === 'history' && (
           <div className="bg-white rounded-[40px] border-2 border-slate-100 p-10 shadow-sm animate-in fade-in slide-in-from-bottom-4 text-left">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-3"><HistoryIcon /> Movimentações</h2>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-[10px] font-black uppercase text-indigo-600 bg-transparent" />
                  <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-[10px] font-black uppercase text-indigo-600 bg-transparent" />
                </div>
              </div>
              <div className="space-y-4">
                {filteredTransactions.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-6 bg-slate-50 rounded-[28px] border border-slate-100">
                    <div className="flex items-center gap-6 text-left">
                      <div className={`p-4 rounded-2xl ${t.type === TRANSACTION_TYPES.ENTRY ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {t.type === TRANSACTION_TYPES.ENTRY ? <PlusIcon /> : <AlertTriangleIcon />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-800">{t.productName}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Operador: {t.userName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${t.type === TRANSACTION_TYPES.ENTRY ? 'text-emerald-600' : 'text-red-600'}`}>{t.type === TRANSACTION_TYPES.ENTRY ? '+' : '-'}{t.quantity}</p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        )}

        {currentView === 'stats' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="text-left">
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Financeiro</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Valor em estoque por categoria</p>
              </div>
              <div className="bg-white border-2 border-slate-100 rounded-3xl px-8 py-4 shadow-sm">
                 <select value={statsCategoryFilter} onChange={e => setStatsCategoryFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer text-indigo-600 uppercase font-black text-xs">
                   <option value="Todas">Todas Categorias</option>
                   {categories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 text-left">
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-indigo-50">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Valor Total (Custo)</p>
                <p className="text-3xl font-black text-slate-800">{cf.format(globalStats.totalValue)}</p>
              </div>
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-red-50">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Itens Críticos</p>
                <p className="text-3xl font-black text-red-600">{globalStats.criticalCount}</p>
              </div>
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Volume de Itens</p>
                <p className="text-3xl font-black text-slate-800">{globalStats.totalItems.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white rounded-[56px] p-12 shadow-sm border-2 border-slate-100">
               <div className="space-y-12">
                  {statsData.map(([category, values]) => {
                    const total = values.raw + values.finished;
                    const maxVal = Math.max(...statsData.map(d => d[1].raw + d[1].finished));
                    const rawWidth = (values.raw / maxVal) * 100;
                    const finWidth = (values.finished / maxVal) * 100;
                    return (
                      <div key={category} className="group text-left">
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-sm font-black text-slate-800 uppercase">{category}</span>
                          <span className="text-xs font-black text-slate-400">{cf.format(total)}</span>
                        </div>
                        <div className="flex h-6 rounded-full overflow-hidden bg-slate-50 border border-slate-100">
                          <div style={{ width: `${rawWidth}%` }} className="h-full bg-indigo-500"></div>
                          <div style={{ width: `${finWidth}%` }} className="h-full bg-emerald-500"></div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        )}
      </main>

      {modalType === 'delete' && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[48px] w-full max-w-md p-12 shadow-2xl">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8"><TrashIcon /></div>
            <h2 className="text-2xl font-black uppercase text-slate-800 mb-4">Excluir Produto?</h2>
            <p className="text-slate-400 font-bold text-xs mb-12">O produto {selectedProduct.name} será removido permanentemente.</p>
            <div className="flex gap-4">
              <button onClick={() => setModalType(null)} className="flex-1 bg-slate-100 py-6 rounded-[28px] font-black text-[10px] uppercase">Cancelar</button>
              <button onClick={confirmDelete} className="flex-[2] bg-red-600 text-white py-6 rounded-[28px] font-black text-[10px] uppercase">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[56px] w-full max-w-2xl p-8 md:p-14 shadow-2xl">
            <h2 className="text-3xl font-black mb-12 uppercase text-slate-800 text-center">Cadastro de {activeGroup === 'RAW_MATERIAL' ? 'Matéria Prima' : 'Produto Acabado'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Nome do Produto</label><input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] outline-none font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Código Interno</label><input value={form.code || ''} onChange={e => setForm({...form, code: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Categoria</label>
                <select value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 outline-none">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Diversos">Diversos</option>
                </select>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">EAN (Unitário)</label><input value={form.ean || ''} onChange={e => setForm({...form, ean: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Custo Unitário</label><input type="number" value={form.costPrice || ''} onChange={e => setForm({...form, costPrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">P. Venda</label><input type="number" value={form.salePrice || ''} onChange={e => setForm({...form, salePrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Estoque Mínimo</label><input type="number" value={form.minStock || ''} onChange={e => setForm({...form, minStock: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Consumo Mensal</label><input type="number" value={form.monthlyConsumption || ''} onChange={e => setForm({...form, monthlyConsumption: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600" /></div>
            </div>
            <div className="flex gap-6 mt-14">
              <button onClick={() => setModalType(null)} className="flex-1 bg-slate-100 text-slate-500 font-black py-7 rounded-[32px] uppercase">Cancelar</button>
              <button onClick={() => {
                if (modalType === 'edit' && selectedProduct) {
                  setProducts(prev => prev.map(p => p.id === selectedProduct.id ? ({ ...p, ...form } as Product) : p));
                } else {
                  const newProd: Product = { id: crypto.randomUUID(), type: activeGroup, name: form.name || 'S/N', code: form.code || '000', category: form.category || 'Geral', unit: form.unit || 'UN', currentStock: 0, costPrice: form.costPrice || 0, salePrice: form.salePrice || 0, minStock: form.minStock || 0, safetyStock: (form.minStock || 0) * 1.5, monthlyConsumption: form.monthlyConsumption || 0, ean: form.ean };
                  setProducts(prev => [newProd, ...prev]);
                }
                setModalType(null); setForm({});
              }} className="flex-[2] bg-indigo-600 text-white py-7 rounded-[32px] font-black uppercase shadow-2xl">Gravar Dados</button>
            </div>
          </div>
        </div>
      )}

      {(modalType === TRANSACTION_TYPES.ENTRY || modalType === TRANSACTION_TYPES.EXIT) && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[48px] w-full max-w-md p-12 shadow-2xl">
            <p className="text-[10px] font-black text-indigo-500 uppercase mb-6">{modalType}</p>
            <h2 className="text-2xl font-black uppercase text-slate-800 mb-12">{selectedProduct.name}</h2>
            <input type="number" value={quantity || ''} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 p-8 rounded-[36px] text-5xl font-black text-indigo-600 text-center outline-none border-4 border-transparent focus:border-indigo-600" autoFocus />
            <div className="flex gap-4 pt-12">
              <button onClick={() => setModalType(null)} className="flex-1 bg-slate-100 py-7 rounded-[28px] font-black text-[10px] uppercase text-slate-400">Voltar</button>
              <button onClick={handleTransaction} className="flex-[2] bg-indigo-600 text-white py-7 rounded-[28px] font-black text-[10px] uppercase shadow-2xl">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
