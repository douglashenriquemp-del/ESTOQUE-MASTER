
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

interface ProductCardProps {
  product: Product;
  canEdit: boolean;
  onEntry: (p: Product) => void;
  onExit: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  currencyFormatter: Intl.NumberFormat;
}

const ProductCard = React.memo<ProductCardProps>(({ 
  product, 
  canEdit, 
  onEntry, 
  onExit, 
  onEdit, 
  onDelete,
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

        {canEdit ? (
          <div className="flex gap-2">
            <button onClick={() => onEntry(product)} className="flex-1 bg-emerald-600 text-white py-4 rounded-[20px] text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all hover:bg-emerald-700">Entrada</button>
            <button onClick={() => onExit(product)} className="flex-1 bg-slate-900 text-white py-4 rounded-[20px] text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all hover:bg-black">Saída</button>
            <button onClick={() => onEdit(product)} className="p-4 bg-indigo-50 text-indigo-600 rounded-[20px] hover:bg-indigo-100 transition-all active:scale-95"><EditIcon /></button>
            <button onClick={() => onDelete(product)} className="p-4 bg-red-50 text-red-600 rounded-[20px] hover:bg-red-100 transition-all active:scale-95"><TrashIcon /></button>
          </div>
        ) : (
          <div className="bg-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-widest py-4 rounded-[20px] flex items-center justify-center cursor-not-allowed opacity-60">Visualização Apenas</div>
        )}
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
      const admins = users.filter(x => x.role === 'ADMIN').length;
      const viewers = users.filter(x => x.role === 'VIEWER').length;

      if (form.role === 'ADMIN' && admins >= 3) return alert("Limite de 3 administradores atingido.");
      if (form.role === 'VIEWER' && viewers >= 5) return alert("Limite de 5 logins de visualização atingido.");

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

const TutorialOverlay: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Gestão Profissional", desc: "Controle insumos e produtos acabados com precisão industrial.", icon: <PackageIcon /> },
    { title: "Prioridade Crítica", desc: "Itens com estoque baixo aparecem automaticamente no topo da lista.", icon: <AlertTriangleIcon /> },
    { title: "Dias de Cobertura", desc: "Saiba exatamente por quantos dias seu estoque atual irá durar baseado no consumo mensal.", icon: <TrendingUpIcon /> },
    { title: "Dashboard Inteligente", desc: "Acompanhe o valor financeiro do seu estoque por categoria e tipo de produto.", icon: <StatsIcon /> }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 text-center">
      <div className="bg-white rounded-[56px] w-full max-w-lg p-14 shadow-2xl animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner scale-125">{steps[step].icon}</div>
        <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter text-slate-800">{steps[step].title}</h2>
        <p className="text-slate-500 font-medium text-base mb-12">{steps[step].desc}</p>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 flex-1">{steps.map((_, i) => (<div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`}></div>))}</div>
          <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()} className="bg-indigo-600 text-white px-10 py-5 rounded-[24px] font-black text-xs uppercase shadow-xl hover:bg-indigo-700">{step === steps.length - 1 ? "Entrar" : "Próximo"}</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('inventory');
  const [activeGroup, setActiveGroup] = useState<ProductGroup>('RAW_MATERIAL');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [activeAlerts, setActiveAlerts] = useState<AlertType[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'name', direction: 'asc' });

  // Estados para filtros de histórico
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
    setProducts(storageService.getProducts());
    setTransactions(storageService.getTransactions());
    if (!localStorage.getItem('tutorial_completed')) setShowTutorial(true);
  }, []);

  useEffect(() => { storageService.saveProducts(products); }, [products]);
  useEffect(() => { storageService.saveTransactions(transactions); }, [transactions]);

  const canEdit = useMemo(() => currentUser?.role === 'ADMIN', [currentUser]);

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

  const toggleAlert = (alert: AlertType) => {
    setActiveAlerts(prev => prev.includes(alert) ? prev.filter(a => a !== alert) : [...prev, alert]);
  };

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

  const categories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category))).sort();
  }, [products]);

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
      if (modalType === TRANSACTION_TYPES.ENTRY) {
        newStock += quantity;
      } else if (modalType === TRANSACTION_TYPES.EXIT) {
        newStock -= quantity;
      }
      const newHistory = isEntry ? [...(p.costHistory || []), { price: transCost, date: new Date().toISOString() }] : (p.costHistory || []);
      return { 
        ...p, 
        currentStock: Math.max(0, newStock), 
        previousCostPrice: isEntry && transCost !== p.costPrice ? p.costPrice : p.previousCostPrice,
        costPrice: isEntry ? transCost : p.costPrice, 
        costHistory: newHistory 
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
      {showTutorial && <TutorialOverlay onComplete={() => { setShowTutorial(false); localStorage.setItem('tutorial_completed', 'true'); }} />}
      
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 p-8 hidden md:flex flex-col z-50">
        <div className="flex items-center gap-4 mb-14 text-indigo-600 font-black text-xl">
          <div className="bg-indigo-600 text-white p-3 rounded-[18px] shadow-lg shadow-indigo-200"><PackageIcon /></div>
          <span className="tracking-tighter uppercase text-left">Estoque Master</span>
        </div>
        <div className="space-y-3 flex-1">
          <button onClick={() => setCurrentView('inventory')} className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'inventory' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><PackageIcon /> Inventário</button>
          <button onClick={() => setCurrentView('stats')} className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'stats' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><StatsIcon /> Dashboards</button>
          <button onClick={() => setCurrentView('history')} className={`w-full flex items-center gap-4 p-5 rounded-[22px] font-black text-[10px] uppercase transition-all ${currentView === 'history' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}><HistoryIcon /> Atividades</button>
        </div>
        <div className="pt-8 border-t border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[18px] bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-indigo-100 text-lg uppercase">{currentUser.name[0]}</div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-[10px] font-black uppercase text-slate-800 truncate">{currentUser.name}</p>
            <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">{currentUser.role === 'ADMIN' ? 'Admin' : 'Visualizador'}</p>
          </div>
          <button onClick={() => setCurrentUser(null)} className="p-3 text-slate-300 hover:text-red-500 transition-colors bg-slate-50 rounded-xl"><XIcon /></button>
        </div>
      </nav>

      <header className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 p-4 md:p-6 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 w-full">
          <div className="relative flex-1 md:w-96 group">
            <input type="text" placeholder="Buscar por Nome, Código, EAN..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-100 rounded-[22px] px-8 py-4.5 text-sm outline-none font-bold border-2 border-transparent focus:bg-white focus:border-indigo-600 transition-all shadow-inner" />
          </div>
          {canEdit && currentView === 'inventory' && (
            <button onClick={() => { setForm({ type: activeGroup, category: 'Especiarias', unit: 'UN' }); setModalType('add'); }} className="bg-indigo-600 text-white px-10 py-4.5 rounded-[22px] font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 active:scale-95 transition-all w-full md:w-auto flex items-center justify-center gap-3"><PlusIcon /> Novo Registro</button>
          )}
        </div>
      </header>

      <main className="p-4 md:p-10 max-w-7xl mx-auto">
        {currentView === 'inventory' && (
          <>
            <div className="flex flex-col gap-6 mb-10">
               {/* Seletor de Tipo de Produto (Abas Principais) */}
               <div className="flex p-1.5 bg-slate-200 rounded-[32px] w-full max-w-lg mx-auto md:mx-0 shadow-inner">
                  <button 
                    onClick={() => setActiveGroup('RAW_MATERIAL')}
                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[26px] font-black text-[10px] uppercase transition-all ${activeGroup === 'RAW_MATERIAL' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <BarcodeIcon /> Matéria Prima
                  </button>
                  <button 
                    onClick={() => setActiveGroup('FINISHED_GOOD')}
                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[26px] font-black text-[10px] uppercase transition-all ${activeGroup === 'FINISHED_GOOD' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <PackageIcon /> Produtos Acabados
                  </button>
               </div>

               <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-3 text-[10px] font-black shadow-sm flex items-center gap-2">
                    <span className="text-slate-300 uppercase">Categoria:</span>
                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="bg-transparent outline-none cursor-pointer text-indigo-600 uppercase font-black">
                      <option value="Todas">Todas</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="ml-auto flex items-center bg-white border-2 border-slate-100 rounded-[18px] p-1 shadow-sm">
                    <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`} title="Cards"><PackageIcon /></button>
                    <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`} title="Lista"><FileTextIcon /></button>
                  </div>
                  <button onClick={() => exportService.exportToExcel(products, transactions)} className="bg-slate-900 text-white px-8 py-4 rounded-[22px] text-[10px] font-black uppercase shadow-xl flex items-center gap-3 hover:bg-black transition-all active:scale-95 tracking-widest"><DownloadIcon /> Excel</button>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2"><FilterIcon /> Alertas:</span>
                  <button onClick={() => toggleAlert('CRITICAL')} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 ${activeAlerts.includes('CRITICAL') ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100' : 'bg-white border-slate-100 text-slate-400 hover:border-red-200'}`}>Crítico 🔴</button>
                  <button onClick={() => toggleAlert('ATTENTION')} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 ${activeAlerts.includes('ATTENTION') ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-white border-slate-100 text-slate-400 hover:border-orange-200'}`}>Atenção 🟠</button>
                  <button onClick={() => toggleAlert('COST_ALARM')} className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-wider border-2 transition-all flex items-center gap-2 ${activeAlerts.includes('COST_ALARM') ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}>Custo 📈</button>
                  {activeAlerts.length > 0 && (
                    <button onClick={() => setActiveAlerts([])} className="text-[9px] font-black text-slate-300 uppercase hover:text-red-500 transition-colors px-3 py-2 flex items-center gap-1"><XIcon /> Limpar</button>
                  )}
               </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProducts.map(p => (
                  <ProductCard key={p.id} product={p} canEdit={canEdit} currencyFormatter={cf}
                    onEntry={handleEntry}
                    onExit={handleExit}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick} />
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-xs">Nenhum {activeGroup === 'RAW_MATERIAL' ? 'insumo' : 'produto acabado'} encontrado</div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[40px] overflow-hidden border-2 border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                    <tr>
                      <th className="px-6 py-6">Cód / EAN</th>
                      <th className="px-6 py-6">Descrição</th>
                      <th className="px-6 py-6 text-center">Mínimo</th>
                      <th className="px-6 py-6 text-center">Consumo Mensal</th>
                      <th className="px-6 py-6 text-center">Saldo</th>
                      <th className="px-6 py-6 text-center">Autonomia</th>
                      <th className="px-6 py-6 text-right">Custo Un.</th>
                      <th className="px-6 py-6 text-right">Preço Venda</th>
                      <th className="px-6 py-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className={`hover:bg-indigo-50/30 transition-all ${p.currentStock <= p.minStock ? 'bg-red-50/20' : ''}`}>
                        <td className="px-6 py-5 text-[10px] font-bold text-slate-400">#{p.code}<br/>{p.ean || '---'}</td>
                        <td className="px-6 py-5 text-xs font-black uppercase text-slate-800">
                          <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.previousCostPrice !== undefined && p.costPrice > p.previousCostPrice && (
                                <span className="text-[10px]" title="Custo subiu">📈</span>
                              )}
                            </div>
                            <span className="text-[8px] font-bold text-slate-300 mt-0.5">{p.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{p.minStock} {p.unit}</td>
                        <td className="px-6 py-5 text-center text-[11px] font-bold text-slate-500">{p.monthlyConsumption} {p.unit}</td>
                        <td className="px-6 py-5 text-center">
                          <span className={`font-black text-[13px] ${p.currentStock <= p.minStock ? 'text-red-600' : 'text-slate-800'}`}>
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-center text-[10px] font-bold text-slate-500">
                          {p.monthlyConsumption > 0 ? `${Math.round((p.currentStock / p.monthlyConsumption) * 30)} dias` : '∞'}
                        </td>
                        <td className="px-6 py-5 text-right text-[11px] font-black text-slate-600">{cf.format(p.costPrice)}</td>
                        <td className="px-6 py-5 text-right text-[11px] font-black text-indigo-600">{cf.format(p.salePrice)}</td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-1">
                             {canEdit ? (
                               <>
                                 <button onClick={() => handleEntry(p)} className="text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg transition-colors" title="Entrada"><PlusIcon /></button>
                                 <button onClick={() => handleEdit(p)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><EditIcon /></button>
                                 <button onClick={() => handleDeleteClick(p)} className="text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><TrashIcon /></button>
                               </>
                             ) : <span className="text-[8px] font-black text-slate-300">LEITURA</span>}
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

        {currentView === 'stats' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="text-left">
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Painel de Controle Financeiro</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Análise de valor em estoque por categoria</p>
              </div>
              <div className="bg-white border-2 border-slate-100 rounded-3xl px-8 py-4 shadow-sm flex items-center gap-4">
                 <span className="text-[10px] font-black text-slate-300 uppercase">Filtrar Categoria:</span>
                 <select value={statsCategoryFilter} onChange={e => setStatsCategoryFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer text-indigo-600 uppercase font-black text-xs">
                   <option value="Todas">Todas</option>
                   {categories.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-indigo-50 text-left">
                <div className="bg-indigo-100 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-6"><TrendingUpIcon /></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total (Custo)</p>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{cf.format(globalStats.totalValue)}</p>
              </div>
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-red-50 text-left">
                <div className="bg-red-100 w-12 h-12 rounded-2xl flex items-center justify-center text-red-600 mb-6"><AlertTriangleIcon /></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens Críticos</p>
                <p className="text-3xl font-black text-red-600 tracking-tighter">{globalStats.criticalCount} <span className="text-xs text-slate-300 font-bold uppercase ml-1">Produtos</span></p>
              </div>
              <div className="bg-white p-10 rounded-[44px] shadow-sm border-2 border-slate-50 text-left">
                <div className="bg-slate-100 w-12 h-12 rounded-2xl flex items-center justify-center text-slate-600 mb-6"><PackageIcon /></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume de Estoque</p>
                <p className="text-3xl font-black text-slate-800 tracking-tighter">{globalStats.totalItems.toLocaleString()} <span className="text-xs text-slate-300 font-bold uppercase ml-1">Unidades</span></p>
              </div>
            </div>

            <div className="bg-white rounded-[56px] p-12 shadow-sm border-2 border-slate-100">
               <div className="flex justify-between items-center mb-14">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Valor de Estoque por Categoria</p>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500"></div><span className="text-[9px] font-black text-slate-400 uppercase">Matéria Prima</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-[9px] font-black text-slate-400 uppercase">Produto Acabado</span></div>
                  </div>
               </div>

               <div className="space-y-12">
                  {statsData.map(([category, values]) => {
                    const total = values.raw + values.finished;
                    const maxVal = Math.max(...statsData.map(d => d[1].raw + d[1].finished));
                    const rawWidth = (values.raw / maxVal) * 100;
                    const finWidth = (values.finished / maxVal) * 100;
                    return (
                      <div key={category} className="group text-left">
                        <div className="flex justify-between items-end mb-4">
                          <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{category}</span>
                          <span className="text-xs font-black text-slate-400">{cf.format(total)}</span>
                        </div>
                        <div className="flex h-6 rounded-full overflow-hidden bg-slate-50 border border-slate-100 shadow-inner group-hover:scale-[1.01] transition-transform">
                          <div style={{ width: `${rawWidth}%` }} className="h-full bg-indigo-500 shadow-md relative group/bar">
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                          </div>
                          <div style={{ width: `${finWidth}%` }} className="h-full bg-emerald-500 shadow-md relative group/bar">
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity"></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        )}

        {currentView === 'history' && (
           <div className="bg-white rounded-[40px] border-2 border-slate-100 p-10 shadow-sm animate-in fade-in slide-in-from-bottom-4 text-left">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-3"><HistoryIcon /> Registro de Atividades</h2>
                
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 w-full md:w-auto">
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200">
                    <CalendarIcon />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-[10px] font-black uppercase text-indigo-600" title="Data Inicial" />
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase">até</span>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200">
                    <CalendarIcon />
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-[10px] font-black uppercase text-indigo-600" title="Data Final" />
                  </div>
                  {(startDate || endDate) && (
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-red-500 p-2 hover:bg-red-50 rounded-xl transition-colors" title="Limpar"><XIcon /></button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                  <div key={t.id} className="flex flex-col md:flex-row justify-between items-center p-6 bg-slate-50 rounded-[28px] border border-slate-100 hover:border-indigo-100 transition-all text-left w-full gap-4">
                    <div className="flex items-center gap-6 flex-1 text-left">
                      <div className={`p-4 rounded-2xl ${t.type === TRANSACTION_TYPES.ENTRY ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {t.type === TRANSACTION_TYPES.ENTRY ? <PlusIcon /> : <AlertTriangleIcon />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-800 tracking-tighter">{t.productName}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Responsável: {t.userName}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className={`text-xl font-black ${t.type === TRANSACTION_TYPES.ENTRY ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === TRANSACTION_TYPES.ENTRY ? '+' : '-'}{t.quantity}
                      </p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase">{new Date(t.date).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )) : (
                  <div className="py-20 text-center text-slate-300 uppercase font-black text-xs">Nenhuma atividade registrada</div>
                )}
              </div>
           </div>
        )}
      </main>

      {/* Modal de Exclusão */}
      {modalType === 'delete' && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[48px] w-full max-w-md p-12 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner"><TrashIcon /></div>
            <h2 className="text-2xl font-black uppercase text-slate-800 mb-4">Confirmar Exclusão?</h2>
            <p className="text-slate-400 font-bold text-xs uppercase mb-12">O produto <strong>{selectedProduct.name}</strong> será removido permanentemente.</p>
            <div className="flex gap-4">
              <button onClick={() => setModalType(null)} className="flex-1 bg-slate-100 py-6 rounded-[28px] font-black text-[10px] uppercase text-slate-400 active:scale-95 transition-all">Cancelar</button>
              <button onClick={confirmDelete} className="flex-[2] bg-red-600 text-white py-6 rounded-[28px] font-black text-[10px] uppercase shadow-2xl active:scale-95 transition-all">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Cadastro/Edição */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[56px] w-full max-w-2xl p-8 md:p-14 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300">
            <h2 className="text-4xl font-black mb-12 uppercase tracking-tighter text-slate-800 text-center">{modalType === 'add' ? 'Novo Registro' : 'Editar Registro'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Nome Completo</label>
                <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] outline-none font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" />
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Código Interno</label><input value={form.code || ''} onChange={e => setForm({...form, code: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Tipo</label>
                <select value={form.type || activeGroup} onChange={e => setForm({...form, type: e.target.value as any})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner appearance-none">
                  <option value="RAW_MATERIAL">Matéria Prima</option>
                  <option value="FINISHED_GOOD">Produto Acabado</option>
                </select>
              </div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">EAN (Unitário)</label><input value={form.ean || ''} onChange={e => setForm({...form, ean: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Custo Unitário (R$)</label><input type="number" value={form.costPrice || ''} onChange={e => setForm({...form, costPrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Preço Venda (R$)</label><input type="number" value={form.salePrice || ''} onChange={e => setForm({...form, salePrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Consumo Mensal</label><input type="number" value={form.monthlyConsumption || ''} onChange={e => setForm({...form, monthlyConsumption: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Estoque Mínimo</label><input type="number" value={form.minStock || ''} onChange={e => setForm({...form, minStock: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase block mb-3 px-2">Categoria</label><input value={form.category || 'Geral'} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-slate-50 p-6 rounded-[28px] font-bold border-4 border-transparent focus:border-indigo-600 shadow-inner" /></div>
            </div>
            <div className="flex gap-6 mt-14">
              <button onClick={() => setModalType(null)} className="flex-1 bg-slate-100 text-slate-500 font-black py-7 rounded-[32px] uppercase active:scale-95 transition-all hover:bg-slate-200">Cancelar</button>
              <button onClick={() => {
                if (modalType === 'edit' && selectedProduct) {
                  setProducts(prev => prev.map(p => p.id === selectedProduct.id ? ({ ...p, ...form } as Product) : p));
                } else {
                  const newProduct: Product = { 
                    id: crypto.randomUUID(), type: form.type || activeGroup,
                    code: form.code || '000', name: form.name || 'Sem Nome', category: form.category || 'Geral', unit: form.unit || 'UN', 
                    currentStock: 0, costPrice: form.costPrice || 0, salePrice: form.salePrice || 0,
                    minStock: form.minStock || 0, safetyStock: (form.minStock || 0) * 1.5, monthlyConsumption: form.monthlyConsumption || 0, 
                    costHistory: [], ean: form.ean, dun: form.dun
                  };
                  setProducts(prev => [newProduct, ...prev]);
                }
                setModalType(null); setForm({}); setSelectedProduct(null);
              }} className="flex-[2] bg-indigo-600 text-white py-7 rounded-[32px] font-black uppercase shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all">Gravar Informações</button>
            </div>
          </div>
        </div>
      )}

      {(modalType === TRANSACTION_TYPES.ENTRY || modalType === TRANSACTION_TYPES.EXIT) && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[48px] w-full max-w-md p-12 shadow-2xl animate-in fade-in slide-in-from-bottom-10 duration-300">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-6">Registro de {modalType}</p>
            <h2 className="text-2xl font-black uppercase text-slate-800 mb-12">{selectedProduct.name}</h2>
            <div className="space-y-8">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-4">Quantidade ({selectedProduct.unit})</label>
                <input type="number" value={quantity || ''} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 p-8 rounded-[36px] text-5xl font-black text-indigo-600 text-center outline-none border-4 border-transparent focus:border-indigo-600 focus:bg-white transition-all shadow-inner" autoFocus />
              </div>
              {modalType === TRANSACTION_TYPES.ENTRY && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-4">Novo Custo (R$)</label>
                  <input type="number" value={transCost || ''} onChange={e => setTransCost(parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 p-6 rounded-[28px] text-xl font-black text-slate-600 text-center outline-none border-4 border-transparent focus:border-indigo-600 focus:bg-white transition-all shadow-inner" />
                </div>
              )}
              <div className="flex gap-4 pt-8">
                <button onClick={() => { setModalType(null); setSelectedProduct(null); }} className="flex-1 bg-slate-100 py-7 rounded-[28px] font-black text-[10px] uppercase text-slate-400 active:scale-95 transition-all">Voltar</button>
                <button onClick={handleTransaction} className="flex-[2] bg-indigo-600 text-white py-7 rounded-[28px] font-black text-[10px] uppercase shadow-2xl active:scale-95 transition-all">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
