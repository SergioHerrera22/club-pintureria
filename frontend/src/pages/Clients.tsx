import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { Search, User, Loader2, History, Award, Edit, Trash2, Eye, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const dniSchema = z.object({
  dni: z.string().min(7, 'DNI debe tener al menos 7 dígitos').max(8, 'DNI inválido'),
});

const clientSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional(),
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  dni: z.string().min(7, 'DNI debe tener al menos 7 dígitos').max(8, 'DNI inválido'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
});

const updateClientSchema = z.object({
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  isActive: z.boolean(),
});

type DniForm = z.infer<typeof dniSchema>;
type UpdateClientForm = z.infer<typeof updateClientSchema>;

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  birthDate?: string;
  isActive: boolean;
  createdAt: string;
  clientProfile: {
    currentPoints: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    lastPurchaseAt?: string;
  } | null;
}

interface Transaction {
  id: string;
  type: string;
  total: number;
  pointsEarned: number;
  pointsBalance: number;
  description?: string;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}

interface ClientDetail extends ClientData {
  recentTransactions?: Transaction[];
}

function Clients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingDni, setPendingDni] = useState('');
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [detailClient, setDetailClient] = useState<ClientDetail | null>(null);
  
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const dniForm = useForm<DniForm>({
    resolver: zodResolver(dniSchema),
    defaultValues: { dni: '' },
  });
  
  const clientForm = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      dni: '',
      phone: '',
      birthDate: '',
    },
  });
  
  const updateClientForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: '',
      isActive: true,
    },
  });

  const fetchClients = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });
      if (filters.search) params.append('search', filters.search);
      if (filters.isActive !== '') params.append('isActive', filters.isActive);
      
      const response = await api.get<{ clients: ClientData[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/clients?${params.toString()}`);
      setClients(response.data.clients);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [pagination.page, filters.search, filters.isActive, filters.sortBy, filters.sortOrder]);

  const handleSearch = async (data: DniForm) => {
    setSearchLoading(true);
    setError('');
    
    // Clean DNI - remove dots, dashes, spaces
    const cleanDni = data.dni.replace(/[.\-\s]/g, '');
    
    try {
      const response = await api.get<ClientData>(`/clients/dni/${cleanDni}`);
      // Client found - could navigate to detail or show info
      setSuccess(`Cliente encontrado: ${response.data.firstName} ${response.data.lastName}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setPendingDni(data.dni);
        clientForm.reset({
          email: '', firstName: '', lastName: '', dni: data.dni, phone: '', birthDate: '',
        });
        setShowCreateClientModal(true);
      } else {
        setError(err.response?.data?.error || 'Error al buscar cliente');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCreateClient = async (data: z.infer<typeof clientSchema>) => {
    setError('');
    try {
      const payload = { ...data, password: '123456' };
      await api.post('/auth/register', payload);
      setShowCreateClientModal(false);
      setPendingDni('');
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchClients();
      setSuccess('Cliente creado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear cliente');
    }
  };

  const handleUpdateClient = async (data: UpdateClientForm) => {
    if (!editingClient) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/clients/${editingClient.id}`, data);
      setShowEditClientModal(false);
      setEditingClient(null);
      fetchClients();
      setSuccess('Cliente actualizado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/clients/${id}`);
      fetchClients();
      setSuccess('Cliente eliminado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar cliente');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditClient = (clientData: ClientData) => {
    setEditingClient(clientData);
    updateClientForm.reset({
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      email: clientData.email,
      phone: clientData.phone || '',
      birthDate: clientData.birthDate?.split('T')[0] || '',
      isActive: clientData.isActive,
    });
    setShowEditClientModal(true);
  };

  const openDetailClient = async (clientData: ClientData) => {
    setLoading(true);
    try {
      const response = await api.get<ClientDetail>(`/clients/${clientData.id}`);
      setDetailClient(response.data);
      setShowDetailModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar detalle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Listado, búsqueda y gestión de clientes</p>
        </div>
        <button onClick={() => { setShowCreateClientModal(true); setPendingDni(''); clientForm.reset(); }} className="btn-primary flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI, email..."
              value={filters.search}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2 sm:flex-row">
            <select
              value={filters.isActive}
              onChange={(e) => { setFilters({ ...filters, isActive: e.target.value }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input w-40"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <select
              value={filters.sortBy}
              onChange={(e) => { setFilters({ ...filters, sortBy: e.target.value }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input w-40"
            >
              <option value="createdAt">Fecha registro</option>
              <option value="firstName">Nombre</option>
              <option value="lastName">Apellido</option>
              <option value="dni">DNI</option>
              <option value="email">Email</option>
            </select>
<button
              onClick={() => { setFilters({ search: '', isActive: '', sortBy: 'createdAt', sortOrder: 'desc' }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="btn-outline flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="card">
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/6" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm text-gray-500">
                    <th className="p-4 font-medium">Cliente</th>
                    <th className="p-4 font-medium hidden md:table-cell">DNI</th>
                    <th className="p-4 font-medium hidden lg:table-cell">Email</th>
                    <th className="p-4 font-medium hidden lg:table-cell">Teléfono</th>
                    <th className="p-4 font-medium text-right">Puntos</th>
                    <th className="p-4 font-medium hidden md:table-cell">Última compra</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No se encontraron clientes</p>
                      </td>
                    </tr>
                  ) : (
                    clients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{client.firstName} {client.lastName}</p>
                              <p className="text-xs text-gray-500">ID: {client.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell font-mono text-sm text-gray-700">{client.dni}</td>
                        <td className="p-4 hidden lg:table-cell text-sm text-gray-700 truncate max-w-xs">{client.email}</td>
                        <td className="p-4 hidden lg:table-cell text-sm text-gray-500">{client.phone || '-'}</td>
                        <td className="p-4 text-right font-semibold text-primary-600">
                          {client.clientProfile ? formatNumber(client.clientProfile.currentPoints) : 0}
                        </td>
                        <td className="p-4 hidden md:table-cell text-sm text-gray-500">
                          {client.clientProfile?.lastPurchaseAt ? formatDateTime(client.clientProfile.lastPurchaseAt) : 'Nunca'}
                        </td>
                        <td className="p-4">
                          <span className={cn('badge', client.isActive ? 'badge-success' : 'badge-gray')}>
                            {client.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openDetailClient(client)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditClient(client)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id)}
                              disabled={deletingId === client.id}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              {deletingId === client.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} clientes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={pagination.page === 1}
                    className="btn-outline p-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded">
                    Página {pagination.page} de {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                    disabled={pagination.page === pagination.pages}
                    className="btn-outline p-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Search by DNI */}
      <div className="card p-4 bg-primary-50 border-primary-200">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary-600" />
          Búsqueda Rápida por DNI
        </h3>
        <form onSubmit={dniForm.handleSubmit(handleSearch)} className="flex gap-3 max-w-md">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              {...dniForm.register('dni')}
              placeholder="Ingresa DNI (ej: 20123456)"
              className={cn(
                'input pl-10',
                dniForm.formState.errors.dni && 'border-red-300'
              )}
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
        {dniForm.formState.errors.dni && (
          <p className="mt-2 text-sm text-red-600">{dniForm.formState.errors.dni.message}</p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {success && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg max-w-md animate-slide-in">
          <div className="flex items-center gap-2 text-green-700">
            <Award className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuevo Cliente - DNI: {pendingDni}</h2>
              <button onClick={() => { setShowCreateClientModal(false); setPendingDni(''); clientForm.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={clientForm.handleSubmit(handleCreateClient)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input {...clientForm.register('firstName')} className="input" />
                  {clientForm.formState.errors.firstName && <p className="text-sm text-red-600 mt-1">{clientForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input {...clientForm.register('lastName')} className="input" />
                  {clientForm.formState.errors.lastName && <p className="text-sm text-red-600 mt-1">{clientForm.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input {...clientForm.register('email')} type="email" className="input" />
                {clientForm.formState.errors.email && <p className="text-sm text-red-600 mt-1">{clientForm.formState.errors.email.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">DNI</label>
                  <input {...clientForm.register('dni')} className="input" readOnly={!!pendingDni} />
                  {pendingDni && <p className="text-xs text-gray-500 mt-1">DNI prellenado desde búsqueda</p>}
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input {...clientForm.register('phone')} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Fecha Nacimiento</label>
                <input {...clientForm.register('birthDate')} type="date" className="input" />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateClientModal(false); setPendingDni(''); clientForm.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar Cliente</h2>
              <button onClick={() => { setShowEditClientModal(false); setEditingClient(null); updateClientForm.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={updateClientForm.handleSubmit(handleUpdateClient)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input {...updateClientForm.register('firstName')} className="input" />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input {...updateClientForm.register('lastName')} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input {...updateClientForm.register('email')} type="email" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono</label>
                  <input {...updateClientForm.register('phone')} className="input" />
                </div>
                <div>
                  <label className="label">DNI</label>
                  <input className="input" value={editingClient.dni} readOnly />
                </div>
              </div>
              <div>
                <label className="label">Fecha Nacimiento</label>
                <input {...updateClientForm.register('birthDate')} type="date" className="input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...updateClientForm.register('isActive')} className="rounded" id="isActive" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Activo</label>
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditClientModal(false); setEditingClient(null); updateClientForm.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {showDetailModal && detailClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{detailClient.firstName} {detailClient.lastName}</h2>
                  <p className="text-sm text-gray-500">DNI: {detailClient.dni}</p>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setDetailClient(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Puntos Actuales</p>
                  <p className="text-2xl font-bold text-primary-600">{formatNumber(detailClient.clientProfile?.currentPoints || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Ganados</p>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(detailClient.clientProfile?.totalPointsEarned || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Canjeados</p>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(detailClient.clientProfile?.totalPointsRedeemed || 0)}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Últimos 10 Movimientos
                </h3>
                
                {(detailClient.recentTransactions ?? []).length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay transacciones registradas</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {(detailClient.recentTransactions ?? []).map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={cn('badge', tx.type === 'COMPRA' ? 'badge-success' : tx.type === 'CANJE' ? 'badge-warning' : 'badge-info')}>
                              {tx.type === 'COMPRA' ? 'Compra' : tx.type === 'CANJE' ? 'Canje' : 'Ajuste'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{formatDateTime(tx.createdAt)}</p>
                              <p className="text-sm text-gray-500">
                                {tx.type === 'COMPRA' ? `Compra de ${tx.items?.length || 0} productos` : 
                                 tx.type === 'CANJE' ? `Canje de premio` :
                                 tx.description || 'Ajuste manual'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn('font-semibold', tx.pointsEarned >= 0 ? 'text-green-600' : 'text-red-600')}>
                              {tx.pointsEarned >= 0 ? '+' : ''}{formatNumber(tx.pointsEarned)} pts
                            </p>
                            <p className="text-sm text-gray-500">Saldo: {formatNumber(tx.pointsBalance)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;