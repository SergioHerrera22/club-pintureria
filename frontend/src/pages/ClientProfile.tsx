import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../lib/api';
import { cn, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import ClientHeader from '../components/ClientHeader';
import { useAuthStore } from '../stores/authStore';
import {
  User, Mail, Phone, Calendar, Lock, Save, Loader2, Shield,
} from 'lucide-react';

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  createdAt: string;
}

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirm: string;
};

/** Perfil del cliente (/app/profile): editar datos y cambiar la contraseña. */
export default function ClientProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const profileForm = useForm<ProfileForm>();
  const passwordForm = useForm<PasswordForm>();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get<{ client: ClientData }>('/client/profile');
        setClient(res.data.client);
        profileForm.reset({
          firstName: res.data.client.firstName,
          lastName: res.data.client.lastName,
          email: res.data.client.email,
          phone: res.data.client.phone ?? '',
          birthDate: res.data.client.birthDate ? res.data.client.birthDate.slice(0, 10) : '',
        });
      } catch (err: any) {
        if (err.response?.status === 401) navigate('/users');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async (data: ProfileForm) => {
    try {
      const res = await api.put<{ client: ClientData; message: string }>('/client/profile', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        birthDate: data.birthDate,
      });
      setClient(res.data.client);
      await refreshUser();
      toast('success', 'Perfil actualizado');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const onSavePassword = async (data: PasswordForm) => {
    if (data.newPassword !== data.confirm) {
      toast('error', 'Las contraseñas no coinciden');
      return;
    }
    try {
      await api.put('/client/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset();
      toast('success', 'Contraseña actualizada');
    } catch (err: any) {
      toast('error', err.response?.data?.error || 'Error al cambiar la contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <ClientHeader title="Mi perfil" subtitle="Editá tus datos" backTo="/app/home" maxWidth="md" />

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : !client ? (
          <p className="text-center text-gray-500 py-12">No se pudo cargar tu perfil.</p>
        ) : (
          <>
            <div className="card p-4 text-sm text-gray-600 space-y-1">
              <p>
                <span className="text-gray-400">DNI:</span> <strong>{client.dni}</strong>
              </p>
              <p>
                <span className="text-gray-400">Socio desde:</span>{' '}
                <strong>{formatDate(client.createdAt)}</strong>
              </p>
            </div>

            {/* Datos personales */}
            <form
              onSubmit={profileForm.handleSubmit((d) => {
                setSavingProfile(true);
                onSaveProfile(d);
              })}
              className="card p-4 sm:p-5 space-y-4"
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" /> Mis datos
              </h2>

              <div>
                <label className="label" htmlFor="first-name">Nombre</label>
                <input
                  id="first-name"
                  className="input"
                  {...profileForm.register('firstName', { required: 'Ingresá tu nombre' })}
                />
                {profileForm.formState.errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="last-name">Apellido</label>
                <input
                  id="last-name"
                  className="input"
                  {...profileForm.register('lastName', { required: 'Ingresá tu apellido' })}
                />
                {profileForm.formState.errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{profileForm.formState.errors.lastName.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="profile-email">
                  <Mail className="w-4 h-4 inline mr-1" /> Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  className="input"
                  {...profileForm.register('email')}
                />
              </div>

              <div>
                <label className="label" htmlFor="profile-phone">
                  <Phone className="w-4 h-4 inline mr-1" /> Teléfono
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  className="input"
                  placeholder="Ej: 11 5555-1234"
                  {...profileForm.register('phone')}
                />
              </div>

              <div>
                <label className="label" htmlFor="birth-date">
                  <Calendar className="w-4 h-4 inline mr-1" /> Fecha de nacimiento
                </label>
                <input
                  id="birth-date"
                  type="date"
                  className="input"
                  {...profileForm.register('birthDate')}
                />
              </div>

              <button type="submit" disabled={savingProfile} className="btn-primary w-full py-2.5">
                {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Guardar cambios
              </button>
            </form>

            {/* Contraseña */}
            <form
              onSubmit={passwordForm.handleSubmit((d) => {
                setSavingPassword(true);
                onSavePassword(d);
              })}
              className="card p-4 sm:p-5 space-y-4"
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary-600" /> Cambiar contraseña
              </h2>

              <div>
                <label className="label" htmlFor="current-password">Contraseña actual</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  className="input"
                  {...passwordForm.register('currentPassword', { required: 'Ingresá tu contraseña actual' })}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="new-password">Nueva contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  {...passwordForm.register('newPassword', { required: 'Ingresá la nueva contraseña', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="confirm-password">Repetir nueva contraseña</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  {...passwordForm.register('confirm', { required: 'Repetí la nueva contraseña' })}
                />
                {passwordForm.formState.errors.confirm && (
                  <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.confirm.message}</p>
                )}
              </div>

              <button type="submit" disabled={savingPassword} className={cn('btn-outline w-full py-2.5')}>
                {savingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                Actualizar contraseña
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
