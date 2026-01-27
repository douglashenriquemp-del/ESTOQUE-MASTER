
import { Product, Transaction } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportService = {
  exportToCSV: (products: Product[]) => {
    const headers = ['COD', 'Produto', 'Categoria', 'Unidade', 'Est. Seguranca', 'Est. Minimo', 'Est. Atual', 'Custo', 'Preco Venda'];
    const rows = products.map(p => [
      p.code,
      p.name,
      p.category,
      p.unit,
      p.safetyStock,
      p.minStock,
      p.currentStock,
      p.costPrice,
      p.salePrice
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows]
      .map(e => e.join(";"))
      .join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estoque_vendas_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  },

  exportToExcel: (products: Product[], transactions: Transaction[]) => {
    // Aba 1: Inventário Atual
    const inventoryData = products.map(p => {
      const valorTotalCusto = p.currentStock * p.costPrice;
      const valorTotalVenda = p.currentStock * p.salePrice;
      const autonomiaDias = p.monthlyConsumption > 0 
        ? Math.floor((p.currentStock / p.monthlyConsumption) * 30) 
        : 'Indeterminada';
      
      let status = 'ESTÁVEL';
      if (p.currentStock === 0) status = '!!! ESGOTADO !!!';
      else if (p.currentStock <= p.minStock) status = '! CRÍTICO !';
      else if (p.currentStock <= p.safetyStock) status = 'ATENÇÃO';

      return {
        'CÓDIGO': p.code,
        'MATÉRIA PRIMA': p.name,
        'CATEGORIA': p.category,
        'UNIDADE': p.unit,
        'ESTOQUE ATUAL': p.currentStock,
        'ESTOQUE MÍNIMO': p.minStock,
        'ESTOQUE SEGURANÇA': p.safetyStock,
        'CONSUMO MENSAL': p.monthlyConsumption,
        'CUSTO UN. (R$)': p.costPrice,
        'VENDA UN. (R$)': p.salePrice,
        'VALOR TOTAL CUSTO (R$)': valorTotalCusto,
        'VALOR TOTAL VENDA (R$)': valorTotalVenda,
        'AUTONOMIA (DIAS)': autonomiaDias,
        'STATUS OPERACIONAL': status
      };
    });

    // Aba 2: Histórico de Transações
    const historyData = transactions.map(t => ({
      'DATA': new Date(t.date).toLocaleString('pt-BR'),
      'TIPO': t.type,
      'PRODUTO': t.productName,
      'QUANTIDADE': t.quantity,
      'CUSTO UN. NO MOMENTO (R$)': t.unitCost || 0,
      'NOTAS/OBSERVAÇÕES': t.notes
    }));

    const wb = XLSX.utils.book_new();

    // Adiciona Aba de Inventário
    const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
    const wsInventoryCols = [
      { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, 
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 20 }
    ];
    wsInventory['!cols'] = wsInventoryCols;
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventário Atual");

    // Adiciona Aba de Transações
    const wsHistory = XLSX.utils.json_to_sheet(historyData);
    const wsHistoryCols = [
      { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 25 }, { wch: 50 }
    ];
    wsHistory['!cols'] = wsHistoryCols;
    XLSX.utils.book_append_sheet(wb, wsHistory, "Histórico de Movimentações");
    
    XLSX.writeFile(wb, `RELATORIO_ESTOQUE_MASTER_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  exportToPDF: (products: Product[]) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const dateStr = new Date().toLocaleString('pt-BR');
    
    doc.setFontSize(18);
    doc.text('Relatório de Inventário e Precificação', 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${dateStr}`, 14, 22);
    
    const tableHeaders = [['COD', 'Produto', 'Categoria', 'UND', 'Atual', 'Custo', 'Venda', 'Total Venda']];
    const tableData = products.map(p => {
      const totalVenda = (p.currentStock * p.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      
      return [
        p.code,
        p.name,
        p.category,
        p.unit,
        p.currentStock,
        p.costPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        p.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        totalVenda
      ];
    });

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 30,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`estoque_precificacao_${new Date().toISOString().split('T')[0]}.pdf`);
  }
};
