
import { Product, Transaction } from '../types.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportService = {
  exportToExcel: (products: Product[], transactions: Transaction[], startDate?: string, endDate?: string) => {
    const currencyFormatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const inventoryData = products.map(p => {
      const valorTotalCusto = p.currentStock * p.costPrice;
      const autonomiaDias = p.monthlyConsumption > 0 
        ? Math.round((p.currentStock / p.monthlyConsumption) * 30) 
        : (p.currentStock > 0 ? 'ILIMITADA' : 0);

      let status = 'NORMAL';
      if (p.currentStock <= 0) status = 'ESGOTADO';
      else if (p.currentStock <= p.minStock) status = 'CRÍTICO';
      else if (p.currentStock <= p.safetyStock) status = 'ATENÇÃO';

      return {
        'Status': status,
        'Código': p.code,
        'Produto': p.name,
        'Tipo': p.type === 'RAW_MATERIAL' ? 'MATÉRIA PRIMA' : 'PRODUTO ACABADO',
        'Categoria': p.category,
        'Estoque Atual': p.currentStock,
        'Unidade': p.unit,
        'Estoque Mínimo': p.minStock,
        'Custo Unitário': currencyFormatter.format(p.costPrice),
        'Valor Total (Custo)': currencyFormatter.format(valorTotalCusto),
        'Autonomia (Dias)': autonomiaDias
      };
    });

    const filteredTransactions = transactions.filter(t => {
      const transDate = new Date(t.date);
      const isAfterStart = !startDate || transDate >= new Date(startDate + 'T00:00:00');
      const isBeforeEnd = !endDate || transDate <= new Date(endDate + 'T23:59:59');
      return isAfterStart && isBeforeEnd;
    });

    const movementData = filteredTransactions.map(t => ({
      'Data': new Date(t.date).toLocaleString(),
      'Produto': t.productName,
      'Tipo de Operação': t.type,
      'Quantidade': t.quantity,
      'Custo Unit. na Data': t.unitCost ? currencyFormatter.format(t.unitCost) : '-',
      'Operador': t.userName,
      'Observações': t.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
    XLSX.utils.book_append_sheet(wb, wsInventory, "Inventário Geral");

    const wsMovement = XLSX.utils.json_to_sheet(movementData);
    if (startDate || endDate) {
      const periodRange = `Período: ${startDate || 'Início'} até ${endDate || 'Hoje'}`;
      XLSX.utils.sheet_add_aoa(wsMovement, [[periodRange]], { origin: -1 });
    }
    XLSX.utils.book_append_sheet(wb, wsMovement, "Histórico Período");

    const wscols = [{wch: 15}, {wch: 10}, {wch: 35}, {wch: 20}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 18}, {wch: 15}];
    wsInventory['!cols'] = wscols;
    wsMovement['!cols'] = [{wch: 20}, {wch: 35}, {wch: 15}, {wch: 12}, {wch: 15}, {wch: 20}, {wch: 30}];

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Relatorio_EstoqueMaster_${dateStr}.xlsx`);
  },

  exportFullInventoryPDF: (products: Product[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const cf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateStr = new Date().toLocaleString('pt-BR');

    // Cabeçalho Profissional
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTOQUE MASTER', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Inventário Consolidado', 14, 28);
    doc.text(`Gerado em: ${dateStr}`, 145, 28);

    const typeLabel = products[0]?.type === 'RAW_MATERIAL' ? 'MATÉRIA PRIMA' : 'PRODUTOS ACABADOS';
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(14);
    doc.text(`TIPO DE RELATÓRIO: ${typeLabel}`, 14, 45);

    // Tabela de Dados
    autoTable(doc, {
      startY: 52,
      head: [['Código', 'Produto', 'Categoria', 'Saldo', 'Mínimo', 'Custo Tot.']],
      body: products.map(p => [
        p.code,
        p.name,
        p.category,
        `${p.currentStock} ${p.unit}`,
        `${p.minStock} ${p.unit}`,
        cf.format(p.currentStock * p.costPrice)
      ]),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
      didDrawCell: (data) => {
        // Colorir linha se estiver abaixo do mínimo
        if (data.section === 'body' && data.column.index === 3) {
           const row = products[data.row.index];
           if (row.currentStock <= row.minStock) {
              doc.setTextColor(220, 38, 38);
              doc.setFont('helvetica', 'bold');
           }
        }
      }
    });

    // Rodapé com Totais
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalValue = products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 20, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Valor Total em Estoque: ${cf.format(totalValue)}`, 20, finalY + 13);
    doc.text(`Total de Itens Listados: ${products.length}`, 130, finalY + 13);

    doc.save(`Inventario_${typeLabel.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  exportSingleProductPDF: (product: Product, transactions: Transaction[]) => {
    const doc = new jsPDF();
    const cf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTOQUE MASTER', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Relatório Individual de Produto - Gerado em ${new Date().toLocaleString()}`, 14, 28);

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(16);
    doc.text(product.name, 14, 55);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`CÓDIGO: ${product.code} | EAN: ${product.ean || 'N/A'} | DUN: ${product.dun || 'N/A'}`, 14, 62);

    autoTable(doc, {
      startY: 70,
      head: [['Informação Técnica', 'Valor']],
      body: [
        ['Tipo de Produto', product.type === 'RAW_MATERIAL' ? 'Matéria Prima' : 'Produto Acabado'],
        ['Categoria', product.category],
        ['Unidade de Medida', product.unit],
        ['Consumo Médio Mensal', `${product.monthlyConsumption} ${product.unit}`],
        ['Estoque de Segurança', `${product.safetyStock} ${product.unit}`],
        ['Estoque Mínimo (Ponto de Pedido)', `${product.minStock} ${product.unit}`],
        ['Custo Unitário Atual', cf.format(product.costPrice)],
        ['Preço de Venda Sugerido', cf.format(product.salePrice)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('Situação de Inventário', 14, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Métrica de Saldo', 'Quantidade', 'Valor Total (Custo)']],
      body: [
        [
          'Saldo Atual em Loja', 
          `${product.currentStock} ${product.unit}`, 
          cf.format(product.currentStock * product.costPrice)
        ],
        [
          'Autonomia Estimada', 
          product.monthlyConsumption > 0 ? `${Math.round((product.currentStock / product.monthlyConsumption) * 30)} dias` : 'Ilimitada', 
          '-'
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    const historyY = (doc as any).lastAutoTable.finalY + 15;
    if (transactions.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229);
      doc.text('Últimas Movimentações', 14, historyY);

      autoTable(doc, {
        startY: historyY + 5,
        head: [['Data', 'Tipo', 'Qtd', 'Operador', 'Custo Un.']],
        body: transactions.slice(0, 15).map(t => [
          new Date(t.date).toLocaleDateString(),
          t.type,
          t.quantity,
          t.userName,
          t.unitCost ? cf.format(t.unitCost) : '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50] },
        styles: { fontSize: 8 }
      });
    }

    const fileName = `Ficha_Tecnica_${product.code}_${product.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  }
};
