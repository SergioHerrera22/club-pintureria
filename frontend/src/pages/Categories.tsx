import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, ChevronRight, Layers, Tag, ArrowUpDown } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  code: z.string().min(1, 'Código requerido'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  children?: Category[];
  createdAt: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      parentId: '',
      sortOrder: 0,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes] = await Promise.all([
        api.get<{ categories: Category[] }>('/categories/tree'),
        api.get<{ categories: Category[]; pagination: any }>('/categories?limit=200'),
      ]);
      setCategories(treeRes.data.categories);
      setAllCategories(flatRes.data.categories);
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: CategoryForm) => {
    setSaving(true);
    try {
      const payload = { ...data, parentId: data.parentId || undefined };
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      setShowModal(false);
      setEditingCategory(null);
      form.reset();
      fetchData();
    } catch {
      // Error saving
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría? Se eliminarán también las subcategorías.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/categories/${id}`);
      fetchData();
    } catch {
      // Error deleting
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      code: category.code,
      description: category.description || '',
      parentId: category.parentId || '',
      sortOrder: category.sortOrder,
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingCategory(null);
    form.reset({ name: '', code: '', description: '', parentId: '', sortOrder: 0 });
    setShowModal(true);
  };

  const filteredCategories = allCategories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const renderTree = (cats: Category[], level = 0) => (
    <div className="space-y-1">
      {cats.map((cat) => (
        <div key={cat.id} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {level > 0 && <div className="w-6" />}
            {cat.children && cat.children.length > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 flex-1 min-w-0">
              <Tag className={cn('w-4 h-4', cat.isActive ? 'text-primary-600' : 'text-gray-400')} />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{cat.name}</p>
                <p className="text-xs text-gray-500">{cat.code}</p>
              </div>
              <span className={cn('badge', cat.isActive ? 'badge-success' : 'badge-gray')}>
                {cat.isActive ? 'Activa' : 'Inactiva'}
              </span>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  aria-label="Editar"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  aria-label="Eliminar"
                >
                  {deletingId === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          {cat.children && cat.children.length > 0 && (
            <div className="ml-6 border-l border-gray-200 pl-2">
              {renderTree(cat.children, level + 1)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500">Jerarquía de categorías de productos</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Categoría
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar categorías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('tree')}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', viewMode === 'tree' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100')}
            >
              <Layers className="w-4 h-4 mr-1" /> Árbol
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors', viewMode === 'table' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100')}
            >
              <ArrowUpDown className="w-4 h-4 mr-1" /> Tabla
            </button>
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
        ) : viewMode === 'tree' ? (
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {categories.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No hay categorías configuradas</p>
              </div>
            ) : (
              renderTree(categories)
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-gray-500">
                  <th className="p-4 font-medium">Código</th>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Padre</th>
                  <th className="p-4 font-medium">Orden</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm text-gray-900">{cat.code}</td>
                    <td className="p-4 font-medium text-gray-900">{cat.name}</td>
                    <td className="p-4 text-gray-500">
                      {cat.parentId ? allCategories.find(p => p.id === cat.parentId)?.name || cat.parentId : '—'}
                    </td>
                    <td className="p-4 text-gray-500">{cat.sortOrder}</td>
                    <td className="p-4">
                      <span className={cn('badge', cat.isActive ? 'badge-success' : 'badge-gray')}>
                        {cat.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deletingId === cat.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Eliminar"
                        >
                          {deletingId === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredCategories.length === 0 && !loading && viewMode === 'table' && (
          <div className="p-12 text-center text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron categorías</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button onClick={() => { setShowModal(false); setEditingCategory(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Código</label>
                <input {...form.register('code')} className="input" disabled={!!editingCategory} />
                {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={2} className="input" />
              </div>
              <div>
                <label className="label">Categoría Padre (opcional)</label>
                <select {...form.register('parentId')} className="input">
                  <option value="">Ninguna (categoría raíz)</option>
                  {allCategories
                    .filter(c => c.id !== editingCategory?.id)
                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Orden</label>
                <input type="number" {...form.register('sortOrder', { valueAsNumber: true })} className="input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingCategory(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}