
import { Product, Transaction } from '../types.ts';
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
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    // Processamento dos dados do Inventário com as colunas solicitadas
    const inventoryData = products.map(p => {
      const valorTotalCusto = p.currentStock * p.costPrice;
      const valorTotalVenda = p.currentStock * p.salePrice;
      
      // Cálculo de autonomia: (Estoque Atual / Consumo Mensal) * 30 dias
      const autonomiaDias = p.monthlyConsumption > 0 
        ? Math.floor((p.currentStock / p.monthlyConsumption) * 30) 
        : 0;
      
      // Definição de Status Visual com Emojis (Destaque para Crítico/Esgotado)
      let status = '✅ SAUDÁVEL';
      if (p.currentStock === 0) {
        status = '❌ !!! ESGOTADO !!!';
      } else if (p.currentStock <= p.minStock) {
        status = '🚨 !!! CRÍTICO !!!';
      } else if (p.currentStock <= p.safetyStock) {
        status = '⚠️ ATENÇÃO';
      }

      return {
        'Status': status,
        'Código': p.code,
        'Matéria Prima': p.name,
        'Categoria': p.category,
        'Unidade': p.unit,
        'Estoque Atual': p.currentStock,
        'Estoque Mínimo': p.minStock,
        'Estoque de Segurança': p.safetyStock,
        'Consumo Mensal': p.monthlyConsumption,
        'Custo Unitário': currencyFormatter.format(p.costPrice),
        'Preço de Venda': currencyFormatter.format(p.salePrice),
        'Valor Total em Estoque (Custo)': currencyFormatter.format(valorTotalCusto),
        'Valor Total em Estoque (Venda)': currencyFormatter.format(valorTotalVenda),
        'Autonomia em Dias': p.monthlyConsumption > 0 ? `${autonomiaDias} dias` : 'Indeterminada'
      };
    });

    // Dados do Histórico
    const historyData = transactions.map(t => ({
      'Data': new Date(t.date).toLocaleString('pt-BR'),
      'Tipo': t.type,
      'Produto': t.productName,
      'Quantidade': t.quantity,
      'Custo Un. (R$)': currencyFormatter.format(t.unitCost || 0),
      'Observações': t.notes
    }));

    // Criação do Workbook
    const wb = XLSX.utils.book_new();
    
    // Aba de Inventário
    const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
    
    // Ajuste de largura das colunas para melhor visualização
    const wsInventoryCols = [
      { wch: 20 }, // Status
      { wch: 10 }, // Código
      { wch: 45 }, // Matéria Prima
      { wch: 20 }, // Categoria
      { wch: 10 }, // Unidade
      { wch: 15 }, // Estoque Atual
      { wch: 15 }, // Estoque Mínimo
      { wch: 15 }, // Estoque de Segurança
      { wch: 15 }, // Consumo Mensal
      { wch: 18 }, // Custo Unitário
      { wch: 18 }, // Preço de Venda
      { wch: 28 }, // Valor Total Custo
      { wch: 28 }, // Valor Total Venda
      { wch: 20 }  // Autonomia
    ];
    wsInventory['!cols'] = wsInventoryCols;
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventário Completo");

    // Aba de Histórico
    const wsHistory = XLSX.utils.json_to_sheet(historyData);
    const wsHistoryCols = [
      { wch: 20 }, { wch: 15 }, { wch: 45 }, { wch: 15 }, { wch: 18 }, { wch: 50 }
    ];
    wsHistory['!cols'] = wsHistoryCols;
    XLSX.utils.book_append_sheet(wb, wsHistory, "Histórico");
    
    // Geração do Arquivo
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
  },

  exportDashboardPDF: (stats: any) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const currency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text('Resumo Executivo de Estoque', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    autoTable(doc, {
      startY: 40,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de Capital Imobilizado (Custo)', currency(stats.totalValue)],
        ['Valor Estimado de Venda', currency(stats.totalSaleValue)],
        ['Margem Bruta Estimada', currency(stats.totalSaleValue - stats.totalValue)],
        ['Itens em Status Crítico', stats.criticalCount.toString()],
        ['Total de SKUs Cadastrados', stats.uniqueItemsCount.toString()],
        ['Total de Itens Físicos', stats.totalItems.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Top 10 SKUs por Valor em Estoque', 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Matéria Prima', 'Valor em Estoque']],
      body: stats.topSkuValues.map((sku: any) => [sku.name, currency(sku.totalCost)]),
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] }
    });

    doc.save(`Relatorio_Executivo_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  exportSingleProductPDF: (product: Product, transactions: Transaction[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text(`Relatório Detalhado: ${product.name}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Código: ${product.code} | Categoria: ${product.category} | Unidade: ${product.unit}`, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 33);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Status de Estoque', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Métrica', 'Valor']],
      body: [
        ['Estoque Atual', `${product.currentStock} ${product.unit}`],
        ['Estoque Mínimo', `${product.minStock} ${product.unit}`],
        ['Estoque de Segurança', `${product.safetyStock} ${product.unit}`],
        ['Consumo Médio Mensal', `${product.monthlyConsumption} ${product.unit}`],
        ['Custo Unitário Atual', currencyFormatter.format(product.costPrice)],
        ['Preço de Venda Unitário', currencyFormatter.format(product.salePrice)],
        ['Valor Total em Estoque (Custo)', currencyFormatter.format(product.currentStock * product.costPrice)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.setFontSize(14);
    doc.text('Histórico Recente de Movimentações', 14, (doc as any).lastAutoTable.finalY + 15);

    const historyHeaders = [['Data', 'Tipo', 'Qtd', 'Custo Unit.', 'Notas']];
    const historyBody = transactions.slice(0, 20).map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.type,
      t.quantity,
      currencyFormatter.format(t.unitCost || 0),
      t.notes || '-'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: historyHeaders,
      body: historyBody,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      styles: { fontSize: 8 }
    });

    doc.save(`Relatorio_${product.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }
};
