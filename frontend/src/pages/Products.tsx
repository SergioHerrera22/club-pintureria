import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatCurrency } from '../lib/utils';
import { Plus, Search, Edit, Trash2, Loader2, Package, PlusCircle } from 'lucide-react';

const productSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  category: z.string().min(1, 'Categoría requerida'),
  brand: z.string().optional(),
  unitPrice: z.number().positive('Precio debe ser mayor a 0'),
});

type ProductForm = z.infer<typeof productSchema>;

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  unitPrice: number;
  isActive: boolean;
  imageUrl?: string | null;
}

interface ImageCandidate {
  image: string;
  thumbnail: string;
  width: number;
  height: number;
  title: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  // Foto del producto: búsqueda en internet + elección entre candidatas
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [imagesWarning, setImagesWarning] = useState('');
  const [imagesLoading, setImagesLoading] = useState(false);
  
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: '',
      brand: '',
      unitPrice: 0,
    },
  });
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get<{ products: Product[]; pagination: any }>('/products?limit=100'),
        api.get<{ name: string }[]>('/products/categories'),
      ]);
      setProducts(productsRes.data.products);
      setCategories(categoriesRes.data.map(c => c.name));
    } catch {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (data: ProductForm) => {
    setSaving(true);
    try {
      // La URL elegida del buscador se descarga y guarda en el servidor al guardar
      const payload = { ...data, imageUrl: newImageUrl ?? null };
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowModal(false);
      setEditingProduct(null);
      form.reset();
      setNewImageUrl(null);
      setImageCandidates([]);
      setImagesWarning('');
      fetchData();
    } catch {
      // Error saving product
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch {
      // Error deleting product
    } finally {
      setDeletingId(null);
    }
  };
  
  const openEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      code: product.code,
      name: product.name,
      description: product.description || '',
      category: product.category,
      brand: product.brand || '',
      unitPrice: product.unitPrice,
    });
    setNewImageUrl(product.imageUrl ?? null);
    setImageCandidates([]);
    setImagesWarning('');
    setShowModal(true);
    // Si el producto todavía no tiene foto, buscar automáticamente al abrir
    if (!product.imageUrl) {
      setTimeout(() => { maybeAutoSearchImage(); }, 50);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    form.reset({ code: '', name: '', description: '', category: '', brand: '', unitPrice: 0 });
    setNewImageUrl(null);
    setImageCandidates([]);
    setImagesWarning('');
    setShowModal(true);
  };

  const handleSearchImages = async () => {
    const values = form.getValues();
    const name = (values.name || '').trim();
    const brand = (values.brand || '').trim();
    const category = (values.category || '').trim();
    if (name.length < 3 && brand.length < 3) {
      setImagesWarning('Completá al menos el nombre del producto para buscar su foto');
      return;
    }
    const q = [name, brand, category].filter(Boolean).join(' ');
    setImagesLoading(true);
    setImagesWarning('');
    setImageCandidates([]);
    try {
      const res = await api.get<{ candidates: ImageCandidate[]; warning?: string }>(
        `/products/image-candidates?q=${encodeURIComponent(q)}`
      );
      setImageCandidates(res.data.candidates);
      if (res.data.warning) setImagesWarning(res.data.warning);
    } catch {
      setImagesWarning('La búsqueda de internet no está disponible; podés pegar una URL de foto a mano');
    } finally {
      setImagesLoading(false);
    }
  };

  // Búsqueda automática: al salir del nombre/marca (si no hay foto elegida todavía)
  const maybeAutoSearchImage = () => {
    if (newImageUrl || imagesLoading || imageCandidates.length > 0) return;
    const values = form.getValues();
    if (((values.name || '').trim().length >= 4 || (values.brand || '').trim().length >= 3)) {
      handleSearchImages();
    }
  };
  
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500">Catálogo de productos para repintado automotriz</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </button>
      </div>
      
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
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
                  <th className="p-4 font-medium">Foto</th>
                  <th className="p-4 font-medium">Código</th>
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Categoría</th>
                  <th className="p-4 font-medium">Marca</th>
                  <th className="p-4 font-medium text-right">Precio</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-sm text-gray-900">{product.code}</td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      {product.description && <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>}
                    </td>
                    <td className="p-4">
                      <span className="badge badge-gray">{product.category}</span>
                    </td>
                    <td className="p-4 text-gray-500">{product.brand || '-'}</td>
                    <td className="p-4 text-right font-medium text-gray-900">{formatCurrency(product.unitPrice)}</td>
                    <td className="p-4">
                      <span className={cn('badge', product.isActive ? 'badge-success' : 'badge-gray')}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Eliminar"
                        >
                          {deletingId === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {filteredProducts.length === 0 && !loading && (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No se encontraron productos</p>
          </div>
        )}
      </div>
      
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button onClick={() => { setShowModal(false); setEditingProduct(null); form.reset(); }} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Código</label>
                  <input {...form.register('code')} className="input" disabled={!!editingProduct} />
                  {form.formState.errors.code && <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>}
                </div>
<div>
                <label className="label">Categoría</label>
                <div className="relative">
                  <select 
                    {...form.register('category')} 
                    className="input pr-10 appearance-none"
                    onChange={(e) => form.setValue('category', e.target.value)}
                  >
                    <option value="">Seleccionar o escribir nueva...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <PlusCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                {form.formState.errors.category && <p className="text-sm text-red-600 mt-1">{form.formState.errors.category.message}</p>}
              </div>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input {...form.register('name')} onBlur={maybeAutoSearchImage} className="input" />
                {form.formState.errors.name && <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea {...form.register('description')} rows={2} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Marca</label>
                  <input {...form.register('brand')} onBlur={maybeAutoSearchImage} className="input" />
                </div>
                <div>
                  <label className="label">Precio Unitario</label>
                  <input {...form.register('unitPrice', { valueAsNumber: true })} type="number" step="0.01" min="0.01" className="input" />
                  {form.formState.errors.unitPrice && <p className="text-sm text-red-600 mt-1">{form.formState.errors.unitPrice.message}</p>}
                </div>
              </div>

              {/* Foto del producto: se busca en internet al escribir el nombre */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Foto del producto</label>
                  <button
                    type="button"
                    onClick={handleSearchImages}
                    disabled={imagesLoading}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
                  >
                    {imagesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar fotos
                  </button>
                </div>
                {(newImageUrl || imageCandidates.length > 0 || imagesWarning) && (
                  <div className="mt-2 space-y-2">
                    {imagesWarning && <p className="text-xs text-amber-600">{imagesWarning}</p>}
                    {newImageUrl && (
                      <div className="flex items-center gap-3">
                        <img
                          src={newImageUrl}
                          alt="Foto del producto"
                          className="w-16 h-16 object-contain border border-gray-200 rounded-lg bg-white"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                        <p className="text-xs text-gray-500">
                          {newImageUrl.startsWith('/uploads/')
                            ? 'Foto guardada en el servidor'
                            : 'Esta foto se va a descargar al servidor cuando guardes'}
                        </p>
                      </div>
                    )}
                    {imageCandidates.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Elegí la foto correcta del producto:</p>
                        <div className="grid grid-cols-4 gap-2">
                          {imageCandidates.map(c => (
                            <button
                              key={c.image}
                              type="button"
                              onClick={() => setNewImageUrl(c.image)}
                              title={c.title ? `${c.title} (${c.width}×${c.height})` : `${c.width}×${c.height}`}
                              className={cn(
                                'h-20 rounded-lg border bg-white flex items-center justify-center overflow-hidden p-1 transition-colors',
                                newImageUrl === c.image ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                              )}
                            >
                              <img src={c.thumbnail} alt="" className="max-h-full max-w-full object-contain" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setNewImageUrl(null)}
                      disabled={!newImageUrl}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-30"
                    >
                      Sin foto
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Se busca con el nombre, la marca y la categoría. Elegí la foto correcta: la que se ve puede ser de otra variante.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); form.reset(); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}