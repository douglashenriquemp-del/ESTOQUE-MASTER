import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Transaction, TransactionType } from './types.ts';
import { storageService } from './services/storageService.ts';
import { exportService } from './services/exportService.ts';
import { 
  PlusIcon, 
  MinusIcon, 
  EditIcon, 
  DownloadIcon, 
  UploadIcon,
  HistoryIcon, 
  PackageIcon,
  AlertTriangleIcon,
  StatsIcon,
  OutOfStockIcon,
  TrendingUpIcon,
  CalendarIcon,
  FileTextIcon,
  ArrowLeftIcon,
  TrashIcon,
  HelpCircleIcon,
  XIcon,
  CameraIcon
} from './components/Icons.tsx';

type View = 'inventory' | 'history' | 'stats';
type ModalMode = TransactionType | 'add' | 'edit' | 'bulkAdd' | 'tutorial' | null;

// Componente Card de Produto Otimizado
const ProductCard: React.FC<{
  product: Product;
  isSelected: boolean;
  currencyFormatter: Intl.NumberFormat;
  onToggleSelect: (id: string) => void;
  onEntry: (product: Product) => void;
  onExit: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onReport: (product: Product) => void;
}> = React.memo(({ 
  product, 
  isSelected, 
  currencyFormatter, 
  onToggleSelect, 
  onEntry, 
  onExit, 
  onEdit, 
  onDelete, 
  onReport 
}) => {
  const [showCardTutorial, setShowCardTutorial] = useState(false);
  const isOutOfStock = product.currentStock === 0;
  const isRed = product.currentStock <= product.minStock;
  const isYellow = !isRed && product.currentStock <= (product.minStock * 1.5);
  const isCostUp = product.previousCostPrice !== undefined && product.costPrice > product.previousCostPrice;
  const autonomyDays = product.monthlyConsumption > 0 ? Math.floor((product.currentStock / product.monthlyConsumption) * 30) : 0;

  const maxPrice = Math.max(product.costPrice, product.salePrice, 1);
  const costWidth = (product.costPrice / maxPrice) * 100;
  const saleWidth = (product.salePrice / maxPrice) * 100;
  const marginPerc = product.costPrice > 0 ? Math.round(((product.salePrice - product.costPrice) / product.costPrice) * 100) : 0;

  const prevCostEntry = product.costHistory && product.costHistory.length > 1 ? product.costHistory[1] : null;
  const costTooltip = prevCostEntry 
    ? `Custo anterior: ${currencyFormatter.format(prevCostEntry.price)} em ${new Date(prevCostEntry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : 'Sem histórico de custo anterior';

  const toggleTutorial = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCardTutorial(!showCardTutorial);
  };

  return (
    <div 
      onClick={() => onToggleSelect(product.id)}
      className={`group relative bg-white rounded-[40px] border-2 p-6 md:p-8 shadow-sm transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50' : isOutOfStock ? 'border-slate-800' : isRed ? 'border-red-400' : 'border-slate-100 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1'}`}
    >
      {/* Botão Tutorial */}
      <button 
        onClick={toggleTutorial}
        className="absolute top-6 left-6 w-8 h-8 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all z-20"
        title="Ver Tutorial do Card"
      >
        <HelpCircleIcon />
      </button>

      <div className={`absolute top-6 right-6 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white opacity-100 md:opacity-0 group-hover:opacity-100'}`}>
        {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>

      {/* Seção de Imagem / Placeholder */}
      <div className="mb-6 h-40 w-full rounded-[32px] overflow-hidden bg-slate-100 border border-slate-50 flex items-center justify-center relative shadow-inner">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = ''; 
              (e.target as HTMLImageElement).classList.add('hidden');
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-50 transition-opacity duration-300">
            <div className="p-4 bg-slate-200 rounded-full">
              <PackageIcon />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sem Foto</span>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/5 to-transparent pointer-events-none" />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {isOutOfStock ? (
          <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1"><OutOfStockIcon /> Esgotado</span>
        ) : (
          <>
            {isRed && (
              <span className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-2 animate-pulse shadow-md shadow-red-100">
                <AlertTriangleIcon /> 
                Crítico {product.monthlyConsumption > 0 ? `• ${autonomyDays}d` : ''}
              </span>
            )}
            {isYellow && (
              <span className="bg-amber-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-2 shadow-md shadow-amber-100">
                <AlertTriangleIcon /> 
                Atenção {product.monthlyConsumption > 0 ? `• ${autonomyDays}d` : ''}
              </span>
            )}
          </>
        )}
        {isCostUp && (
          <span className="bg-orange-600 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase flex items-center gap-1.5 animate-pulse shadow-lg shadow-orange-200 border-2 border-orange-400 z-10">
            <TrendingUpIcon /> ALERTA CUSTO
          </span>
        )}
        <span className="text-[9px] font-black text-slate-400 px-3 py-1.5 bg-slate-50 rounded-full uppercase border border-slate-100">COD: {product.code}</span>
      </div>

      <div className="flex items-start gap-3 mb-6">
        <span 
          title={isRed ? 'Crítico' : isYellow ? 'Atenção' : 'Estável'}
          className={`w-3.5 h-3.5 mt-1.5 rounded-full flex-shrink-0 border-2 border-white shadow-sm ring-2 ${
            isRed ? 'bg-red-500 ring-red-100 animate-pulse' : 
            isYellow ? 'bg-amber-400 ring-amber-50' : 
            'bg-emerald-500 ring-emerald-50'
          }`} 
        />
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg md:text-xl leading-tight line-clamp-2">{product.name}</h3>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{product.category}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque Disponível</p>
          <div className="flex items-center gap-1 text-indigo-500"><CalendarIcon /><span className="text-[8px] font-black uppercase">{autonomyDays} dias de autonomia</span></div>
        </div>
        <div className="bg-slate-50 rounded-3xl p-5 flex items-center justify-between group-hover:bg-indigo-50/30 transition-colors duration-300">
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-black tabular-nums tracking-tighter ${isOutOfStock ? 'text-slate-900' : isRed ? 'text-red-600' : 'text-indigo-600'}`}>
                {product.currentStock}
              </span>
              <span className="text-sm font-bold text-slate-400 uppercase">{product.unit}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center bg-white text-slate-400"><PackageIcon /></div>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Valores Unitários</p>
        <div className={`grid grid-cols-2 gap-4 rounded-2xl transition-all ${isCostUp ? 'orange-glow scale-[1.02] p-2' : ''}`}>
          <div title={costTooltip} className="cursor-help">
            <p className={`text-[10px] font-bold uppercase mb-1 ${isCostUp ? 'text-orange-600' : 'text-slate-400'}`}>Custo</p>
            <div className="flex items-center gap-2">
              <p className={`font-black text-lg ${isCostUp ? 'animate-cost-bounce' : 'text-slate-700'}`}>{currencyFormatter.format(product.costPrice)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Venda</p>
            <p className="font-black text-emerald-700 text-lg">{currencyFormatter.format(product.salePrice)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
         <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Análise de Lucratividade</p>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${marginPerc > 30 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              Margem: +{marginPerc}%
            </span>
         </div>
         <div className="px-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 transition-all duration-700 ease-out rounded-full" style={{ width: `${costWidth}%` }} />
              </div>
              <span className="text-[7px] font-black text-slate-400 w-8">CUSTO</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-emerald-50 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-700 ease-out rounded-full shadow-sm" style={{ width: `${saleWidth}%` }} />
              </div>
              <span className="text-[7px] font-black text-emerald-600 w-8">VENDA</span>
            </div>
         </div>
      </div>

      {/* Tutorial Overlay */}
      {showCardTutorial && (
        <div onClick={e => e.stopPropagation()} className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-50 p-6 md:p-8 animate-in fade-in zoom-in duration-300 flex flex-col items-center justify-center text-center">
          <button 
            onClick={() => setShowCardTutorial(false)}
            className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all"
          >
            <XIcon />
          </button>
          
          <div className="space-y-6 max-h-full overflow-y-auto no-scrollbar">
            <div className="bg-indigo-600/20 p-4 rounded-3xl border border-indigo-500/30">
              <h4 className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                <AlertTriangleIcon /> Status e Autonomia
              </h4>
              <p className="text-white text-xs font-medium leading-relaxed">
                As cores indicam o nível crítico. O sistema calcula automaticamente quantos dias o estoque dura baseado no consumo mensal.
              </p>
            </div>

            <div className="bg-emerald-600/20 p-4 rounded-3xl border border-emerald-500/30">
              <h4 className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                <TrendingUpIcon /> Lucratividade
              </h4>
              <p className="text-white text-xs font-medium leading-relaxed">
                O gráfico de barras mostra a proporção entre Custo e Venda. Barras verdes longas significam margens de lucro saudáveis.
              </p>
            </div>

            <div className="bg-amber-600/20 p-4 rounded-3xl border border-amber-500/30">
              <h4 className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                <PlusIcon /> Ações Rápidas
              </h4>
              <p className="text-white text-xs font-medium leading-relaxed">
                Passe o mouse ou segure o card para revelar botões de entrada, saída e edição. Ideal para controle ágil no dia a dia.
              </p>
            </div>

            <button 
              onClick={() => setShowCardTutorial(false)}
              className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {!isSelected && !showCardTutorial && (
        <div onClick={e => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out border-t border-slate-100 shadow-inner rounded-t-[40px] flex flex-col gap-3">
           <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onEntry(product); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-md shadow-emerald-50"><PlusIcon /> Entrada</button>
              <button onClick={(e) => { e.stopPropagation(); onExit(product); }} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-md shadow-slate-200"><MinusIcon /> Consumo</button>
           </div>
           <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onEdit(product); }} className="flex-1 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><EditIcon /> Editar</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(product.id); }} className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center"><TrashIcon /></button>
           </div>
           <button 
             onClick={(e) => { e.stopPropagation(); onReport(product); }} 
             className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase border border-amber-200"
           >
             <FileTextIcon /> Gerar Relatório Detalhado
           </button>
        </div>
      )}
    </div>
  );
});

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalType, setModalType] = useState<ModalMode>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [transactionCost, setTransactionCost] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
    monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0, image: ''
  });
  const [imageError, setImageError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkImportInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setProducts(storageService.getProducts());
    setTransactions(storageService.getTransactions());
    const visited = localStorage.getItem('tutorial_viewed');
    if (!visited) {
      setModalType('tutorial');
    }
  }, []);

  useEffect(() => {
    if (products.length > 0) storageService.saveProducts(products);
  }, [products]);

  useEffect(() => {
    storageService.saveTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }), []);

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
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [products, debouncedSearchTerm, selectedCategory]);

  const stats = useMemo(() => {
    const totalValue = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    const skuValues = products.map(p => ({
      name: p.name,
      totalCost: p.currentStock * p.costPrice
    })).sort((a, b) => b.totalCost - a.totalCost);

    return {
      totalItems: products.reduce((acc, p) => acc + p.currentStock, 0),
      criticalCount: products.filter(p => p.currentStock <= p.minStock).length,
      totalValue,
      totalSaleValue: products.reduce((acc, p) => acc + (p.currentStock * p.salePrice), 0),
      uniqueItemsCount: products.length,
      topSkuValues: skuValues.slice(0, 10),
      maxSkuValue: skuValues.length > 0 ? skuValues[0].totalCost : 0
    };
  }, [products]);

  const closeModal = () => {
    if (modalType === 'tutorial') {
      localStorage.setItem('tutorial_viewed', 'true');
    }
    stopCamera();
    setSelectedProduct(null);
    setModalType(null);
    setQuantity(0);
    setTransactionCost(0);
    setNotes('');
    setImageError(null);
    setProductForm({
      name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
      monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0, image: ''
    });
  };

  const showToast = (message: string) => {
    setToast({ message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportAction = (type: 'pdf' | 'excel' | 'dashboard') => {
    if (type === 'pdf') {
      showToast('Exportando PDF do Inventário...');
      exportService.exportToPDF(processedProducts);
    } else if (type === 'excel') {
      showToast('Gerando Planilha Excel Completa...');
      exportService.exportToExcel(products, transactions);
    } else if (type === 'dashboard') {
      showToast('Gerando Resumo Executivo em PDF...');
      exportService.exportDashboardPDF(stats);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast('Processando arquivo de importação...');
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          showToast('Erro: O arquivo está vazio.');
          return;
        }

        let updatedCount = 0;
        let addedCount = 0;
        const timestamp = new Date().toISOString();

        const nextProducts = [...products];

        data.forEach(row => {
          const code = String(row['Código'] || row['code'] || '').trim();
          if (!code) return;

          const existingIndex = nextProducts.findIndex(p => p.code === code);
          
          const productData: Partial<Product> = {
            code: code,
            name: String(row['Matéria Prima'] || row['name'] || 'Material Importado'),
            category: String(row['Categoria'] || row['category'] || 'Geral'),
            unit: String(row['Unidade'] || row['unit'] || 'KG'),
            currentStock: Number(row['Estoque Atual'] || row['currentStock'] || 0),
            minStock: Number(row['Estoque Mínimo'] || row['minStock'] || 0),
            safetyStock: Number(row['Estoque de Segurança'] || row['safetyStock'] || 0),
            monthlyConsumption: Number(row['Consumo Mensal'] || row['monthlyConsumption'] || 0),
            costPrice: Number(row['Custo Unitário'] || row['costPrice'] || 0),
            salePrice: Number(row['Preço de Venda'] || row['salePrice'] || 0),
            image: String(row['Imagem'] || row['image'] || ''),
          };

          if (existingIndex > -1) {
            const oldP = nextProducts[existingIndex];
            const costChanged = productData.costPrice !== oldP.costPrice;
            nextProducts[existingIndex] = {
              ...oldP,
              ...productData,
              previousCostPrice: costChanged ? oldP.costPrice : oldP.previousCostPrice,
              costHistory: costChanged 
                ? [{ price: productData.costPrice!, date: timestamp }, ...(oldP.costHistory || [])].slice(0, 5)
                : oldP.costHistory
            };
            updatedCount++;
          } else {
            const newP: Product = {
              id: crypto.randomUUID(),
              ...productData as any,
              previousStock: productData.currentStock || 0,
              previousCostPrice: productData.costPrice || 0,
              costHistory: [{ price: productData.costPrice || 0, date: timestamp }]
            };
            nextProducts.push(newP);
            addedCount++;
          }
        });

        setProducts(nextProducts);
        showToast(`Importação concluída: ${addedCount} novos, ${updatedCount} atualizados.`);
      } catch (err) {
        console.error(err);
        showToast('Erro ao processar o arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setImageError(null);
    } catch (err) {
      showToast('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProductForm({ ...productForm, image: dataUrl });
        stopCamera();
        showToast('Foto capturada!');
      }
    }
  };

  const handleDeleteProduct = useCallback((id: string) => {
    if (confirm('Tem certeza que deseja excluir este item permanentemente?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('Produto removido com sucesso.');
    }
  }, []);

  const handleBulkDelete = () => {
    if (confirm(`Tem certeza que deseja excluir permanentemente os ${selectedIds.size} itens selecionados?`)) {
      const idsToRemove = new Set(selectedIds);
      setProducts(prev => prev.filter(p => !idsToRemove.has(p.id)));
      setSelectedIds(new Set());
      setShowBulkMenu(false);
      showToast(`${idsToRemove.size} itens removidos com sucesso.`);
    }
  };

  const handleBulkClearStock = () => {
    if (confirm(`Deseja zerar o estoque de ${selectedIds.size} itens selecionados?`)) {
      setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, currentStock: 0 } : p));
      setSelectedIds(new Set());
      setShowBulkMenu(false);
      showToast(`Estoque de ${selectedIds.size} itens zerado.`);
    }
  };

  const handleTransaction = () => {
    if (!selectedProduct || quantity <= 0) return;
    const timestamp = new Date().toISOString();
    
    const newTransactions: Transaction[] = [{
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: modalType as TransactionType,
      quantity,
      unitCost: transactionCost,
      date: timestamp,
      notes: modalType !== TransactionType.EXIT && transactionCost !== selectedProduct.costPrice 
        ? `${notes ? notes + ' | ' : ''}Preço atualizado para ${currencyFormatter.format(transactionCost)}`
        : notes
    }, ...transactions];

    const updatedProducts = products.map(p => {
      if (p.id !== selectedProduct.id) return p;
      let newStock = p.currentStock;
      if (modalType === TransactionType.ENTRY) newStock += quantity;
      if (modalType === TransactionType.EXIT) newStock -= quantity;
      if (modalType === TransactionType.ADJUSTMENT) newStock = quantity;
      
      const newCostPrice = (modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) 
        ? transactionCost : p.costPrice;
      
      const costChanged = newCostPrice !== p.costPrice;
      return { 
        ...p, 
        previousStock: p.currentStock,
        currentStock: Math.max(0, newStock), 
        costPrice: newCostPrice,
        previousCostPrice: costChanged ? p.costPrice : p.previousCostPrice,
        costHistory: costChanged || !p.costHistory?.length 
          ? [{ price: newCostPrice, date: timestamp }, ...(p.costHistory || [])].slice(0, 5)
          : p.costHistory
      };
    });

    setTransactions(newTransactions);
    setProducts(updatedProducts);
    closeModal();
  };

  const validateImageUrl = (url: string | undefined): boolean => {
    if (!url) return true;
    if (url.startsWith('data:')) return true; 
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.category) return;
    
    if (productForm.image && !validateImageUrl(productForm.image)) {
      setImageError('Por favor, insira uma URL válida (ex: https://...)');
      return;
    }

    const timestamp = new Date().toISOString();

    if (modalType === 'edit' && selectedProduct) {
      const updated = products.map(p => {
        if (p.id !== selectedProduct.id) return p;
        const costChanged = productForm.costPrice !== undefined && productForm.costPrice !== p.costPrice;
        return { 
          ...p, 
          ...productForm, 
          previousCostPrice: costChanged ? p.costPrice : p.previousCostPrice,
          costHistory: costChanged 
            ? [{ price: productForm.costPrice!, date: timestamp }, ...(p.costHistory || [])].slice(0, 5)
            : p.costHistory
        } as Product;
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
        image: productForm.image || '',
        previousCostPrice: Number(productForm.costPrice) || 0,
        costHistory: [{ price: Number(productForm.costPrice) || 0, date: timestamp }]
      };
      setProducts([product, ...products]);
    }
    showToast(`Produto ${modalType === 'edit' ? 'atualizado' : 'cadastrado'} com sucesso!`);
    closeModal();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setImageError('O arquivo deve ser uma imagem válida (PNG, JPG, etc).');
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) { 
        setImageError('A imagem é muito grande. Máximo permitido: 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm({ ...productForm, image: reader.result as string });
      };
      reader.onerror = () => {
        setImageError('Erro ao ler o arquivo. Tente novamente.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleEntryAction = useCallback((product: Product) => {
    setSelectedProduct(product);
    setModalType(TransactionType.ENTRY);
    setTransactionCost(product.costPrice);
  }, []);

  const handleExitAction = useCallback((product: Product) => {
    setSelectedProduct(product);
    setModalType(TransactionType.EXIT);
    setTransactionCost(product.costPrice);
  }, []);

  const handleEditAction = useCallback((product: Product) => {
    setSelectedProduct(product);
    setProductForm({ ...product });
    setModalType('edit');
  }, []);

  const handleReportAction = useCallback((product: Product) => {
    const productTransactions = transactions.filter(t => t.productId === product.id);
    showToast(`Gerando relatório de ${product.name}...`);
    exportService.exportSingleProductPDF(product, productTransactions);
  }, [transactions]);

  const renderInventoryView = () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 pb-32">
      {processedProducts.length > 0 ? processedProducts.map(product => (
        <ProductCard 
          key={product.id}
          product={product}
          isSelected={selectedIds.has(product.id)}
          currencyFormatter={currencyFormatter}
          onToggleSelect={handleToggleSelect}
          onEntry={handleEntryAction}
          onExit={handleExitAction}
          onEdit={handleEditAction}
          onDelete={handleDeleteProduct}
          onReport={handleReportAction}
        />
      )) : (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold text-lg">Nenhum material encontrado.</div>
      )}
    </div>
  );

  const renderHistoryView = () => (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
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
  );

  const renderStatsView = () => (
    <div className="flex flex-col gap-10 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Custo Estoque</p>
          <h4 className="text-3xl font-black text-indigo-600">{currencyFormatter.format(stats.totalValue)}</h4>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Estimado Venda</p>
          <h4 className="text-3xl font-black text-emerald-600">{currencyFormatter.format(stats.totalSaleValue)}</h4>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Itens Críticos</p>
          <h4 className="text-3xl font-black text-red-600">{stats.criticalCount}</h4>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total SKUs</p>
          <h4 className="text-3xl font-black text-slate-800">{stats.uniqueItemsCount}</h4>
        </div>
      </div>

      <div className="bg-white rounded-[48px] p-8 md:p-12 border border-slate-100">
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-10">Custo Total por SKU (Top 10)</h2>
        <div className="space-y-6">
          {stats.topSkuValues.map((sku, idx) => {
            const perc = stats.maxSkuValue > 0 ? (sku.totalCost / stats.maxSkuValue) * 100 : 0;
            return (
              <div key={idx} className="group flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs md:text-sm font-black text-slate-700">{sku.name}</span>
                  <span className="text-xs md:text-sm font-black text-indigo-600">{currencyFormatter.format(sku.totalCost)}</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 origin-left" style={{ width: `${perc}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTutorialModal = () => {
    if (modalType !== 'tutorial') return null;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
        <div className="bg-white rounded-[48px] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in duration-500 no-scrollbar">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
              <PackageIcon />
            </div>
            <h2 className="text-3xl font-black tracking-tighter text-slate-800 uppercase">Bem-vindo ao EstoqueMaster</h2>
            <p className="text-slate-400 font-bold mt-2">Aprenda a dominar seu controle de matéria prima em 1 minuto.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">1</div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Gestão Visual</h4>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">Cada item possui um <b>indicador sutil</b> de cor: <span className="text-emerald-500">Verde (Saudável)</span>, <span className="text-amber-500">Amarelo (Atenção)</span> e <span className="text-red-500">Vermelho (Crítico)</span>.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">2</div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Movimentações</h4>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">Passe o mouse ou toque no card para revelar botões de <b>Entrada</b> e <b>Consumo</b>. O sistema recalcula custos e estoque instantaneamente.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black">3</div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Análise de Margem</h4>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">Confira o <b>gráfico de barras</b> em cada card para comparar Custo vs Venda e visualizar sua margem de lucro em tempo real.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black">4</div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">Dashboard & PDF</h4>
              </div>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">No <b>Painel</b>, veja gráficos de capital imobilizado e exporte relatórios executivos em <b>PDF ou Excel</b> para sua gestão.</p>
            </div>
          </div>

          <button onClick={closeModal} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[32px] shadow-2xl active:scale-95 transition-all text-lg mt-12 uppercase tracking-tighter">Entendi, Vamos Começar!</button>
        </div>
      </div>
    );
  };

  const renderTransactionModal = () => {
    if (!selectedProduct || !modalType || !['ENTRADA', 'SAÍDA', 'AJUSTE'].includes(modalType)) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
         <div className="bg-white rounded-[48px] w-full max-w-md p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tighter text-slate-800">{modalType}: <span className="text-indigo-600">{selectedProduct.name}</span></h2>
            <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Quantidade ({selectedProduct.unit})</label>
                  <input type="number" autoFocus inputMode="decimal" value={quantity || ''} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-slate-100 p-5 rounded-3xl text-3xl font-black text-indigo-600 outline-none" />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Observações / Motivo</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Ex: Lote produção #402, descarte por vencimento, etc."
                    className="w-full bg-slate-100 p-5 rounded-3xl text-sm font-bold text-slate-700 outline-none min-h-[100px] resize-none"
                  />
                </div>

                {(modalType === TransactionType.ENTRY || modalType === TransactionType.ADJUSTMENT) && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário (R$)</label>
                    <input type="number" step="0.01" inputMode="decimal" value={transactionCost || ''} onChange={(e) => setTransactionCost(parseFloat(e.target.value) || 0)} className="w-full bg-slate-100 p-5 rounded-3xl text-2xl font-black text-amber-600 outline-none" />
                  </div>
                )}
                
                <div className="flex gap-4 pt-2">
                  <button onClick={closeModal} className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-[24px]">Voltar</button>
                  <button onClick={handleTransaction} disabled={quantity <= 0} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-[24px] disabled:opacity-50">Confirmar</button>
                </div>
            </div>
         </div>
      </div>
    );
  };

  const renderProductFormModal = () => {
    if (modalType !== 'add' && modalType !== 'edit') return null;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 pt-safe">
        <div className="bg-white rounded-[48px] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
          <div className="flex items-center gap-4 mb-10">
            <button onClick={closeModal} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-all"><ArrowLeftIcon /></button>
            <h2 className="text-3xl font-black tracking-tighter text-slate-800">{modalType === 'edit' ? 'Editar Material' : 'Novo Material'}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Descritivo</label>
              <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" />
            </div>

            {/* Gerenciamento de Imagem com Capture API */}
            <div className="sm:col-span-2 space-y-4">
              <label className="text-[10px] font-black text-indigo-600 uppercase block">Imagem do Produto (Segura)</label>
              
              <div className={`flex flex-col md:flex-row gap-6 items-center bg-slate-50 p-6 rounded-[32px] border-2 transition-colors ${imageError ? 'border-red-200' : 'border-slate-100'}`}>
                <div className="w-32 h-32 bg-slate-200 rounded-[24px] overflow-hidden flex-shrink-0 shadow-inner flex items-center justify-center relative">
                  {isCameraActive ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover rounded-[24px]" 
                    />
                  ) : productForm.image ? (
                    <img src={productForm.image} alt="Preview" className="w-full h-full object-cover" onError={() => setImageError('Falha ao carregar a imagem.')} />
                  ) : (
                    <PackageIcon />
                  )}
                  {isCameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-full h-full border-4 border-white/50 border-dashed rounded-[24px] pointer-events-none" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap gap-2">
                    {isCameraActive ? (
                      <>
                        <button 
                          onClick={capturePhoto} 
                          className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                        >
                          <CameraIcon /> Capturar Agora
                        </button>
                        <button 
                          onClick={stopCamera} 
                          className="bg-slate-200 text-slate-600 p-3 rounded-2xl hover:bg-slate-300 transition-all"
                        >
                          <XIcon />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className="flex-1 bg-white border-2 border-indigo-100 text-indigo-600 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                          <PlusIcon /> Arquivo (Max 2MB)
                        </button>
                        <button 
                          onClick={startCamera} 
                          className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                          <CameraIcon /> Tirar Foto
                        </button>
                        {productForm.image && (
                          <button 
                            onClick={() => { setProductForm({ ...productForm, image: '' }); setImageError(null); }}
                            className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                  {!isCameraActive && (
                    <div className="relative">
                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Ou link externo válido</label>
                      <input 
                        type="text" 
                        placeholder="https://exemplo.com/imagem.png" 
                        value={productForm.image?.startsWith('data:') ? '' : (productForm.image || '')} 
                        onChange={e => {
                          setImageError(null);
                          setProductForm({...productForm, image: e.target.value});
                        }} 
                        className={`w-full bg-white p-4 rounded-2xl text-[10px] font-bold outline-none border transition-all ${imageError ? 'border-red-500 ring-2 ring-red-50' : 'border-slate-200 focus:border-indigo-400'}`} 
                      />
                    </div>
                  )}
                  {imageError && (
                    <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 animate-in slide-in-from-top-1">
                      <AlertTriangleIcon /> {imageError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Código</label><input type="text" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Categoria</label><input type="text" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Unidade</label><input type="text" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo (R$)</label><input type="number" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-black text-indigo-600 outline-none" /></div>
            <div><label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block">Venda (R$)</label><input type="number" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm, salePrice: parseFloat(e.target.value)})} className="w-full bg-emerald-50 p-5 rounded-3xl font-black text-emerald-700 outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Estoque Mínimo</label><input type="number" value={productForm.minStock} onChange={e => setProductForm({...productForm, minStock: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Consumo Mensal</label><input type="number" value={productForm.monthlyConsumption} onChange={e => setProductForm({...productForm, monthlyConsumption: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
          </div>
          <div className="flex flex-col gap-4 mt-12">
            <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[32px] shadow-2xl active:scale-95 transition-all text-lg disabled:opacity-50" disabled={!!imageError || isCameraActive}>Salvar Alterações</button>
            <button onClick={closeModal} className="w-full text-slate-400 font-bold py-4">Cancelar e Sair</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64 bg-slate-50/50 text-slate-900 transition-all duration-500">
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex justify-around p-3 pb-safe z-40 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-screen md:flex-col md:justify-start md:p-6 md:border-r md:border-t-0 shadow-2xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-10 text-indigo-600 font-bold text-xl px-2">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-100"><PackageIcon /></div>
          <span>EstoqueMaster</span>
        </div>
        <div className="flex w-full justify-around md:flex-col md:gap-3">
          {(['inventory', 'history', 'stats'] as View[]).map(view => (
            <button key={view} onClick={() => setCurrentView(view)} 
              className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-2xl transition-all ${currentView === view ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {view === 'inventory' ? <PackageIcon /> : view === 'history' ? <HistoryIcon /> : <StatsIcon />}
              <span className="text-[10px] md:text-base capitalize">{view === 'inventory' ? 'Estoque' : view === 'history' ? 'Histórico' : 'Painel'}</span>
            </button>
          ))}
        </div>
      </nav>

      <header className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 pt-safe z-30 flex flex-col md:flex-row justify-between items-center gap-4 md:px-8 md:py-6 shadow-sm">
        <h1 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">
          {currentView === 'inventory' ? 'Inventário' : currentView === 'history' ? 'Histórico' : 'Painel de Controle'}
        </h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
          {currentView === 'inventory' && (
            <>
              <div className="relative flex-1 md:w-64">
                <input type="text" placeholder="Buscar material..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-100 border-none rounded-2xl py-2.5 px-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <CategoryFilter categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
              
              <button 
                onClick={() => bulkImportInputRef.current?.click()} 
                className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-emerald-100 flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <UploadIcon /> 
                <span className="hidden lg:inline">Importar Massa</span>
              </button>
              <input 
                type="file" 
                ref={bulkImportInputRef} 
                onChange={handleBulkImport} 
                className="hidden" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              />

              <button 
                onClick={() => handleExportAction('pdf')} 
                className="bg-white text-red-600 border border-red-100 px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-red-50 flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <FileTextIcon /> 
                <span className="hidden sm:inline">Exportar PDF</span>
              </button>
              <button onClick={() => setModalType('add')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg transition-all active:scale-95"><PlusIcon /> <span className="hidden sm:inline">Novo</span></button>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => handleExportAction('excel')} className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg transition-all active:scale-95"><DownloadIcon /></button>
            <button onClick={() => handleExportAction(currentView === 'stats' ? 'dashboard' : 'pdf')} className="p-2.5 bg-red-600 text-white rounded-2xl shadow-lg transition-all active:scale-95"><FileTextIcon /></button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-140px)]">
        {currentView === 'inventory' ? renderInventoryView() : currentView === 'history' ? renderHistoryView() : renderStatsView()}

        {selectedIds.size > 0 && currentView === 'inventory' && (
          <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-[calc(50%+128px)] md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[40px] shadow-2xl z-50 flex items-center justify-between gap-6 animate-in slide-in-from-bottom-10">
             <span className="text-sm font-black text-indigo-400 uppercase">{selectedIds.size} itens selecionados</span>
             <div className="relative">
                <button onClick={() => setShowBulkMenu(!showBulkMenu)} className="bg-indigo-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/50">Ações em Massa</button>
                {showBulkMenu && (
                  <div className="absolute bottom-full right-0 mb-4 w-52 bg-slate-800 rounded-[32px] overflow-hidden shadow-2xl border border-slate-700">
                    <button onClick={handleBulkClearStock} className="w-full p-4 text-left hover:bg-white/10 border-b border-white/5 text-[10px] font-black uppercase transition-colors">Zerar Estoque Selecionado</button>
                    <button onClick={handleBulkDelete} className="w-full p-4 text-left hover:bg-red-600 text-[10px] font-black uppercase transition-colors text-red-400 hover:text-white">Excluir Itens Selecionados</button>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Toast Notification for Exports & Actions */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider">{toast.message}</span>
          </div>
        </div>
      )}

      {renderTransactionModal()}
      {renderProductFormModal()}
      {renderTutorialModal()}
    </div>
  );
};

export default App;