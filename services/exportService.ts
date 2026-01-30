
import { Product, Transaction } from '../types.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportService = {
  exportToExcel: (products: Product[], transactions: Transaction[]) => {
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const inventoryData = products.map(p => {
      const valorTotalCusto = p.currentStock * p.costPrice;
      const valorTotalVenda = p.currentStock * p.salePrice;
      const autonomiaDias = p.monthlyConsumption > 0 
        ? Math.round((p.currentStock / p.monthlyConsumption) * 30) 
        : (p.currentStock > 0 ? 'ILIMITADA' : 0);

      let status = 'NORMAL';
      if (p.currentStock <= 0) status = '!!! ESGOTADO !!!';
      else if (p.currentStock <= p.minStock) status = '!! CRÍTICO !!';
      else if (p.currentStock <= p.safetyStock) status = '! ATENÇÃO !';

      return {
        'Status': status,
        'Código': p.code,
        'EAN': p.ean || '-',
        'DUN': p.dun || '-',
        'Produto': p.name,
        'Tipo': p.type === 'RAW_MATERIAL' ? 'MATÉRIA PRIMA' : 'PRODUTO ACABADO',
        'Categoria': p.category,
        'Unidade': p.unit,
        'Estoque Atual': p.currentStock,
        'Estoque Mínimo': p.minStock,
        'Estoque de Segurança': p.safetyStock,
        'Consumo Mensal': p.monthlyConsumption,
        'Custo Unitário': currencyFormatter.format(p.costPrice),
        'Preço Venda': currencyFormatter.format(p.salePrice),
        'Valor Total em Estoque (Custo)': currencyFormatter.format(valorTotalCusto),
        'Valor Total em Estoque (Venda)': currencyFormatter.format(valorTotalVenda),
        'Autonomia em Dias': autonomiaDias
      };
    });

    // Linha de Totais
    const totalEstoque = products.reduce((acc, p) => acc + p.currentStock, 0);
    const totalCustoGlobal = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    const totalVendaGlobal = products.reduce((acc, p) => acc + (p.currentStock * p.salePrice), 0);

    inventoryData.push({
      'Status': 'RESUMO GERAL',
      'Código': 'TOTAIS',
      'EAN': '',
      'DUN': '',
      'Produto': '',
      'Tipo': '',
      'Categoria': '',
      'Unidade': '',
      'Estoque Atual': totalEstoque,
      'Estoque Mínimo': '',
      'Estoque de Segurança': '',
      'Consumo Mensal': '',
      'Custo Unitário': '',
      'Preço Venda': '',
      'Valor Total em Estoque (Custo)': currencyFormatter.format(totalCustoGlobal),
      'Valor Total em Estoque (Venda)': currencyFormatter.format(totalVendaGlobal),
      'Autonomia em Dias': ''
    } as any);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(inventoryData);

    // Ajuste de largura das colunas para melhor visualização
    const wscols = [
      {wch: 15}, // Status
      {wch: 10}, // Código
      {wch: 15}, // EAN
      {wch: 15}, // DUN
      {wch: 35}, // Produto
      {wch: 20}, // Tipo
      {wch: 20}, // Categoria
      {wch: 10}, // Unidade
      {wch: 15}, // Estoque Atual
      {wch: 15}, // Estoque Mínimo
      {wch: 20}, // Estoque de Segurança
      {wch: 18}, // Consumo Mensal
      {wch: 18}, // Custo Unitário
      {wch: 18}, // Preço Venda
      {wch: 30}, // Valor Total em Estoque (Custo)
      {wch: 30}, // Valor Total em Estoque (Venda)
      {wch: 20}, // Autonomia em Dias
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Inventário Detalhado");
    XLSX.writeFile(wb, `Inventario_Completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  exportSingleProductPDF: (product: Product, transactions: Transaction[]) => {
    const doc = new jsPDF();
    const cf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229);
    doc.text(`Ficha de Produto: ${product.name}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`EAN: ${product.ean || 'N/A'} | DUN: ${product.dun || 'N/A'}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Métrica', 'Valor']],
      body: [
        ['Código', product.code],
        ['Tipo', product.type === 'RAW_MATERIAL' ? 'Matéria Prima' : 'Produto Acabado'],
        ['Categoria', product.category],
        ['Saldo Atual', `${product.currentStock} ${product.unit}`],
        ['Estoque Mínimo', `${product.minStock} ${product.unit}`],
        ['Estoque de Segurança', `${product.safetyStock} ${product.unit}`],
        ['Consumo Mensal', `${product.monthlyConsumption} ${product.unit}`],
        ['Custo Unitário', cf.format(product.costPrice)],
        ['Preço de Venda', cf.format(product.salePrice)],
        ['Total em Custo', cf.format(product.currentStock * product.costPrice)],
        ['Total em Venda', cf.format(product.currentStock * product.salePrice)],
        ['Autonomia', product.monthlyConsumption > 0 ? `${Math.round((product.currentStock / product.monthlyConsumption) * 30)} dias` : 'Ilimitada']
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    const fileName = `Ficha_${product.code}_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  }
};
