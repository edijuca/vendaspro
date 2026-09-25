export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'caixa';
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  marginPercent?: number;
  active?: boolean | number;
}

export interface Brand {
  id: string;
  code: string;
  name: string;
  active?: boolean | number;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  cnpjCpf: string;
  phone: string;
  email?: string;
  active?: boolean | number;
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado';

export interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string;
  sku: string;
  categoryId?: string;
  category: string;
  brandId?: string;
  brand?: string;
  supplierId?: string;
  unit: string;
  price: number;
  costPrice: number;
  marginPercent?: number;
  stock: number;
  minStock: number;
  idealStock?: number;
  maxStock?: number;
  allowNegative: boolean | number;
  active: boolean | number;
  iconType: 'drink' | 'coffee' | 'snack' | 'candy' | 'dairy' | 'bakery' | 'general';
  colorTheme?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  code: string;
  timestamp: string;
  terminal: string;
  operator: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  customerId?: string;
  customerName: string;
  customerCpf?: string;
  status: 'concluida' | 'cancelada';
  cancelledAt?: string;
  cancelReason?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  discount: number;
  total: number;
}

export interface Customer {
  id: string;
  code?: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  currentDebt: number;
  creditStatus: 'liberado' | 'bloqueado' | 'suspenso' | 'inadimplente';
  dueDays?: number;
  active?: boolean | number;
}

export interface CashRegister {
  id: string;
  code?: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  balance: number;
  salesTotal: number;
  closingBalance?: number;
  countedBalance?: number;
  difference?: number;
  status: 'aberto' | 'fechado';
  operator: string;
  operatorId?: string;
  closedBy?: string;
}

export interface CashMovement {
  id: string;
  cashRegisterId: string;
  type: string;
  amount: number;
  description?: string;
  reason?: string;
  timestamp: string;
  operator?: string;
  operatorId?: string;
  referenceId?: string;
}

export interface StockMovement {
  id: string;
  code: string;
  productId: string;
  productName: string;
  type: string;
  operation: 'entrada' | 'saida';
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  totalValue: number;
  reason: string;
  timestamp: string;
  operator?: string;
  operatorId?: string;
  referenceDocument?: string;
}

export interface Promotion {
  id: string;
  name: string;
  productId: string;
  productName?: string;
  productPrice?: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minQuantity: number;
  startDate: string;
  endDate: string;
  active: boolean | number;
}

export interface CompanySettings {
  id: number;
  name: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  address: string;
  phone: string;
  email: string;
  pixKey?: string;
  pixKeyType?: string;
  pixBeneficiaryName?: string;
  pixCity?: string;
  defaultMarginPercent: number;
  cardFeePercent: number;
  withdrawalLimit?: number;
}

export type ViewTab =
  | 'pdv'
  | 'dashboard'
  | 'produtos'
  | 'estoque'
  | 'vendas'
  | 'clientes'
  | 'caixa'
  | 'cadastros'
  | 'promocoes'
  | 'relatorios'
  | 'configuracoes';
