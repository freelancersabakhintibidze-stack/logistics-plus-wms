export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  data: T[];
  pagination: Pagination;
  capabilities?: Record<string, boolean>;
}

export interface Product {
  sku: string | null;
  name: string | null;
  categoryId: string | number | null;
  unitPrice: number | null;
  active: boolean | number | string | null;
}

export interface InventoryRow {
  productId: string | number | null;
  sku: string | null;
  productName: string | null;
  warehouseId: string | number | null;
  warehouseName: string | null;
  onHand: number | null;
  reserved: number | null;
  available: number | null;
}

export interface OrderRow {
  id: string | number;
  orderNumber: string | null;
  customerId: string | number | null;
  status: string | null;
  createdAt: string | null;
  totalAmount: number | null;
}

export interface OrderItem {
  orderId: string | number | null;
  productId: string | number | null;
  productName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  subtotal: number | null;
}

export interface OrderDetail extends OrderRow {
  items: OrderItem[];
  lineItemTotal: number | null;
  totalReconciled: boolean | null;
}

export interface StatusCount {
  status: string | null;
  count: number;
}

export interface DashboardSummary {
  totalOrders: number;
  pendingOrders: number | null;
  lowStockItems: number | null;
  totalOrderValue: number | null;
  ordersByStatus: StatusCount[];
  asOf: string;
  notes: string[];
}

export interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}
