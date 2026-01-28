
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Transaction, TransactionType } from './types.ts';
import { storageService } from './services/storageService.ts';
import { exportService } from './services/exportService.ts';
import { 
  PlusIcon, 
  MinusIcon, 
  EditIcon, 
  DownloadIcon, 
  HistoryIcon, 
  PackageIcon,
  AlertTriangleIcon,
  StatsIcon,
  OutOfStockIcon,
  TrendingUpIcon,
  CalendarIcon,
  CopyIcon,
  FileTextIcon,
  ArrowLeftIcon,
  TrashIcon
} from './components/Icons.tsx';

type View = 'inventory' | 'history' | 'stats';
type ModalMode = TransactionType | 'add' | 'edit' | 'bulkAdd' | null;

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
  // --- STATE ---
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
  
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
    monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0
  });

  // --- EFFECTS ---
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
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // --- HELPERS & MEMOS ---
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

  const stats = useMemo(() => ({
    totalItems: products.reduce((acc, p) => acc + p.currentStock, 0),
    criticalCount: products.filter(p => p.currentStock <= p.minStock).length,
    totalValue: products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0),
    totalSaleValue: products.reduce((acc, p) => acc + (p.currentStock * p.salePrice), 0),
    uniqueItemsCount: products.length
  }), [products]);

  // --- HANDLERS ---
  const closeModal = () => {
    setSelectedProduct(null);
    setModalType(null);
    setQuantity(0);
    setTransactionCost(0);
    setNotes('');
    setProductForm({
      name: '', code: '', category: '', unit: 'KG', safetyStock: 0, minStock: 0, 
      monthlyConsumption: 0, currentStock: 0, costPrice: 0, salePrice: 0
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este item permanentemente?')) {
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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
      const updatedHistory = costChanged || !p.costHistory?.length 
        ? [{ price: newCostPrice, date: timestamp }, ...(p.costHistory || [])].slice(0, 5)
        : p.costHistory;

      return { 
        ...p, 
        previousStock: p.currentStock,
        currentStock: Math.max(0, newStock), 
        costPrice: newCostPrice,
        previousCostPrice: costChanged ? p.costPrice : p.previousCostPrice,
        costHistory: updatedHistory
      };
    });

    setTransactions(newTransactions);
    setProducts(updatedProducts);
    closeModal();
  };

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.category) return;
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
        previousCostPrice: Number(productForm.costPrice) || 0,
        costHistory: [{ price: Number(productForm.costPrice) || 0, date: timestamp }]
      };
      setProducts([product, ...products]);
    }
    closeModal();
  };

  // --- RENDER VIEWS ---
  const renderInventoryView = () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 pb-32">
      {processedProducts.length > 0 ? processedProducts.map(product => {
        const isOutOfStock = product.currentStock === 0;
        const isRed = product.currentStock <= product.minStock;
        const isYellow = !isRed && product.currentStock <= (product.minStock * 1.5);
        const isSelected = selectedIds.has(product.id);
        const isCostUp = product.previousCostPrice !== undefined && product.costPrice > product.previousCostPrice;

        return (
          <div 
            key={product.id} 
            onClick={() => {
              const next = new Set(selectedIds);
              if (next.has(product.id)) next.delete(product.id);
              else next.add(product.id);
              setSelectedIds(next);
            }}
            className={`group relative bg-white rounded-[40px] border-2 p-6 md:p-8 shadow-sm transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-indigo-100' : isOutOfStock ? 'border-slate-800' : isRed ? 'border-red-400' : 'border-slate-100 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1'}`}
          >
            {/* CHECKBOX SELECTION */}
            <div className={`absolute top-6 right-6 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white opacity-100 md:opacity-0 group-hover:opacity-100'}`}>
              {isSelected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>

            {/* BADGES */}
            <div className="flex flex-wrap gap-2 mb-4">
              {isOutOfStock ? (
                <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1"><OutOfStockIcon /> Esgotado</span>
              ) : isRed && (
                <span className="bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase flex items-center gap-1 animate-pulse"><AlertTriangleIcon /> Crítico</span>
              )}
              <span className="text-[9px] font-black text-slate-400 px-3 py-1.5 bg-slate-50 rounded-full uppercase border border-slate-100">COD: {product.code}</span>
            </div>

            {/* INDICADOR SUTIL + NOME */}
            <div className="flex items-start gap-2.5 mb-1">
              <span 
                className={`w-2.5 h-2.5 mt-2 rounded-full flex-shrink-0 border border-white shadow-sm transition-all duration-500 ${isRed ? 'bg-red-500 shadow-red-200' : isYellow ? 'bg-amber-400 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200'} ${isOutOfStock ? 'animate-pulse scale-110' : ''}`} 
                title={isRed ? 'Status: Crítico' : isYellow ? 'Status: Atenção' : 'Status: Saudável'}
              />
              <h3 className="font-extrabold text-slate-800 text-lg md:text-xl leading-tight h-14 line-clamp-2 flex-1">{product.name}</h3>
            </div>
            
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 ml-5">{product.category}</p>

            {/* SALDO DE ESTOQUE DESTACADO */}
            <div className="mb-6 bg-slate-50 rounded-3xl p-5 border border-slate-100 flex items-center justify-between group-hover:bg-white transition-colors duration-300">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Atual</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-black tabular-nums tracking-tighter ${isOutOfStock ? 'text-slate-900' : isRed ? 'text-red-600' : 'text-indigo-600'}`}>
                    {product.currentStock}
                  </span>
                  <span className="text-sm font-bold text-slate-400 uppercase">{product.unit}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-slate-100 flex items-center justify-center bg-white shadow-sm text-slate-400"><PackageIcon /></div>
            </div>

            {/* PREÇOS COM ANIMAÇÃO DE BOUNCE */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-5 mb-4">
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

            {/* HISTÓRICO DE CUSTOS (NOVO) */}
            <div className="border-t border-slate-50 pt-4 mb-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Histórico de Custos</p>
              <div className="space-y-1.5">
                {product.costHistory && product.costHistory.length > 0 ? (
                  product.costHistory.slice(0, 3).map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-50/50 px-3 py-1.5 rounded-xl border border-slate-100/50">
                      <span className="font-medium text-slate-400">{new Date(entry.date).toLocaleDateString('pt-BR')}</span>
                      <span className="font-black text-slate-600">{currencyFormatter.format(entry.price)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] italic text-slate-400 text-center py-1">Sem histórico</p>
                )}
              </div>
            </div>

            {/* MENU DE AÇÕES RÁPIDAS (AO HOVER) */}
            {!isSelected && (
              <div onClick={e => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md p-5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out border-t border-slate-100 shadow-inner rounded-t-[40px] flex flex-col gap-3">
                 <div className="flex gap-2">
                    <button onClick={() => { setSelectedProduct(product); setModalType(TransactionType.ENTRY); setTransactionCost(product.costPrice); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-md shadow-emerald-50"><PlusIcon /> Entrada</button>
                    <button onClick={() => { setSelectedProduct(product); setModalType(TransactionType.EXIT); setTransactionCost(product.costPrice); }} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-md shadow-slate-200"><MinusIcon /> Consumo</button>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => { setSelectedProduct(product); setProductForm({ ...product }); setModalType('edit'); }} className="flex-1 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><EditIcon /> Editar</button>
                    <button onClick={(e) => exportService.exportSingleProductPDF(product, transactions.filter(t => t.productId === product.id))} className="flex-1 bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[9px] font-black uppercase"><FileTextIcon /> PDF</button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="bg-red-50 text-red-500 p-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-sm"><TrashIcon /></button>
                 </div>
              </div>
            )}
          </div>
        );
      }) : (
        <div className="col-span-full py-20 text-center text-slate-400 font-bold text-lg">Nenhum material encontrado.</div>
      )}
    </div>
  );

  const renderHistoryView = () => (
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
  );

  const renderStatsView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-indigo-200 transition-all">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Custo Estoque</p>
        <h4 className="text-3xl font-black text-indigo-600 group-hover:scale-105 transition-transform origin-left">{currencyFormatter.format(stats.totalValue)}</h4>
      </div>
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 group hover:border-emerald-200 transition-all">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Estimado Venda</p>
        <h4 className="text-3xl font-black text-emerald-600 group-hover:scale-105 transition-transform origin-left">{currencyFormatter.format(stats.totalSaleValue)}</h4>
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
  );

  // --- RENDER MODALS ---
  const renderTransactionModal = () => {
    if (!selectedProduct || !modalType || !['ENTRADA', 'SAÍDA', 'AJUSTE', 'bulkAdd'].includes(modalType)) return null;
    return (
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
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo Unitário (R$)</label>
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
    );
  };

  const renderProductFormModal = () => {
    if (modalType !== 'add' && modalType !== 'edit') return null;
    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 pt-safe">
        <div className="bg-white rounded-[48px] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in duration-300 no-scrollbar">
          <div className="flex items-center gap-4 mb-10">
            <button onClick={closeModal} className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-all"><ArrowLeftIcon /></button>
            <h2 className="text-3xl font-black tracking-tighter text-slate-800">{modalType === 'edit' ? 'Editar Material' : 'Novo Material'}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nome Descritivo</label><input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Código</label><input type="text" value={productForm.code} onChange={e => setProductForm({...productForm, code: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Categoria</label><input type="text" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Unidade</label><input type="text" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Custo (R$)</label><input type="number" step="0.01" value={productForm.costPrice} onChange={e => setProductForm({...productForm, costPrice: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-black text-indigo-600 outline-none" /></div>
            <div><label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block">Venda (R$)</label><input type="number" step="0.01" value={productForm.salePrice} onChange={e => setProductForm({...productForm, salePrice: parseFloat(e.target.value)})} className="w-full bg-emerald-50 p-5 rounded-3xl font-black text-emerald-700 outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Estoque Mínimo</label><input type="number" value={productForm.minStock} onChange={e => setProductForm({...productForm, minStock: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Consumo Mensal</label><input type="number" value={productForm.monthlyConsumption} onChange={e => setProductForm({...productForm, monthlyConsumption: parseFloat(e.target.value)})} className="w-full bg-slate-100 p-5 rounded-3xl font-bold outline-none" /></div>
          </div>
          <div className="flex flex-col gap-4 mt-12">
            <button onClick={handleSaveProduct} className="w-full bg-indigo-600 text-white font-black py-6 rounded-[32px] shadow-2xl active:scale-95 transition-all text-lg">Salvar Alterações</button>
            <button onClick={closeModal} className="w-full text-slate-400 font-bold py-4 active:scale-95 transition-all">Cancelar e Sair</button>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-64 bg-slate-50/50 text-slate-900 transition-all duration-500">
      {/* SIDEBAR NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex justify-around p-3 pb-safe z-40 md:top-0 md:bottom-auto md:left-0 md:w-64 md:h-screen md:flex-col md:justify-start md:p-6 md:border-r md:border-t-0 shadow-2xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-10 text-indigo-600 font-bold text-xl px-2">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-100"><PackageIcon /></div>
          <span>EstoqueMaster</span>
        </div>
        <div className="flex w-full justify-around md:flex-col md:gap-3">
          {(['inventory', 'history', 'stats'] as View[]).map(view => (
            <button 
              key={view} 
              onClick={() => setCurrentView(view)} 
              className={`flex flex-col md:flex-row items-center gap-2 p-3 rounded-2xl transition-all ${currentView === view ? 'text-indigo-600 md:bg-indigo-50 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {view === 'inventory' ? <PackageIcon /> : view === 'history' ? <HistoryIcon /> : <StatsIcon />}
              <span className="text-[10px] md:text-base capitalize">{view === 'inventory' ? 'Estoque' : view === 'history' ? 'Histórico' : 'Painel'}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* HEADER */}
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
              <button onClick={() => setModalType('add')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg"><PlusIcon /> <span className="hidden sm:inline">Novo</span></button>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => exportService.exportToExcel(products, transactions)} className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-lg"><DownloadIcon /></button>
            {currentView === 'inventory' && <button onClick={() => exportService.exportToPDF(processedProducts)} className="p-2.5 bg-red-600 text-white rounded-2xl shadow-lg"><FileTextIcon /></button>}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-140px)]">
        {currentView === 'inventory' ? renderInventoryView() : currentView === 'history' ? renderHistoryView() : renderStatsView()}

        {/* BULK ACTIONS MENU */}
        {selectedIds.size > 0 && currentView === 'inventory' && (
          <div className="fixed bottom-24 md:bottom-8 left-4 right-4 md:left-[calc(50%+128px)] md:right-auto md:-translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[40px] shadow-2xl z-50 flex items-center justify-between gap-6 animate-in slide-in-from-bottom-10">
             <span className="text-sm font-black text-indigo-400 uppercase">{selectedIds.size} itens selecionados</span>
             <div className="relative">
                <button onClick={() => setShowBulkMenu(!showBulkMenu)} className="bg-indigo-600 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/50">Ações em Massa</button>
                {showBulkMenu && (
                  <div className="absolute bottom-full right-0 mb-4 w-52 bg-slate-800 rounded-[32px] overflow-hidden shadow-2xl border border-slate-700">
                    <button onClick={() => { if(confirm(`Zerar o estoque de ${selectedIds.size} itens?`)) { setProducts(products.map(p => selectedIds.has(p.id) ? { ...p, currentStock: 0 } : p)); setSelectedIds(new Set()); setShowBulkMenu(false); } }} className="w-full p-4 text-left hover:bg-white/10 border-b border-white/5 text-[10px] font-black uppercase transition-colors">Zerar Estoque</button>
                    <button onClick={() => { if(confirm(`Excluir ${selectedIds.size} itens?`)) { setProducts(products.filter(p => !selectedIds.has(p.id))); setSelectedIds(new Set()); setShowBulkMenu(false); } }} className="w-full p-4 text-left hover:bg-red-600 text-[10px] font-black uppercase transition-colors">Excluir Itens</button>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {renderTransactionModal()}
      {renderProductFormModal()}
    </div>
  );
};

export default App;
