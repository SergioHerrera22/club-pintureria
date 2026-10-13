import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Shield } from 'lucide-react';

const brandSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  code: z.string().min(1, 'Código requerido'),
  description: z.string().optional(),
  logoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
});

type BrandForm = z.infer<typeof brandSchema>;

interface Brand {
  id: string;
  name: string;
  code: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export default function Brands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [search, setSearch] = useState('');

  const form = useForm<BrandForm>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      logoUrl: '',
    },
  });

const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ brands: Brand[]; pagination: any }>('/brands?limit=100');
      setBrands(res.data.brands);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: BrandForm) => {
    setSaving(true);
    try {
      const payload = { ...data, logoUrl: data.logoUrl || undefined };
      if (editingBrand) {
        await api.put(`/brands/${editingBrand.id}`, payload);
      } else {
        await api.post('/brands', payload);
      }
      setShowModal(false);
      setEditingBrand(null);
      form.reset();
      fetchData();
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta marca?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/brands/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    form.reset({
      name: brand.name,
      code: brand.code,
      description: brand.description || '',
      logoUrl: brand.logoUrl || '',
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingBrand(null);
    form.reset({ name: '', code: '', description: '', logoUrl: '' });
    setShowModal(true);
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marcas</h1>
          <p className="text-gray-500">Catálogo de marcas disponibles</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Marca
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar marcas..."
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
                  <th className="p-4 font-medium">Logo</th>
                  <th className="p-4 font-medium">Descripción</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm text-gray-900">{brand.code}</td>
                    <td className="p-4 font-medium text-gray-900">{brand.name}</td>
                    <td className="p-4">
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.name} className="w-10 h-10 object-contain rounded" />
                      ) : (
                        <span className="text-gray-400">Sin logo</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 max-w-xs truncate">{brand.description || '-'}</td>
                    <td className="p-4">
                      <span className={cn('badge', brand.isActive ? 'badge-success' : 'badge-gray')}>
                        {brand.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(brand)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(brand.id)}
                          disabled={deletingId === brand.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Eliminar"
                        >
                          {deletingId === brand.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredBrands.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron marcas</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingBrand ? 'Editar Marca' : 'Nueva Marca'}</h2>
              <button onClick={() => { setShowModal(false); setEditingBrand(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Código</label>
                <input {...form.register('code')} className="input" disabled={!!editingBrand} />
                {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={2} className="input" />
              </div>
              <div>
                <label className="label">URL Logo (opcional)</label>
                <input {...form.register('logoUrl')} type="url" className="input" placeholder="https://..." />
                {form.formState.errors.logoUrl && <p className="text-sm text-red-600 mt-1">{form.formState.errors.logoUrl.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingBrand(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}