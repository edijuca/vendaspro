import { Product, Sale, Customer, StockMovement, CashRegister, CashMovement, Promotion } from './types';

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('vp_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...((options?.headers as Record<string, string>) || {}) },
  });
  const json = await res.json();
  if (res.status === 401) {
    localStorage.removeItem('vp_token');
    window.dispatchEvent(new Event('vp:unauthorized'));
  }
  if (!json.success) throw new Error(json.error || 'Erro na API');
  return json.data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      req<{ token: string; user: { id: string; name: string; email: string; role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => req<{ id: string; name: string; email?: string; role: string }>('/auth/me'),
  },

  products: {
    list: (search?: string, signal?: AbortSignal, opts?: { includeInactive?: boolean }) => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (opts?.includeInactive) params.set('includeInactive', '1');
      const qs = params.toString();
      return req<Product[]>(`/products${qs ? `?${qs}` : ''}`, { signal });
    },
    get: (id: string) => req<Product>(`/products/${id}`),
    findByBarcode: (bc: string) => req<Product | null>(`/products/barcode/${encodeURIComponent(bc)}`),
    create: (data: any) => req<{ id: string; code: string }>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req<void>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/products/${id}`, { method: 'DELETE' }),
  },

  sales: {
    list: (status?: string) => req<Sale[]>(`/sales${status ? `?status=${status}` : ''}`),
    get: (id: string) => req<Sale>(`/sales/${id}`),
    create: (data: any) => req<{ id: string; code: string; total: number }>('/sales', { method: 'POST', body: JSON.stringify(data) }),
    cancel: (id: string, reason?: string) =>
      req<void>(`/sales/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  },

  customers: {
    list: (opts?: { includeInactive?: boolean }) =>
      req<Customer[]>(`/customers${opts?.includeInactive ? '?includeInactive=1' : ''}`),
    get: (id: string) => req<Customer>(`/customers/${id}`),
    create: (data: any) => req<{ id: string }>('/customers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req<void>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    receive: (id: string, amount: number, description?: string) =>
      req<{ currentDebt: number }>(`/customers/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      }),
  },

  stock: {
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams();
      if (filters) Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
      return req<StockMovement[]>(`/stock${params.toString() ? `?${params}` : ''}`);
    },
    summary: () =>
      req<{ saidas: number; entradas: number; produtos: number; produtos_movimentados: number }>('/stock/summary'),
    create: (data: any) => req<{ id: string }>('/stock', { method: 'POST', body: JSON.stringify(data) }),
  },

  cash: {
    registers: () => req<CashRegister[]>('/cash/registers'),
    current: () => req<CashRegister | null>('/cash/registers/current'),
    get: (id: string) => req<CashRegister & { summary: any }>(`/cash/registers/${id}`),
    summary: (id: string) => req<any>(`/cash/registers/${id}/summary`),
    report: (id: string) => req<any>(`/cash/registers/${id}/report`),
    open: (data: any) => req<{ id: string; code?: string }>('/cash/registers/open', { method: 'POST', body: JSON.stringify(data) }),
    close: (id: string, data: { countedBalance: number }) =>
      req<{ expected: number; counted: number; difference: number }>(`/cash/registers/${id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reopen: (id: string) => req<void>(`/cash/registers/${id}/reopen`, { method: 'POST', body: JSON.stringify({}) }),
    movements: (regId?: string) => req<CashMovement[]>(`/cash/movements${regId ? `?cashRegisterId=${regId}` : ''}`),
    movement: (data: any) => req<{ id: string }>('/cash/movements', { method: 'POST', body: JSON.stringify(data) }),
  },

  entities: {
    categories: () => req<any[]>('/entities/categories'),
    brands: () => req<any[]>('/entities/brands'),
    suppliers: () => req<any[]>('/entities/suppliers'),
    users: () => req<any[]>('/entities/users'),
    createCategory: (data: any) => req<{ id: string }>('/entities/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) => req<void>(`/entities/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: string) => req<void>(`/entities/categories/${id}`, { method: 'DELETE' }),
    createBrand: (data: any) => req<{ id: string }>('/entities/brands', { method: 'POST', body: JSON.stringify(data) }),
    updateBrand: (id: string, data: any) => req<void>(`/entities/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBrand: (id: string) => req<void>(`/entities/brands/${id}`, { method: 'DELETE' }),
    createSupplier: (data: any) => req<{ id: string }>('/entities/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    updateSupplier: (id: string, data: any) => req<void>(`/entities/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSupplier: (id: string) => req<void>(`/entities/suppliers/${id}`, { method: 'DELETE' }),
    createUser: (data: any) => req<{ id: string }>('/entities/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: any) => req<void>(`/entities/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id: string) => req<void>(`/entities/users/${id}`, { method: 'DELETE' }),
  },

  promotions: {
    list: (opts?: { includeInactive?: boolean }) =>
      req<Promotion[]>(`/promotions${opts?.includeInactive ? '?includeInactive=1' : ''}`),
    active: () => req<Promotion[]>('/promotions/active'),
    create: (data: any) => req<{ id: string }>('/promotions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => req<void>(`/promotions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/promotions/${id}`, { method: 'DELETE' }),
  },

  reports: {
    sales: (from?: string, to?: string) =>
      req<any>(`/reports/sales?from=${encodeURIComponent(from || '')}&to=${encodeURIComponent(to || '')}`),
    stockLow: () => req<any[]>('/reports/stock-low'),
  },

  settings: {
    get: () => req<any>('/settings'),
    update: (data: any) => req<void>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
