import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { MENU_PERMISSION_OPTIONS, ROLE_DEFAULT_PERMISSIONS, ADMIN_ONLY_MENU_KEYS } from '../lib/permissions';
import { Search, User, Loader2, History, Award, Edit, Trash2, Eye, X, ChevronLeft, ChevronRight, Plus, Building, ShieldAlert, KeyRound, RotateCcw } from 'lucide-react';

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  dni: z.string().min(7, 'DNI debe tener al menos 7 dígitos').max(8, 'DNI inválido'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  role: z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
  branchId: z.string().optional(),
}).superRefine((data, ctx) => {
  if ((data.role === 'CAJERA' || data.role === 'VENDEDOR') && !data.branchId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branchId'], message: 'Cajeras y vendedores requieren sucursal' });
  }
});

const updateUserSchema = z.object({
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  role: z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
  isActive: z.boolean().optional(),
  branchId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if ((data.role === 'CAJERA' || data.role === 'VENDEDOR') && !data.branchId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['branchId'], message: 'Cajeras y vendedores requieren sucursal' });
  }
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type UpdateUserForm = z.infer<typeof updateUserSchema>;

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone?: string;
  birthDate?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  clientProfile: {
    currentPoints: number;
    totalPointsEarned: number;
    totalPointsRedeemed: number;
    lastPurchaseAt?: string;
  } | null;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  /** Permisos de menú personalizados. null = usa los defaults de su rol */
  permissions?: string[] | null;
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

interface UserDetail extends UserData {
  recentTransactions?: Transaction[];
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  CAJERA: 'Cajera',
  VENDEDOR: 'Vendedor',
  CLIENTE: 'Cliente',
};

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  CAJERA: 'bg-blue-100 text-blue-800',
  VENDEDOR: 'bg-amber-100 text-amber-800',
  CLIENTE: 'bg-green-100 text-green-800',
};

function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAdminKeyModal, setShowAdminKeyModal] = useState(false);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminKeyError, setAdminKeyError] = useState('');
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserData | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);
  const [permsUser, setPermsUser] = useState<UserData | null>(null);
  const [customPerms, setCustomPerms] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    branchId: '',
    isActive: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      dni: '',
      phone: '',
      birthDate: '',
      role: 'CAJERA' as const,
      branchId: '',
    },
  });
  
  const updateUserForm = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: '',
      role: undefined,
      isActive: true,
      branchId: '',
    },
  });

  const createRole = createUserForm.watch('role');
  const updateRole = updateUserForm.watch('role');
  const staffRoleSelected = (role?: string) => role === 'CAJERA' || role === 'VENDEDOR';

  const fetchUsers = async () => {
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
      if (filters.role) params.append('role', filters.role);
      if (filters.branchId) params.append('branchId', filters.branchId);
      if (filters.isActive !== '') params.append('isActive', filters.isActive);
      
      const response = await api.get<{ users: UserData[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/admin/users?${params.toString()}`);
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get<{ branches: Array<{ id: string; name: string; code: string }> }>('/branches?isActive=true&limit=100');
      setBranches(response.data.branches);
    } catch {
      // Error loading branches
    }
  };

  useEffect(() => { fetchUsers(); fetchBranches(); }, [pagination.page, filters.search, filters.role, filters.branchId, filters.isActive, filters.sortBy, filters.sortOrder]);

  const handleCreateUser = async (data: CreateUserForm) => {
    setError('');
    setSaving(true);
    try {
      await api.post('/admin/users', data);
      setShowCreateUserModal(false);
      setSuccess('Usuario creado correctamente');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async (data: Partial<UpdateUserForm>) => {
    if (!editingUser) return;
    setSaving(true);
    setError('');
    try {
      const payload: any = { ...data };
      if (editingUser.role === 'ADMIN' || data.role === 'ADMIN') {
        payload.confirmationKey = adminKey;
      }
      await api.put(`/admin/users/${editingUser.id}`, payload);
      setShowEditUserModal(false);
      setEditingUser(null);
      setAdminKey('');
      fetchUsers();
      setSuccess('Usuario actualizado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userData: UserData) => {
    // Los administradores requieren clave de confirmación
    if (userData.role === 'ADMIN') {
      setPendingDeleteUser(userData);
      setAdminKey('');
      setAdminKeyError('');
      setShowAdminKeyModal(true);
      return;
    }
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    doDeleteUser(userData.id, undefined);
  };

  const doDeleteUser = async (id: string, confirmationKey?: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/users/${id}`, confirmationKey ? { data: { confirmationKey } } : undefined);
      fetchUsers();
      setSuccess('Usuario eliminado correctamente');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar usuario');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteAdmin = async () => {
    if (!pendingDeleteUser) return;
    if (!adminKey.trim()) {
      setAdminKeyError('Ingresá la clave de confirmación');
      return;
    }
    setShowAdminKeyModal(false);
    await doDeleteUser(pendingDeleteUser.id, adminKey.trim());
    setPendingDeleteUser(null);
  };

  const openEditUser = (userData: UserData) => {
    setEditingUser(userData);
    updateUserForm.reset({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone || '',
      birthDate: userData.birthDate?.split('T')[0] || '',
      role: userData.role as 'ADMIN' | 'CAJERA' | 'VENDEDOR' | 'CLIENTE' | undefined,
      isActive: userData.isActive,
      branchId: userData.branch?.id || '',
    });
    setShowEditUserModal(true);
  };

  const openDetailUser = async (userData: UserData) => {
    setLoading(true);
    try {
      const response = await api.get<UserDetail>(`/admin/users/${userData.id}`);
      setDetailUser(response.data);
      setShowDetailModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar detalle');
    } finally {
      setLoading(false);
    }
  };

  // ===== Permisos de menú por usuario =====

  const openPermissions = (userData: UserData) => {
    setPermsUser(userData);
    if (Array.isArray(userData.permissions)) {
      // Las secciones solo-admin no aplican a usuarios no-admin: se descartan.
      const isAdminTarget = userData.role === 'ADMIN';
      setCustomPerms(true);
      setSelectedPerms(
        isAdminTarget ? userData.permissions : userData.permissions.filter((k) => !ADMIN_ONLY_MENU_KEYS.has(k))
      );
    } else {
      setCustomPerms(false);
      setSelectedPerms(ROLE_DEFAULT_PERMISSIONS[userData.role] || []);
    }
    setShowPermsModal(true);
  };

  const togglePerm = (key: string) => {
    setSelectedPerms((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const savePermissions = async () => {
    if (!permsUser) return;
    setSavingPerms(true);
    setError('');
    try {
      await api.put(`/admin/users/${permsUser.id}`, { permissions: customPerms ? selectedPerms : null });
      setShowPermsModal(false);
      setPermsUser(null);
      setSuccess(customPerms ? 'Permisos actualizados correctamente' : 'Permisos restaurados a los del rol');
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar permisos');
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración de Usuarios</h1>
          <p className="text-gray-500">Gestión de cajeras, administradores y clientes</p>
        </div>
        <button onClick={() => { setShowCreateUserModal(true); createUserForm.reset(); }} className="btn-primary flex items-center gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Nuevo Usuario
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
              value={filters.role}
              onChange={(e) => { setFilters({ ...filters, role: e.target.value }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input w-40"
            >
              <option value="">Todos los roles</option>
              <option value="ADMIN">Administrador</option>
              <option value="CAJERA">Cajera</option>
              <option value="VENDEDOR">Vendedor</option>
              <option value="CLIENTE">Cliente</option>
            </select>
            <select
              value={filters.branchId}
              onChange={(e) => { setFilters({ ...filters, branchId: e.target.value }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input w-48"
            >
              <option value="">Todas las sucursales</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
            </select>
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
              onClick={() => { setFilters({ search: '', role: '', branchId: '', isActive: '', sortBy: 'createdAt', sortOrder: 'desc' }); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="btn-outline flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
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
                    <th className="p-4 font-medium">Usuario</th>
                    <th className="p-4 font-medium hidden md:table-cell">DNI</th>
                    <th className="p-4 font-medium hidden lg:table-cell">Email</th>
                    <th className="p-4 font-medium hidden lg:table-cell">Teléfono</th>
                    <th className="p-4 font-medium">Rol</th>
                    <th className="p-4 font-medium hidden md:table-cell">Sucursal</th>
                    <th className="p-4 font-medium text-right">Puntos</th>
                    <th className="p-4 font-medium hidden md:table-cell">Estado</th>
                    <th className="p-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No se encontraron usuarios</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                              <p className="text-xs text-gray-500">ID: {user.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell font-mono text-sm text-gray-700">{user.dni}</td>
                        <td className="p-4 hidden lg:table-cell text-sm text-gray-700 truncate max-w-xs">{user.email}</td>
                        <td className="p-4 hidden lg:table-cell text-sm text-gray-500">{user.phone || '-'}</td>
                        <td className="p-4">
                          <span className={cn('badge', roleColors[user.role] || 'bg-gray-100 text-gray-800')}>
                            {roleLabels[user.role] || user.role}
                          </span>
                          {Array.isArray(user.permissions) && (
                            <span className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500" title="Tiene accesos personalizados">
                              <KeyRound className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          {user.branch ? (
                            <span className="text-sm text-gray-700">{user.branch.name} ({user.branch.code})</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-semibold text-primary-600">
                          {user.clientProfile ? formatNumber(user.clientProfile.currentPoints) : 0}
                        </td>
                        <td className="p-4">
                          <span className={cn('badge', user.isActive ? 'badge-success' : 'badge-gray')}>
                            {user.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openDetailUser(user)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {user.role !== 'ADMIN' && user.role !== 'CLIENTE' && (
                              <button
                                onClick={() => openPermissions(user)}
                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Permisos de acceso (secciones del menú)"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditUser(user)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={deletingId === user.id}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              {deletingId === user.id ? (
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
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} usuarios
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

      {success && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-green-50 border border-green-200 rounded-lg shadow-lg max-w-md animate-slide-in">
          <div className="flex items-center gap-2 text-green-700">
            <Award className="w-5 h-5" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nuevo Usuario</h2>
              <button onClick={() => { setShowCreateUserModal(false); createUserForm.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input {...createUserForm.register('firstName')} className="input" />
                  {createUserForm.formState.errors.firstName && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input {...createUserForm.register('lastName')} className="input" />
                  {createUserForm.formState.errors.lastName && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input {...createUserForm.register('email')} type="email" className="input" />
                {createUserForm.formState.errors.email && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.email.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">DNI</label>
                  <input {...createUserForm.register('dni')} className="input" />
                  {createUserForm.formState.errors.dni && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.dni.message}</p>}
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input {...createUserForm.register('phone')} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Fecha Nacimiento</label>
                <input {...createUserForm.register('birthDate')} type="date" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rol</label>
                  <select {...createUserForm.register('role')} className="input">
                    <option value="CAJERA">Cajera</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="VENDEDOR">Vendedor</option>
                    <option value="CLIENTE">Cliente</option>
                  </select>
                </div>
                <div>
                  <label className="label">{staffRoleSelected(createRole) ? 'Sucursal *' : 'Sucursal (opcional)'}</label>
                  <select {...createUserForm.register('branchId')} className="input">
                    <option value="">{staffRoleSelected(createRole) ? 'Seleccionar sucursal...' : 'Sin sucursal'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                  {createUserForm.formState.errors.branchId && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.branchId.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input {...createUserForm.register('password')} type="password" className="input" />
                {createUserForm.formState.errors.password && <p className="text-sm text-red-600 mt-1">{createUserForm.formState.errors.password.message}</p>}
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateUserModal(false); createUserForm.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar Usuario</h2>
              <button onClick={() => { setShowEditUserModal(false); setEditingUser(null); updateUserForm.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={updateUserForm.handleSubmit(handleUpdateUser)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nombre</label>
                  <input {...updateUserForm.register('firstName')} className="input" />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input {...updateUserForm.register('lastName')} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input {...updateUserForm.register('email')} type="email" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono</label>
                  <input {...updateUserForm.register('phone')} className="input" />
                </div>
                <div>
                  <label className="label">DNI</label>
                  <input className="input" value={editingUser.dni} readOnly />
                </div>
              </div>
              <div>
                <label className="label">Fecha Nacimiento</label>
                <input {...updateUserForm.register('birthDate')} type="date" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rol</label>
                  <select {...updateUserForm.register('role')} className="input">
                    <option value="ADMIN">Administrador</option>
                    <option value="CAJERA">Cajera</option>
                    <option value="VENDEDOR">Vendedor</option>
                    <option value="CLIENTE">Cliente</option>
                  </select>
                </div>
                <div>
                  <label className="label">{staffRoleSelected(updateRole) ? 'Sucursal *' : 'Sucursal'}</label>
                  <select {...updateUserForm.register('branchId')} className="input">
                    <option value="">{staffRoleSelected(updateRole) ? 'Seleccionar sucursal...' : 'Sin sucursal'}</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                  {updateUserForm.formState.errors.branchId && <p className="text-sm text-red-600 mt-1">{updateUserForm.formState.errors.branchId.message}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...updateUserForm.register('isActive')} className="rounded" id="isActive" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Activo</label>
              </div>
              {(editingUser?.role === 'ADMIN' || updateUserForm.watch('role') === 'ADMIN') && (
                <div>
                  <label className="label">Clave de confirmación (edición de administrador) *</label>
                  <input
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="input"
                    placeholder="Clave de administrador"
                    autoComplete="off"
                  />
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditUserModal(false); setEditingUser(null); updateUserForm.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Confirmation Key Modal (delete admin) */}
      {showAdminKeyModal && pendingDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold">Confirmar eliminación</h2>
              </div>
              <button onClick={() => { setShowAdminKeyModal(false); setPendingDeleteUser(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Estás por eliminar al administrador <strong>{pendingDeleteUser.firstName} {pendingDeleteUser.lastName}</strong>.
                Esta acción no se puede deshacer. Ingresá la clave de confirmación:
              </p>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => { setAdminKey(e.target.value); setAdminKeyError(''); }}
                className="input"
                placeholder="Clave de confirmación"
                autoFocus
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') confirmDeleteAdmin(); }}
              />
              {adminKeyError && <p className="text-sm text-red-600">{adminKeyError}</p>}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdminKeyModal(false); setPendingDeleteUser(null); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="button" onClick={confirmDeleteAdmin} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermsModal && permsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Permisos de acceso</h2>
                  <p className="text-sm text-gray-500">
                    {permsUser.firstName} {permsUser.lastName} ·{' '}
                    <span className={cn('badge', roleColors[permsUser.role] || 'bg-gray-100 text-gray-800')}>
                      {roleLabels[permsUser.role] || permsUser.role}
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowPermsModal(false); setPermsUser(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={customPerms}
                  onChange={(e) => {
                    setCustomPerms(e.target.checked);
                    if (e.target.checked && selectedPerms.length === 0) {
                      setSelectedPerms(ROLE_DEFAULT_PERMISSIONS[permsUser.role] || []);
                    }
                  }}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="text-sm font-medium text-gray-900">Personalizar accesos para este usuario</span>
                  <span className="block text-xs text-gray-500">
                    {customPerms
                      ? 'Marcá las secciones del menú que este usuario puede usar. El resto queda bloqueado también en el backend.'
                      : `Sin personalización: ve las secciones según su rol (${roleLabels[permsUser.role] || permsUser.role}).`}
                  </span>
                </span>
              </label>

              <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2', !customPerms && 'opacity-50 pointer-events-none')}>
                {MENU_PERMISSION_OPTIONS.map((option) => {
                  const isDefault = (ROLE_DEFAULT_PERMISSIONS[permsUser.role] || []).includes(option.key);
                  const checked = selectedPerms.includes(option.key);
                  const adminOnlyLock = permsUser.role !== 'ADMIN' && ADMIN_ONLY_MENU_KEYS.has(option.key);
                  return (
                    <label
                      key={option.key}
                      className={cn(
                        'flex items-start gap-2 p-2.5 border rounded-lg transition-colors',
                        adminOnlyLock
                          ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                          : checked ? 'border-purple-300 bg-purple-50 cursor-pointer' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                      )}
                      title={adminOnlyLock ? 'Esta sección solo está disponible para administradores' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={adminOnlyLock}
                        onChange={() => togglePerm(option.key)}
                        className="mt-0.5 rounded"
                      />
                      <span className="min-w-0">
                        <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          {option.label}
                          {adminOnlyLock && (
                            <span className="badge b-gris" style={{ fontSize: '10px' }}>Solo admin</span>
                          )}
                          {isDefault && !checked && !adminOnlyLock && (
                            <span className="text-[10px] uppercase tracking-wide text-gray-400">(por defecto)</span>
                          )}
                        </span>
                        <span className="block text-xs text-gray-500 truncate">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {customPerms && (
                <p className="text-xs text-gray-400">
                  Para vendedores y cajeras podés habilitar cualquier sección de nivel cajera (Clientes, Ventas, Dashboard,
                  Campañas, etc.). Las marcadas "Solo admin" quedan reservadas para administradores.
                </p>
              )}

              {customPerms && selectedPerms.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Si no seleccionás ninguna sección, el usuario no verá opciones en el menú (solo podrá editar su perfil).
                </p>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <p className="text-xs text-gray-400">
                Los cambios se aplican cuando el usuario actualiza la página o vuelve a iniciar sesión.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {customPerms && (
                  <button
                    type="button"
                    onClick={() => { setCustomPerms(false); setSelectedPerms(ROLE_DEFAULT_PERMISSIONS[permsUser.role] || []); }}
                    className="btn-outline flex items-center justify-center gap-2 sm:mr-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar por defecto
                  </button>
                )}
                <button type="button" onClick={() => { setShowPermsModal(false); setPermsUser(null); }} className="btn-secondary flex-1">Cancelar</button>
                <button
                  type="button"
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="btn-primary flex-1"
                >
                  {savingPerms ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Permisos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && detailUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{detailUser.firstName} {detailUser.lastName}</h2>
                  <p className="text-sm text-gray-500">DNI: {detailUser.dni}</p>
                </div>
              </div>
              <button onClick={() => { setShowDetailModal(false); setDetailUser(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Puntos Actuales</p>
                  <p className="text-2xl font-bold text-primary-600">{formatNumber(detailUser.clientProfile?.currentPoints || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Ganados</p>
                  <p className="text-2xl font-bold text-green-600">{formatNumber(detailUser.clientProfile?.totalPointsEarned || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Canjeados</p>
                  <p className="text-2xl font-bold text-red-600">{formatNumber(detailUser.clientProfile?.totalPointsRedeemed || 0)}</p>
                </div>
              </div>
              
              {detailUser.branch && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Sucursal Asignada
                  </h3>
                  <p className="text-gray-700">{detailUser.branch.name} ({detailUser.branch.code})</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Últimos Movimientos (Ventas realizadas por este usuario)
                </h3>
                
                {(detailUser.recentTransactions ?? []).length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay ventas registradas realizadas por este usuario</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {(detailUser.recentTransactions ?? []).map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={cn('badge', tx.type === 'COMPRA' ? 'badge-success' : tx.type === 'CANJE' ? 'badge-warning' : 'badge-info')}>
                              {tx.type === 'COMPRA' ? 'Venta' : tx.type === 'CANJE' ? 'Canje' : 'Ajuste'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">{formatDateTime(tx.createdAt)}</p>
                              <p className="text-sm text-gray-500">
                                {tx.type === 'COMPRA' ? `Venta de ${tx.items?.length || 0} productos` : 
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
                            <p className="text-xs text-gray-400">Total: {tx.items?.reduce((s, i) => s + i.lineTotal, 0) || 0}</p>
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

export default AdminUsers;