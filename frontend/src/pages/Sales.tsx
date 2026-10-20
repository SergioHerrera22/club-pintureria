import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatNumber, formatCurrency, formatDateTime } from '../lib/utils';
import { Search, User, Loader2, Award, Package, Plus, Minus, Receipt, Calculator, Trash2, X, UserCheck } from 'lucide-react';
import { useClientStore } from '../stores/clientStore';
import { useAuthStore } from '../stores/authStore';

const quickSaleSchema = z.object({
  amount: z.number({ invalid_type_error: 'Ingrese un monto válido' }).positive('Monto requerido'),
  notes: z.string().optional(),
});

/** Venta por productos desactivada: la carga de ventas es sólo por monto rápido. */
const PRODUCT_SALE_ENABLED = false;

const productSaleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1, 'Al menos un producto'),
  notes: z.string().optional(),
});

const clientSearchSchema = z.object({
  dni: z.string().min(7, 'DNI debe tener al menos 7 dígitos').max(8, 'DNI inválido'),
});

const newClientSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
});

type QuickSaleForm = z.infer<typeof quickSaleSchema>;
type ProductSaleForm = z.infer<typeof productSaleSchema>;
type ClientSearchForm = z.infer<typeof clientSearchSchema>;
type NewClientForm = z.infer<typeof newClientSchema>;

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  birthDate?: string;
  isActive: boolean;
  clientProfile: {
    currentPoints: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    lastPurchaseAt?: string;
  } | null;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  brand?: string;
  unitPrice: number;
}

interface Transaction {
  id: string;
  type: string;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  description?: string;
  createdAt: string;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  receiptNumber?: string;
  branch?: { name: string; code: string };
  itemCount?: number;
  pointsBreakdown?: Array<{
    rule: string;
    type: string;
    points: number;
    description?: string;
  }>;
}

interface SelectedItem {
  product: Product;
  quantity: number;
}

interface SaleResponse {
  transaction: {
    id: string;
    receiptNumber: string;
    total: number;
    pointsEarned: number;
    pointsBalance: number;
    createdAt: string;
  };
  client: {
    currentPoints: number;
    isNewClient: boolean;
    firstName: string;
    lastName: string;
    dni: string;
  };
  appliedPromotions: any[];
  appliedCoupon: any;
}

const VendorSelector = ({
  vendors,
  value,
  onChange,
}: {
  vendors: Array<{ id: string; name: string; dni: string }>;
  value: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <label htmlFor="vendor-select" className="label flex items-center gap-1.5">
      <UserCheck className="w-4 h-4 text-gray-400" />
      Vendedor que atendió (opcional)
    </label>
    <select
      id="vendor-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      <option value="">— Sin vendedor asignado —</option>
      {vendors.map(v => (
        <option key={v.id} value={v.id}>{v.name} (DNI {v.dni})</option>
      ))}
    </select>
    <p className="mt-1 text-xs text-gray-400">
      La venta se le carga al vendedor elegido y le aparece en su "Mis Ventas".
    </p>
  </div>
);

const RecentSales = ({ recentSales, salesLoading }: { recentSales: Transaction[]; salesLoading: boolean }) => {
  if (salesLoading) {
    return (
      <div className="divide-y divide-gray-200">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div>
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-20 mt-1" />
                </div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recentSales.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>No hay ventas registradas</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {recentSales.map((sale) => (
        <div key={sale.id} className="p-4 hover:bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={cn('badge', sale.type === 'COMPRA' ? 'badge-success' : 'badge-warning')}>
                {sale.type === 'COMPRA' ? 'Venta' : sale.type}
              </span>
              <div>
                <p className="font-medium text-gray-900">{formatDateTime(sale.createdAt)}</p>
                <p className="text-sm text-gray-500">
                  {sale.type === 'COMPRA' 
                    ? 'Venta de ' + (sale.items?.length || 0) + ' productos' 
                    : sale.description || ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-green-600">
                +{formatNumber(sale.pointsEarned)} pts
              </p>
              <p className="text-sm text-gray-500">Total: {formatCurrency(sale.total)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Sales() {
  const { 
    currentClient, 
    lastSync,
    fetchClientByDni, 
    refreshClientPoints,
    startAutoSync,
    stopAutoSync,
    clearClient,
    setCurrentClient,
  } = useClientStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [pendingDni, setPendingDni] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saleMode, setSaleMode] = useState<'quick' | 'products'>('quick');
  const [recentSales, setRecentSales] = useState<Transaction[]>([]);
  const [clientHistory, setClientHistory] = useState<Transaction[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; dni: string }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');

  const { user } = useAuthStore();
  // El selector de vendedor aplica a quien registra la venta (cajera/admin).
  // Un vendedor registra a su propio nombre.
  const canPickVendor = user?.role === 'CAJERA' || user?.role === 'ADMIN';
  
  // Sync local client state with store
  const client = currentClient;
  const setClient = (c: ClientData | null) => setCurrentClient(c);
  
  const quickSaleForm = useForm<QuickSaleForm>({
    resolver: zodResolver(quickSaleSchema),
    defaultValues: { amount: undefined as unknown as number, notes: '' },
  });
  
  const productSaleForm = useForm<ProductSaleForm>({
    resolver: zodResolver(productSaleSchema),
    defaultValues: { items: [], notes: '' },
  });
  
  const clientSearchForm = useForm<ClientSearchForm>({
    resolver: zodResolver(clientSearchSchema),
    defaultValues: { dni: '' },
  });
  
  const newClientForm = useForm<NewClientForm>({
    resolver: zodResolver(newClientSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', birthDate: '' },
  });

  const fetchProducts = async () => {
    try {
      const response = await api.get<{ products: Product[] }>('/products?isActive=true&limit=100');
      setProducts(response.data.products);
      setFilteredProducts(response.data.products);
    } catch {
      setError('Error al cargar productos');
    }
  };

  const fetchRecentSales = async () => {
    setSalesLoading(true);
    try {
      const response = await api.get<Transaction[]>('/dashboard/recent-purchases?limit=10');
      setRecentSales(response.data);
    } catch {
    } finally {
      setSalesLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await api.get<{ vendors: Array<{ id: string; name: string; dni: string }> }>('/purchases/vendors');
      setVendors(response.data.vendors);
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    if (canPickVendor) {
      fetchVendors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClientHistory = async (clientId: string) => {
    try {
      const response = await api.get(`/clients/${clientId}`);
      if (response.data.recentTransactions) {
        setClientHistory(response.data.recentTransactions);
      }
    } catch (err) {
      console.error('Error fetching client history:', err);
    }
  };

  useEffect(() => {
    fetchRecentSales();
  }, []);

  // Auto-sync client points every 5 seconds
  useEffect(() => {
    if (client?.dni) {
      startAutoSync(5000);
    } else {
      stopAutoSync();
    }
    return () => stopAutoSync();
  }, [client?.dni, startAutoSync, stopAutoSync]);

  useEffect(() => {
    if (productSearch.trim()) {
      const search = productSearch.toLowerCase();
      setFilteredProducts(products.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search) ||
        (p.brand && p.brand.toLowerCase().includes(search))
      ));
    } else {
      setFilteredProducts(products);
    }
  }, [productSearch, products]);

  const handleClientSearch = async (data: ClientSearchForm) => {
    setSearchLoading(true);
    setError('');
    setClient(null);
    setShowNewClientForm(false);
    
    const cleanDni = data.dni.replace(/[.\-\s]/g, '');
    console.log('Searching client with DNI:', cleanDni, '(original:', data.dni, ')');
    
    try {
      const clientData = await fetchClientByDni(cleanDni);
      console.log('Client found:', clientData);
      
      if (!clientData) {
        throw new Error('Cliente no encontrado');
      }
      
      // Fetch client history/transactions
      fetchClientHistory(clientData.id);
      
      if (saleMode === 'products') fetchProducts();
    } catch (err: any) {
      console.error('Client search error:', err.response?.data || err);
      setClient(null);
      if (err.response?.status === 404) {
        setPendingDni(cleanDni);
        setShowNewClientForm(true);
        newClientForm.reset({ 
          firstName: '', 
          lastName: '', 
          email: '', 
          phone: '', 
          birthDate: '' 
        });
      } else if (err.response?.status === 403 || err.message === 'Cliente inactivo') {
        setError('Cliente inactivo');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Error al buscar cliente');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCreateClientAndSale = async () => {
    // Validate new client form first
    const newClientValid = await newClientForm.trigger();
    if (!newClientValid) {
      setError('Complete los datos del nuevo cliente');
      return;
    }
    
    const newClientData = newClientForm.getValues();
    
    if (!newClientData.firstName || !newClientData.lastName) {
      setError('Nombre y apellido son requeridos');
      return;
    }

    // Validate sale form based on mode BEFORE loading
    if (saleMode === 'quick') {
      const quickValid = await quickSaleForm.trigger();
      if (!quickValid) {
        setError('Ingrese un monto válido para la venta rápida');
        return;
      }
    } else {
      const productValid = await productSaleForm.trigger();
      if (!productValid || selectedItems.length === 0) {
        setError('Seleccione al menos un producto');
        return;
      }
    }

    setSaleLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const payload: any = {
        dni: pendingDni,
        firstName: newClientData.firstName,
        lastName: newClientData.lastName,
        email: newClientData.email || undefined,
        phone: newClientData.phone || undefined,
        birthDate: newClientData.birthDate || undefined,
        vendorId: selectedVendorId || undefined,
      };
      
      console.log('Creating client and sale with payload:', payload);
      
      if (saleMode === 'quick') {
        const quickData = quickSaleForm.getValues();
        payload.amount = quickData.amount;
        payload.notes = quickData.notes;
        
        console.log('Sending quick purchase:', payload);
        const response = await api.post<SaleResponse>('/clients/quick-purchase', payload);
        console.log('Quick purchase response:', response.data);
        
        setSuccess(`¡Nuevo cliente creado y venta registrada! Se otorgaron ${response.data.transaction?.pointsEarned || 0} puntos.`);
        quickSaleForm.reset({ amount: undefined as unknown as number, notes: '' });
      } else {
        payload.items = selectedItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        }));
        payload.notes = productSaleForm.getValues().notes;
        
        console.log('Sending product purchase:', payload);
        const response = await api.post<SaleResponse>('/clients/purchase', payload);
        console.log('Product purchase response:', response.data);
        
        setSuccess(`¡Nuevo cliente creado y venta registrada! Se otorgaron ${response.data.transaction?.pointsEarned || 0} puntos.`);
        setSelectedItems([]);
        productSaleForm.reset({ notes: '' });
      }
      
      setShowNewClientForm(false);
      setPendingDni('');
      setClient(null);
      // Refresh client points and recent sales after sale
      await refreshClientPoints();
      fetchRecentSales();
    } catch (err: any) {
      console.error('Error creating client and sale:', err.response?.data || err);
      setError(err.response?.data?.error || 'Error al registrar venta');
    } finally {
      setSaleLoading(false);
    }
  };

  const handleQuickSale = async (data: QuickSaleForm) => {
    if (!client) return;
    
    setSaleLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('Quick sale for client:', client.dni, 'amount:', data.amount);
      const response = await api.post<SaleResponse>('/clients/quick-purchase', {
        dni: client.dni,
        amount: data.amount,
        notes: data.notes,
        vendorId: selectedVendorId || undefined,
      });
      console.log('Quick sale response:', response.data);
      
      setSuccess(`¡Venta registrada! Se otorgaron ${response.data.transaction?.pointsEarned || 0} puntos.`);
      setClient(null);
      quickSaleForm.reset({ amount: undefined as unknown as number, notes: '' });
      await refreshClientPoints();
      fetchRecentSales();
    } catch (err: any) {
      console.error('Quick sale error:', err.response?.data || err);
      setError(err.response?.data?.error || 'Error al registrar venta');
    } finally {
      setSaleLoading(false);
    }
  };

  const handleProductSale = async (data: ProductSaleForm) => {
    if (!client || selectedItems.length === 0) return;
    
    setSaleLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const items = selectedItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));
      console.log('Product sale for client:', client.dni, 'items:', items);
      
      const response = await api.post<SaleResponse>('/clients/purchase', {
        dni: client.dni,
        items,
        notes: data.notes,
        vendorId: selectedVendorId || undefined,
      });
      console.log('Product sale response:', response.data);
      
      setSuccess(`¡Venta registrada! Se otorgaron ${response.data.transaction?.pointsEarned || 0} puntos.`);
      setSelectedItems([]);
      setClient(null);
      productSaleForm.reset({ notes: '' });
      await refreshClientPoints();
      fetchRecentSales();
    } catch (err: any) {
      console.error('Product sale error:', err.response?.data || err);
      setError(err.response?.data?.error || 'Error al registrar venta por productos');
    } finally {
      setSaleLoading(false);
    }
  };

  const addProduct = (product: Product) => {
    const existing = selectedItems.find(item => item.product.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item =>
        item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter(item => item.product.id !== productId));
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const getSubtotal = () => selectedItems.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
  const getTax = () => getSubtotal() * 0.21;
  const getTotal = () => getSubtotal() + getTax();
  const getEstimatedPoints = (amount: number) => Math.round(amount * 0.04);

  const resetSale = () => {
    clearClient();
    setSelectedItems([]);
    setShowNewClientForm(false);
    setPendingDni('');
    setError('');
    setSuccess('');
    quickSaleForm.reset({ amount: undefined as unknown as number, notes: '' });
    productSaleForm.reset({ notes: '' });
    clientSearchForm.reset({ dni: '' });
    newClientForm.reset({ firstName: '', lastName: '', email: '', phone: '', birthDate: '' });
  };

  const formatPoints = (points: number) => points.toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500">Registra ventas y otorga puntos a clientes</p>
        </div>
      </div>

      {/* Client Search Section */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {showNewClientForm ? 'Nuevo Cliente' : 'Buscar Cliente'}
          </h2>
        </div>
        <div className="p-4">
          {showNewClientForm ? (
            <form onSubmit={(e) => { e.preventDefault(); handleCreateClientAndSale(); }} className="space-y-4 max-w-md">
              <input type="hidden" value={pendingDni} />
              <div>
                <label className="label">DNI</label>
                <input
                  type="text"
                  value={pendingDni}
                  className="input bg-gray-50"
                  readOnly
                />
                <p className="mt-1 text-sm text-gray-500">El DNI se usará para crear el cliente y registrar la venta</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre *</label>
                  <input
                    {...newClientForm.register('firstName', { required: true })}
                    className="input"
                    placeholder="Juan"
                    autoFocus
                  />
                  {newClientForm.formState.errors.firstName && (
                    <p className="text-sm text-red-600 mt-1">{newClientForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Apellido *</label>
                  <input
                    {...newClientForm.register('lastName', { required: true })}
                    className="input"
                    placeholder="Pérez"
                  />
                  {newClientForm.formState.errors.lastName && (
                    <p className="text-sm text-red-600 mt-1">{newClientForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email (opcional)</label>
                  <input
                    {...newClientForm.register('email')}
                    type="email"
                    className="input"
                    placeholder="juan@email.com"
                  />
                  {newClientForm.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">{newClientForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Teléfono (opcional)</label>
                  <input
                    {...newClientForm.register('phone')}
                    type="tel"
                    className="input"
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>
              </div>
              <div>
                <label className="label">Fecha de Nacimiento (opcional)</label>
                <input
                  {...newClientForm.register('birthDate')}
                  type="date"
                  className="input"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              {/* Sale Form Fields */}
              {saleMode === 'quick' && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium text-gray-900">Datos de la Venta Rápida</h3>
                  <div>
                    <label htmlFor="new-client-amount" className="label">Monto Total (con IVA) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">$</span>
                      <input
                        {...quickSaleForm.register('amount', { valueAsNumber: true, required: true })}
                        id="new-client-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="input pl-8 text-right text-lg no-spin"
                        onWheel={(e) => e.currentTarget.blur()}
                      />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Puntos estimados: ~{formatPoints(getEstimatedPoints(quickSaleForm.watch('amount') || 0))} pts
                    </p>
                  </div>
                  <div>
                    <label htmlFor="new-client-notes" className="label">Observaciones (opcional)</label>
                    <textarea
                      {...quickSaleForm.register('notes')}
                      id="new-client-notes"
                      rows={2}
                      className="input"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              )}
              
              {PRODUCT_SALE_ENABLED && saleMode === 'products' && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium text-gray-900">Productos de la Venta</h3>
                  <div>
                    <label className="label">Buscar Productos</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        placeholder="Escribe nombre, código, categoría o marca..."
                        className="input pl-10"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredProducts.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No se encontraron productos</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredProducts.map((product) => (
                          <div key={product.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{product.name}</p>
                              <p className="text-sm text-gray-500">
                                {product.code} • {product.category} {product.brand ? `• ${product.brand}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <span className="font-semibold text-gray-900 w-24 text-right">
                                {formatCurrency(product.unitPrice)}
                              </span>
                              <button
                                type="button"
                                onClick={() => addProduct(product)}
                                className="btn-primary text-sm px-3 py-1"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {selectedItems.length > 0 && (
                    <div className="border border-primary-200 bg-primary-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Productos Seleccionados ({selectedItems.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedItems.map((item) => (
                          <div key={item.product.id} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{item.product.name}</p>
                              <p className="text-sm text-gray-500">
                                {formatCurrency(item.product.unitPrice)} c/u
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="p-1 rounded hover:bg-gray-100"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="p-1 rounded hover:bg-gray-100"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, 0)}
                                className="p-1 rounded hover:bg-red-50 text-red-600 ml-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <span className="font-semibold text-gray-900 w-24 text-right ml-4">
                                {formatCurrency(item.product.unitPrice * item.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 space-y-2 border-t pt-4">
                        <div className="flex justify-between text-gray-900">
                          <span>Subtotal</span>
                          <span>{formatCurrency(getSubtotal())}</span>
                        </div>
                        <div className="flex justify-between text-gray-900">
                          <span>IVA (21%)</span>
                          <span>{formatCurrency(getTax())}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-primary-600">
                          <span>Total</span>
                          <span>{formatCurrency(getTotal())}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-primary-600">
                          <span>Puntos Estimados</span>
                          <span>
                            <Award className="w-4 h-4 inline mr-1" />
                            ~{formatPoints(getEstimatedPoints(getTotal()))} pts
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="new-client-notes" className="label">Observaciones (opcional)</label>
                    <textarea
                      {...productSaleForm.register('notes')}
                      id="new-client-notes"
                      rows={2}
                      className="input"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              )}
              
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewClientForm(false);
                    setPendingDni('');
                    setError('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Volver a Buscar
                </button>
                <button
                  type="submit"
                  disabled={saleLoading}
                  className="btn-primary flex-1"
                >
                  {saleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Cliente y Registrar Venta'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={clientSearchForm.handleSubmit(handleClientSearch)} className="flex gap-3 max-w-md">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  {...clientSearchForm.register('dni', { required: true })}
                  placeholder="Ingresa DNI (ej: 20123456)"
                  className="input pl-10"
                  disabled={searchLoading}
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="btn-primary whitespace-nowrap"
              >
                {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
              </button>
            </form>
          )}
          {!showNewClientForm && error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>

      {/* Client Info & Sale Mode */}
      {client && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <User className="w-10 h-10 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900 text-lg">
                  {client.firstName} {client.lastName}
                </p>
                <p className="text-sm text-gray-500">DNI: {client.dni}</p>
              </div>
              {client.clientProfile && (
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary-600">
                      {formatPoints(client.clientProfile.currentPoints)}
                    </p>
                    <p className="text-xs text-gray-500">Puntos actuales</p>
                    {lastSync && (
                      <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Actualizado: {new Date(lastSync).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={resetSale}
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" /> Cambiar cliente
            </button>
          </div>

          {/* Client History */}
          {clientHistory.length > 0 && (
            <div className="border-t border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Historial de Movimientos
                </h3>
                <span className="text-sm text-gray-500">{clientHistory.length} movimientos</span>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {clientHistory.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn('badge', tx.type === 'COMPRA' ? 'badge-success' : tx.type === 'CANJE' ? 'badge-warning' : 'badge-info')}>
                          {tx.type === 'COMPRA' ? 'Compra' : tx.type === 'CANJE' ? 'Canje' : 'Ajuste'}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{formatDateTime(tx.createdAt)}</p>
                          <p className="text-sm text-gray-500">
                            {tx.type === 'COMPRA' 
                              ? `Compra de ${tx.items?.length || 0} productos` 
                              : tx.description || ''}
                          </p>
                          {tx.pointsBreakdown && tx.pointsBreakdown.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              {tx.pointsBreakdown.map((pb, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-gray-500">
                                  <span>{pb.description || `${pb.rule}: +${pb.points} pts`}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          +{formatNumber(tx.pointsEarned)} pts
                        </p>
                        <p className="text-sm text-gray-500">Total: {formatCurrency(tx.total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sale Mode Tabs — ocultas: la venta por productos está desactivada */}
          {PRODUCT_SALE_ENABLED && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-2" role="tablist">
              <button
                role="tab"
                aria-selected={saleMode === 'quick'}
                onClick={() => setSaleMode('quick')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  saleMode === 'quick'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Calculator className="w-4 h-4 inline mr-1" /> Venta Rápida
              </button>
              <button
                role="tab"
                aria-selected={saleMode === 'products'}
                onClick={() => setSaleMode('products')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  saleMode === 'products'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Package className="w-4 h-4 inline mr-1" /> Por Productos
              </button>
            </div>
          </div>
          )}

          {/* Quick Sale Form */}
          {saleMode === 'quick' && (
            <form onSubmit={quickSaleForm.handleSubmit(handleQuickSale)} className="p-4 space-y-4">
              <div>
                <label htmlFor="quick-amount" className="label">Monto Total (con IVA)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">$</span>
                  <input
                    {...quickSaleForm.register('amount', { valueAsNumber: true, required: true })}
                    id="quick-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    className="input pl-8 text-right text-lg no-spin"
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Puntos estimados: ~{formatPoints(getEstimatedPoints(quickSaleForm.watch('amount') || 0))} pts
                </p>
              </div>

              {canPickVendor && (
                <VendorSelector vendors={vendors} value={selectedVendorId} onChange={setSelectedVendorId} />
              )}
              
              <div>
                <label htmlFor="quick-notes" className="label">Observaciones (opcional)</label>
                <textarea
                  {...quickSaleForm.register('notes')}
                  id="quick-notes"
                  rows={2}
                  className="input"
                  placeholder="Notas adicionales..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetSale}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saleLoading || !quickSaleForm.watch('amount')}
                  className="btn-primary flex-1"
                >
                  {saleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrar Venta Rápida'}
                </button>
              </div>
            </form>
          )}

          {/* Product Sale Form — desactivado */}
          {PRODUCT_SALE_ENABLED && saleMode === 'products' && (
            <form onSubmit={productSaleForm.handleSubmit(handleProductSale)} className="p-4 space-y-4">
              <div>
                <label className="label">Buscar Productos</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Escribe nombre, código, categoría o marca..."
                    className="input pl-10"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No se encontraron productos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-sm text-gray-500">
                            {product.code} • {product.category} {product.brand ? `• ${product.brand}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="font-semibold text-gray-900 w-24 text-right">
                            {formatCurrency(product.unitPrice)}
                          </span>
                          <button
                            type="button"
                            onClick={() => addProduct(product)}
                            className="btn-primary text-sm px-3 py-1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="border border-primary-200 bg-primary-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos Seleccionados ({selectedItems.length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between p-2 bg-white rounded border">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.product.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(item.product.unitPrice)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 0)}
                            className="p-1 rounded hover:bg-red-50 text-red-600 ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-gray-900 w-24 text-right ml-4">
                            {formatCurrency(item.product.unitPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 space-y-2 border-t pt-4">
                    <div className="flex justify-between text-gray-900">
                      <span>Subtotal</span>
                      <span>{formatCurrency(getSubtotal())}</span>
                    </div>
                    <div className="flex justify-between text-gray-900">
                      <span>IVA (21%)</span>
                      <span>{formatCurrency(getTax())}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-primary-600">
                      <span>Total</span>
                      <span>{formatCurrency(getTotal())}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-primary-600">
                      <span>Puntos Estimados</span>
                      <span>
                        <Award className="w-4 h-4 inline mr-1" />
                        ~{formatPoints(getEstimatedPoints(getTotal()))} pts
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {canPickVendor && (
                <VendorSelector vendors={vendors} value={selectedVendorId} onChange={setSelectedVendorId} />
              )}

              <div>
                <label htmlFor="notes" className="label">Observaciones (opcional)</label>
                <textarea
                  {...productSaleForm.register('notes')}
                  id="notes"
                  rows={2}
                  className="input"
                  placeholder="Notas adicionales..."
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetSale}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saleLoading || selectedItems.length === 0}
                  className="btn-primary flex-1"
                >
                  {saleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrar Venta'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Recent Sales */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Últimas Ventas
          </h2>
        </div>
        <RecentSales recentSales={recentSales} salesLoading={salesLoading} />
      </div>

      {success && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <Award className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}
    </div>
  );
}