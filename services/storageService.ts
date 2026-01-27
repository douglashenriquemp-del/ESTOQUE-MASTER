
import { Product, Transaction } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialData';

const PRODUCTS_KEY = 'inventory_products';
const TRANSACTIONS_KEY = 'inventory_transactions';

export const storageService = {
  getProducts: (): Product[] => {
    const data = localStorage.getItem(PRODUCTS_KEY);
    return data ? JSON.parse(data) : INITIAL_PRODUCTS;
  },

  saveProducts: (products: Product[]) => {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveTransactions: (transactions: Transaction[]) => {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  }
};
