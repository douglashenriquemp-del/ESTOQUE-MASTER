
import { Product, Transaction, User } from '../types.ts';
import { INITIAL_PRODUCTS } from '../data/initialData.ts';

const PRODUCTS_KEY = 'inventory_products';
const TRANSACTIONS_KEY = 'inventory_transactions';
const USERS_KEY = 'inventory_users';
const FAILED_ATTEMPTS_KEY = 'login_failed_attempts';

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
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  getFailedAttempts: (): number => {
    return parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0');
  },

  incrementFailedAttempts: () => {
    const current = storageService.getFailedAttempts();
    localStorage.setItem(FAILED_ATTEMPTS_KEY, (current + 1).toString());
    return current + 1;
  },

  resetFailedAttempts: () => {
    localStorage.removeItem(FAILED_ATTEMPTS_KEY);
  }
};
