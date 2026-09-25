import { z } from 'zod';

// ── Produtos ──────────────────────────────────────────────────────────────
export const productCreateSchema = z.object({
  name: z.string().min(1).max(100),
  barcode: z.string().max(30).optional().default(''),
  sku: z.string().max(30).optional().default(''),
  category: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  brand: z.string().optional(),
  brandId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  unit: z.string().max(10).optional().default('UN'),
  price: z.number().min(0).optional().default(0),
  costPrice: z.number().min(0).optional().default(0),
  stock: z.number().int().min(0).optional().default(0),
  minStock: z.number().int().min(0).optional().default(0),
  iconType: z.enum(['drink','coffee','snack','candy','dairy','bakery','general']).optional().default('general'),
  colorTheme: z.string().optional().nullable(),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  barcode: z.string().max(30).optional(),
  sku: z.string().max(30).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().max(10).optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  idealStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  iconType: z.enum(['drink','coffee','snack','candy','dairy','bakery','general']).optional(),
  colorTheme: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  allowNegative: z.boolean().optional(),
  active: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
});

// ── Customers ─────────────────────────────────────────────────────────────
export const customerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  cpf: z.string().max(14).optional(),
  email: z.string().email().max(100).optional(),
  phone: z.string().max(20).optional(),
  creditLimit: z.number().min(0).optional().default(0),
  creditStatus: z.enum(['liberado','bloqueado','suspenso','inadimplente']).optional().default('liberado'),
  dueDays: z.number().int().min(0).optional().default(30),
});

export const customerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  cpf: z.string().max(14).optional(),
  email: z.string().email().max(100).optional(),
  phone: z.string().max(20).optional(),
  creditLimit: z.number().min(0).optional(),
  creditStatus: z.enum(['liberado','bloqueado','suspenso','inadimplente']).optional(),
  dueDays: z.number().int().min(0).optional(),
  active: z.union([z.boolean(), z.number().min(0).max(1)]).optional(),
});

export const customerPaymentSchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(200).optional(),
});

// ── Settings ──────────────────────────────────────────────────────────────
export const settingsUpdateSchema = z.object({
  name: z.string().max(50).optional(),
  tradeName: z.string().max(100).optional(),
  cnpj: z.string().max(20).optional(),
  ie: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(100).optional(),
  pixKey: z.string().max(100).optional(),
  pixKeyType: z.string().max(20).optional(),
  pixBeneficiaryName: z.string().max(100).optional(),
  pixCity: z.string().max(50).optional(),
  defaultMarginPercent: z.number().min(0).max(100).optional(),
  cardFeePercent: z.number().min(0).max(100).optional(),
  withdrawalLimit: z.number().min(0).optional(),
});
