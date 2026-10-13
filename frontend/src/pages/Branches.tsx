import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Building, MapPin } from 'lucide-react';

const branchSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  code: z.string().min(1, 'Código requerido'),
  address: z.string().min(1, 'Dirección requerida'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type BranchForm = z.infer<typeof branchSchema>;

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const form = useForm<BranchForm>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ branches: Branch[]; pagination: any }>('/branches?limit=100');
      setBranches(res.data.branches);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: BranchForm) => {
    setSaving(true);
    setError('');
    try {
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, data);
      } else {
        await api.post('/branches', data);
      }
      setShowModal(false);
      setEditingBranch(null);
      form.reset();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta sucursal?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/branches/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setError('');
    form.reset({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      phone: branch.phone || '',
      email: branch.email || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingBranch(null);
    setError('');
    form.reset({ name: '', code: '', address: '', phone: '', email: '' });
    setShowModal(true);
  };

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sucursales</h1>
          <p className="text-gray-500">Gestión de sucursales y puntos de venta</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sucursal
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar sucursales..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 border-b border-gray-200">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-500">
                  <th className="p-4 font-medium">Código</th>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Dirección</th>
                  <th className="p-4 font-medium">Teléfono</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm text-gray-900">{branch.code}</td>
                    <td className="p-4 font-medium text-gray-900">{branch.name}</td>
                    <td className="p-4 text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {branch.address}
                    </td>
                    <td className="p-4 text-gray-500">{branch.phone || '-'}</td>
                    <td className="p-4 text-gray-500">{branch.email || '-'}</td>
                    <td className="p-4">
                      <span className={cn('badge', branch.isActive ? 'badge-success' : 'badge-gray')}>
                        {branch.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(branch)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(branch.id)}
                          disabled={deletingId === branch.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Eliminar"
                        >
                          {deletingId === branch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredBranches.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron sucursales</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
              <button onClick={() => { setShowModal(false); setEditingBranch(null); form.reset(); setError(''); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Código</label>
                <input {...form.register('code')} className="input" disabled={!!editingBranch} />
                {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
              </div>
              <div>
                <label className="label">Dirección</label>
                <input {...form.register('address')} className="input" />
                {form.formState.errors.address && <p className="text-sm text-red-600 mt-1">{form.formState.errors.address.message}</p>}
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input {...form.register('phone')} className="input" placeholder="+54 11 1234-5678" />
              </div>
              <div>
                <label className="label">Email</label>
                <input {...form.register('email')} type="email" className="input" placeholder="sucursal@empresa.com" />
                {form.formState.errors.email && <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingBranch(null); form.reset(); setError(''); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}