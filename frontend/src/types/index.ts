export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  address?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone?: string;
  birthDate?: string;
  role: 'ADMIN' | 'CAJERA' | 'VENDEDOR' | 'CLIENTE';
  isActive?: boolean;
  branchId?: string | null;
  branch?: BranchInfo | null;
  clientProfile?: ClientProfile;
  createdAt?: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  lastPurchaseAt?: string;
}

export interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  birthDate?: string;
  clientProfile: ClientProfile;
}

export interface ClientPointsData {
  dni: string;
  firstName: string;
  lastName: string;
  currentPoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PointRule {
  id: string;
  name: string;
  description?: string;
  type: 'POR_MONTO' | 'POR_PRODUCTO' | 'POR_CATEGORIA' | 'PRIMERA_COMPRA' | 'CUMPLEANOS' | 'RANGO_MONTO';
  config: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  products?: Product[];
  createdAt: string;
  updatedAt: string;
}

export interface Prize {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  pointsCost: number;
  stock: number;
  status: 'DISPONIBLE' | 'AGOTADO' | 'DESCONTINUADO';
  category: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'COMPRA' | 'CANJE' | 'AJUSTE_MANUAL' | 'BONIFICACION' | 'VENCIMIENTO';
  subtotal: number;
  tax: number;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  description?: string;
  cashierId?: string;
  createdAt: string;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  pointsEarned: number;
}

export interface Redemption {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; dni: string };
  prizeId: string;
  prize: Prize;
  pointsSpent: number;
  status: string;
  notes?: string;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
}

export interface DashboardStats {
  users: { total: number; active: number; newThisMonth: number };
  points: { totalEarned: number; totalRedeemed: number; inCirculation: number };
  sales: { totalTransactions: number; totalPurchases: number; revenueThisMonth: number; purchasesToday: number };
  topClients: Array<{ dni: string; name: string; currentPoints: number }>;
  lowStockPrizes: Array<{ id: string; name: string; stock: number; pointsCost: number }>;
}

export interface Movement {
  id: string;
  type: 'COMPRA' | 'AJUSTE_MANUAL';
  receiptNumber?: string;
  userDni: string;
  userName: string;
  branch: string;
  total: number;
  points: number;
  date: string;
}

export interface MovementsReport {
  movements: Movement[];
  totalPurchases: number;
  totalTransactions: number;
}

export interface BranchSummary {
  id: string;
  name: string;
  code: string;
  totalPurchases: number;
  lastPurchase?: {
    receiptNumber: string;
    date: string;
    total: number;
    points: number;
    client: string;
  };
}

export interface BranchSummaryReport {
  branches: BranchSummary[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PurchaseRequest {
  dni: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod?: string;
  notes?: string;
}

export interface PurchaseResponse {
  transaction: {
    id: string;
    total: number;
    pointsEarned: number;
    pointsBalance: number;
    createdAt: string;
  };
  client: { currentPoints: number };
  breakdown: Array<{ rule: string; points: number }>;
}