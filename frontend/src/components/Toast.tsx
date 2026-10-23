import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void }>({
  toast: () => {},
});

/**
 * Hook para mostrar notificaciones flotantes:
 *   const { toast } = useToast();
 *   toast('success', 'Guardado');
 *   toast('error', 'Error al guardar');
 */
export const useToast = () => useContext(ToastContext);

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const ICON_STYLES: Record<ToastKind, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
};

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = ++toastId;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-none">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2 border rounded-lg shadow-lg p-3 text-sm animate-[slideUp_0.2s_ease-out]',
                STYLES[item.kind]
              )}
              role="alert"
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', ICON_STYLES[item.kind])} />
              <span className="flex-1">{item.message}</span>
              <button
                onClick={() => dismiss(item.id)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
