import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { cn } from '../lib/utils';
import { ArrowLeft, MapPin, Briefcase, Palette, Save, Loader2, Award, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface ProfessionalProfile {
  id?: string;
  specialty: string;
  company: string;
  position: string;
  location: string;
  phone: string;
  website: string;
  socialMedia: Record<string, string>;
  preferredBrands: string[];
  preferredCategories: string[];
}

const specialties = [
  { value: 'AUTOMOTOR', label: 'Pintor Automotor', icon: '🚗' },
  { value: 'OBRA', label: 'Pintor de Obra', icon: '🏗️' },
  { value: 'INDUSTRIAL', label: 'Pintor Industrial', icon: '🏭' },
  { value: 'ARQUITECTO', label: 'Arquitecto', icon: '📐' },
  { value: 'CONSTRUCTOR', label: 'Constructor', icon: '👷' },
  { value: 'OTRO', label: 'Otro', icon: '📋' },
];

const brands = [
  'Sherwin Williams', 'PPG', 'AkzoNobel', 'Sikkens', 'Alba', 'Tersuave', 
  'Lumen', 'Eterna', 'Suvinil', 'Coral', 'Alpina', 'Dulux', 'Otro'
];

const categories = [
  'Barnices', 'Bases Agua', 'Catalizadores', 'Diluyentes', 
  'Masillas', 'Aparejos', 'Limpieza', 'Herramientas', 'Accesorios'
];

export default function ClientProfessional() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProfile();
  }, [isAuthenticated]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await api.get('/client/professional');
      setProfile(response.data.profile);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al cargar perfil');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/client/professional', {
        specialty: formData.specialty,
        company: formData.company,
        position: formData.position,
        location: formData.location,
        phone: formData.phone,
        website: formData.website,
        socialMedia: formData.socialMedia,
        preferredBrands: formData.preferredBrands,
        preferredCategories: formData.preferredCategories,
      });
      setSuccess('Perfil guardado correctamente');
      fetchProfile();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const [formData, setFormData] = useState<ProfessionalProfile>({
    specialty: '',
    company: '',
    position: '',
    location: '',
    phone: '',
    website: '',
    socialMedia: {},
    preferredBrands: [],
    preferredCategories: [],
  });

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'preferredBrands' | 'preferredCategories', item: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Perfil Profesional</h1>
                  <p className="text-sm text-gray-500">Información de tu actividad profesional</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-6" />
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/app/home')} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Perfil Profesional</h1>
                <p className="text-sm text-gray-500">Configura tu información profesional</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
{(error || success) && (
            <div className={cn(
              'mb-6 p-4 rounded-xl flex items-center gap-3',
              error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'
            )}>
            {error && <AlertCircle className="w-5 h-5" />}
            {success && <CheckCircle className="w-5 h-5" />}
            <span>{error || success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Especialidad */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-600" />
              Especialidad
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {specialties.map(s => (
                <button
                  type="button"
                  onClick={() => handleChange('specialty', s.value)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-center transition-all',
                    formData.specialty === s.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                  )}
                >
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-sm font-medium">{s.label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Empresa y Cargo */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              Empresa y Cargo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Empresa</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  className="input"
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div>
                <label className="label">Cargo / Posición</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  className="input"
                  placeholder="Ej: Pintor Senior, Gerente, Dueño"
                />
              </div>
            </div>
          </section>

          {/* Ubicación y Contacto */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Ubicación y Contacto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Localidad / Ciudad</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="input"
                  placeholder="Ej: Buenos Aires, Córdoba, Rosario"
                />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="input"
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Sitio Web</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className="input"
                  placeholder="https://tusitio.com"
                />
              </div>
              <div>
                <label className="label">Redes Sociales (JSON)</label>
                <textarea
                  value={JSON.stringify(formData.socialMedia, null, 2)}
                  onChange={(e) => {
                    try {
                      handleChange('socialMedia', JSON.parse(e.target.value));
                    } catch {
                      // Ignore invalid JSON
                    }
                  }}
                  className="input font-mono text-sm"
                  rows={3}
                  placeholder='{"instagram": "@tupintor", "facebook": "tupintor"}'
                />
              </div>
            </div>
          </section>

          {/* Marcas Preferidas */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Marcas Preferidas
            </h2>
            <p className="text-sm text-gray-500 mb-4">Selecciona las marcas que más utilizas o recomiendas</p>
            <div className="flex flex-wrap gap-2">
              {brands.map(brand => (
                <button
                  type="button"
                  onClick={() => toggleArrayItem('preferredBrands', brand)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    formData.preferredBrands.includes(brand)
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                  )}
                >
                  {brand}
                </button>
              ))}
            </div>
          </section>

          {/* Categorías Preferidas */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Categorías de Interés
            </h2>
            <p className="text-sm text-gray-500 mb-4">Selecciona las categorías de productos que más trabajas</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  type="button"
                  onClick={() => toggleArrayItem('preferredCategories', cat)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    formData.preferredCategories.includes(cat)
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Guardar */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/app/home')}
              className="flex-1 btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}