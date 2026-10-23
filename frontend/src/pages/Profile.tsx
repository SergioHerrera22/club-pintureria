import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import { User, Mail, Phone, Calendar, Lock, Save, Loader2, CheckCircle } from 'lucide-react';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function Profile() {
  const { toast } = useToast();
  const { user, updateProfile, changePassword, refreshUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      birthDate: user?.birthDate ? user.birthDate.split('T')[0] : '',
    },
  });
  
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  
  const handleProfileSubmit = async (data: ProfileForm) => {
    setSaving(true);
    setSuccess('');
    try {
      await updateProfile(data);
      await refreshUser();
      setSuccess('Perfil actualizado correctamente');
    } catch (err: any) {
      setSuccess('');
      toast('error', err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };
  
  const handlePasswordSubmit = async (data: PasswordForm) => {
    setSaving(true);
    setSuccess('');
    try {
      await changePassword(data.currentPassword, data.newPassword);
      passwordForm.reset();
      setSuccess('Contraseña cambiada correctamente');
    } catch (err: any) {
      setSuccess('');
      toast('error', err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500">Gestiona tu información personal y seguridad</p>
      </div>
      
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('profile')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'profile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Información Personal
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'password'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Cambiar Contraseña
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {success && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}
          
          {activeTab === 'profile' && (
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="label flex items-center gap-1">
                    <User className="w-4 h-4" /> Nombre
                  </label>
                  <input {...profileForm.register('firstName')} id="firstName" className="input" disabled={saving} />
                  {profileForm.formState.errors.firstName && <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <label htmlFor="lastName" className="label flex items-center gap-1">
                    <User className="w-4 h-4" /> Apellido
                  </label>
                  <input {...profileForm.register('lastName')} id="lastName" className="input" disabled={saving} />
                  {profileForm.formState.errors.lastName && <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.lastName.message}</p>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="label flex items-center gap-1">
                    <Phone className="w-4 h-4" /> Teléfono
                  </label>
                  <input {...profileForm.register('phone')} id="phone" type="tel" className="input" disabled={saving} />
                </div>
                <div>
                  <label htmlFor="birthDate" className="label flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Fecha de Nacimiento
                  </label>
                  <input {...profileForm.register('birthDate')} id="birthDate" type="date" className="input" disabled={saving} />
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Información de solo lectura:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Email</p>
                    <p className="font-medium flex items-center gap-1"><Mail className="w-4 h-4" /> {user?.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">DNI</p>
                    <p className="font-medium">{user?.dni}</p>
                  </div>
                </div>
              </div>
              
              <button type="submit" disabled={saving} className="w-full btn-primary">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} Guardar Cambios
              </button>
            </form>
          )}
          
          {activeTab === 'password' && (
            <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="label flex items-center gap-1">
                  <Lock className="w-4 h-4" /> Contraseña Actual
                </label>
                <input {...passwordForm.register('currentPassword')} id="currentPassword" type="password" className="input" disabled={saving} />
                {passwordForm.formState.errors.currentPassword && <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>}
              </div>
              <div>
                <label htmlFor="newPassword" className="label flex items-center gap-1">
                  <Lock className="w-4 h-4" /> Nueva Contraseña
                </label>
                <input {...passwordForm.register('newPassword')} id="newPassword" type="password" className="input" disabled={saving} />
                {passwordForm.formState.errors.newPassword && <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="label flex items-center gap-1">
                  <Lock className="w-4 h-4" /> Confirmar Nueva Contraseña
                </label>
                <input {...passwordForm.register('confirmPassword')} id="confirmPassword" type="password" className="input" disabled={saving} />
                {passwordForm.formState.errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>}
              </div>
              
              <button type="submit" disabled={saving} className="w-full btn-primary">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} Cambiar Contraseña
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}