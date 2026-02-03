
import { Product } from '../types.ts';

const createFinishedGoodFromPDF = (
  ref: string, 
  name: string, 
  typeEmb: string, 
  ean: string, 
  dun: string, 
  category: string,
  minStock: number = 10
): Product => ({
  id: `FG-${ref}`,
  type: 'FINISHED_GOOD',
  code: ref,
  ean: ean || '',
  dun: dun || '',
  name: name.toUpperCase(),
  category: category,
  unit: typeEmb === 'CX' ? 'CX' : 'FD',
  safetyStock: Math.ceil(minStock * 1.5),
  minStock: minStock,
  monthlyConsumption: minStock * 4,
  currentStock: Math.floor(Math.random() * (minStock * 4)),
  costPrice: 0,
  salePrice: 0,
  previousCostPrice: 0,
  costHistory: []
});

const createRawMaterialFromPDF = (
  cod: string, 
  name: string, 
  unit: string, 
  safety: number, 
  min: number, 
  consumption: number, 
  current: number,
  category: string
): Product => ({
  id: `RM-${cod || Math.random()}`,
  type: 'RAW_MATERIAL',
  code: cod || 'S/N',
  name: name.toUpperCase(),
  category,
  unit,
  safetyStock: safety || 0,
  minStock: min || 0,
  monthlyConsumption: consumption || 0,
  currentStock: current || 0,
  costPrice: 0,
  salePrice: 0,
  previousCostPrice: 0,
  costHistory: []
});

export const INITIAL_PRODUCTS: Product[] = [
  // --- MATÉRIA PRIMA (INSUMOS INDUSTRIAIS - MOLHOS E BASES) ---
  
  // INSUMOS PARA PROCESSAMENTO (Bases Químicas e Espessantes para Molhos)
  createRawMaterialFromPDF('SN-M1', 'AMIDO DE MILHO MODIFICADO 25kg', 'SC', 20, 40, 800, 150, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M2', 'GOMA XANTANA 80 MESH 25kg', 'SC', 5, 10, 50, 12, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M3', 'CORANTE CARAMELO IV (LIQUIDO) 25kg', 'BB', 10, 20, 200, 45, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M4', 'EXTRATO DE MALTE CONCENTRADO 25kg', 'BB', 5, 15, 100, 20, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M5', 'AÇÚCAR CRISTAL INDUSTRIAL 50kg', 'SC', 50, 100, 2000, 450, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M6', 'POLPA DE PIMENTA VERMELHA (FERMENTADA) 180kg', 'BB', 2, 5, 10, 3, 'Insumos para Processamento'),
  createRawMaterialFromPDF('SN-M7', 'PIMENTA MALAGUETA EM SALMOURA 100kg', 'BB', 3, 8, 15, 6, 'Insumos para Processamento'),

  // ESPECIARIAS E CONDIMENTOS
  createRawMaterialFromPDF('34', 'SEMENTE DE URUCUM (LIMPA) SC 50kg', 'SC', 20, 50, 2000, 150, 'Especiarias e Condimentos'),
  createRawMaterialFromPDF('2170', 'AÇAFRÃO RAIZ TIPO A SC 25Kg', 'SC', 10, 20, 500, 45, 'Especiarias e Condimentos'),
  createRawMaterialFromPDF('2097', 'CANELA EM CASCA VIETNAM 25KG', 'CX', 5, 10, 150, 12, 'Especiarias e Condimentos'),
  createRawMaterialFromPDF('S/N-P1', 'PIMENTA DO REINO EM GRÃO SC 25kg', 'SC', 15, 30, 800, 60, 'Especiarias e Condimentos'),
  createRawMaterialFromPDF('S/N-C1', 'COMINHO EM GRÃO SC 25kg', 'SC', 10, 25, 600, 40, 'Especiarias e Condimentos'),

  // QUÍMICOS E CONSERVANTES
  createRawMaterialFromPDF('252', 'ÁCIDO CÍTRICO ANIDRO 25 KG', 'SC', 5, 10, 100, 15, 'Químicos e Conservantes'),
  createRawMaterialFromPDF('1687', 'BENZOATO DE SODIO SC 25 KG', 'SC', 3, 6, 50, 10, 'Químicos e Conservantes'),
  createRawMaterialFromPDF('525', 'BICARBONATO DE SÓDIO GRAU ALIM. 25kg', 'SC', 10, 20, 400, 35, 'Químicos e Conservantes'),
  createRawMaterialFromPDF('S/N-Q1', 'SORBATO DE POTASSIO 25kg', 'SC', 2, 5, 40, 7, 'Químicos e Conservantes'),

  // GRÃOS E CEREAIS
  createRawMaterialFromPDF('1527', 'CANJICA BRANCA (CRUA) SC 25kg', 'SC', 100, 300, 3000, 850, 'Grãos e Cereais'),
  createRawMaterialFromPDF('190', 'ALPISTE LIMPO SC 45,36kg', 'SC', 50, 100, 1500, 420, 'Grãos e Cereais'),
  createRawMaterialFromPDF('S/N-G1', 'MILHO PIPOCA PREMIUM SC 25kg', 'SC', 80, 200, 2500, 600, 'Grãos e Cereais'),

  // ÓLEOS E BASES LÍQUIDAS
  createRawMaterialFromPDF('139', 'AZEITE DE DENDÊ (BRUTO) BB 200L', 'BB', 5, 15, 3000, 10, 'Óleos e Bases Líquidas'),
  createRawMaterialFromPDF('2038', 'KETCHUP BASE INDUSTRIAL 200 L', 'BB', 2, 5, 500, 3, 'Óleos e Bases Líquidas'),
  createRawMaterialFromPDF('S/N-L1', 'VINAGRE DE ÁLCOOL (BULK) 1000L', 'L', 500, 2000, 15000, 5000, 'Óleos e Bases Líquidas'),
  createRawMaterialFromPDF('S/N-L2', 'EXTRATO DE TOMATE CONCENTRADO 20kg', 'BB', 10, 30, 800, 45, 'Óleos e Bases Líquidas'),

  // --- PRODUTOS ACABADOS ---
  createFinishedGoodFromPDF('229', 'ALHO PICADO TAPAJOS FD 30x200g', 'FD', '7897457800191', '17897457800198', 'Alho Picado', 30),
  createFinishedGoodFromPDF('1660', 'MOLHO INGLÊS TAPAJÓS 12x150ml', 'FD', '7897457800627', '17897457800624', 'Molhos', 60),
  createFinishedGoodFromPDF('1666', 'MOLHO SHOYU TAPAJÓS 12x150ml', 'FD', '7897457801020', '17897457801027', 'Molhos', 60),
  createFinishedGoodFromPDF('1903', 'KETCHUP TRADICIONAL TAPAJÓS Frd. 12x200g', 'FD', '7897457801143', '17897457801140', 'Molhos', 60),
  createFinishedGoodFromPDF('1908', 'MOSTARDA TRADICIONAL TAPAJÓS Frd. 12x200g', 'FD', '7897457801136', '17897457801133', 'Molhos', 60),
];
