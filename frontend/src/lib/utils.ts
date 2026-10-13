import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-AR').format(num);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Administrador',
    CAJERA: 'Cajera',
    VENDEDOR: 'Vendedor',
    CLIENTE: 'Cliente',
  };
  return labels[role] || role;
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    CAJERA: 'bg-blue-100 text-blue-800',
    VENDEDOR: 'bg-amber-100 text-amber-800',
    CLIENTE: 'bg-green-100 text-green-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

export function getHomeForRole(role?: string): string {
  if (role === 'VENDEDOR') return '/vendedor/nuevo-cliente';
  if (role === 'CLIENTE') return '/app/home';
  return '/dashboard';
}

export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    COMPRA: 'Compra',
    CANJE: 'Canje',
    AJUSTE_MANUAL: 'Ajuste Manual',
    BONIFICACION: 'Bonificación',
    VENCIMIENTO: 'Vencimiento',
  };
  return labels[type] || type;
}
