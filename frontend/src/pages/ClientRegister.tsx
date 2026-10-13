import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../lib/api';
import { cn, formatNumber } from '../lib/utils';
import { UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const clientSchema = z.object({
  firstName: z.string().min(1, 'Requerido'),
  lastName: z.string().min(1, 'Requerido'),
  dni: z.string().min(7, 'DNI debe tener al menos 7 dígitos').max(8, 'DNI inválido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;

interface CreatedClient {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string;
  phone: string | null;
  clientProfile: { currentPoints: number } | null;
}

export default function ClientRegister() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedClient | null>(null);

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { firstName: '', lastName: '', dni: '', email: '', phone: '', birthDate: '' },
  });

  const onSubmit = async (data: ClientForm) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        dni: data.dni.replace(/[.\-\s]/g, ''),
        phone: data.phone || undefined,
        birthDate: data.birthDate || undefined,
        email: data.email ? data.email : undefined,
      };
      const response = await api.post<CreatedClient>('/clients', payload);
      setCreated(response.data);
      form.reset();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el cliente');
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cliente creado</h1>
            <p className="text-gray-500">
              {created.firstName} {created.lastName} fue registrado correctamente
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">DNI</p>
              <p className="font-mono font-medium text-gray-900">{created.dni}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Teléfono</p>
              <p className="font-medium text-gray-900">{created.phone || '-'}</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg col-span-2">
              <p className="text-xs text-primary-700">Puntos actuales</p>
              <p className="font-bold text-primary-700 text-lg">
                {formatNumber(created.clientProfile?.currentPoints || 0)}
              </p>
            </div>
          </div>
          <button onClick={() => setCreated(null)} className="btn-primary w-full flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" />
            Cargar otro cliente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
        <p className="text-gray-500">Registrá un nuevo cliente en el club de puntos</p>
      </div>

      <div className="card p-5 sm:p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre</label>
              <input {...form.register('firstName')} className={cn('input', form.formState.errors.firstName && 'border-red-300')} />
              {form.formState.errors.firstName && <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Apellido</label>
              <input {...form.register('lastName')} className={cn('input', form.formState.errors.lastName && 'border-red-300')} />
              {form.formState.errors.lastName && <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">DNI</label>
              <input {...form.register('dni')} inputMode="numeric" className={cn('input', form.formState.errors.dni && 'border-red-300')} />
              {form.formState.errors.dni && <p className="text-sm text-red-600 mt-1">{form.formState.errors.dni.message}</p>}
            </div>
            <div>
              <label className="label">Teléfono (WhatsApp)</label>
              <input {...form.register('phone')} inputMode="tel" placeholder="Ej: 1155551234" className="input" />
            </div>
          </div>

          <div>
            <label className="label">Email (opcional)</label>
            <input {...form.register('email')} type="email" placeholder="cliente@email.com" className={cn('input', form.formState.errors.email && 'border-red-300')} />
            {form.formState.errors.email && <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Fecha de Nacimiento (opcional)</label>
            <input {...form.register('birthDate')} type="date" className="input" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <UserPlus className="w-5 h-5" />
                Crear Cliente
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
