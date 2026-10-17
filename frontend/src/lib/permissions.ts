/**
 * Definición única de las secciones del menú lateral y sus permisos.
 * La usan el Layout (para mostrar/ocultar), App.tsx (protección de rutas)
 * y AdminUsers (para editar los permisos por usuario).
 */
export interface MenuItem {
  /** Clave del permiso (se guarda en User.permissions en la DB) */
  key: string;
  label: string;
  path: string;
  roles: string[];
}

export const MENU_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'CAJERA'] },
  { key: 'nuevo-cliente', label: 'Nuevo Cliente', path: '/nuevo-cliente', roles: ['ADMIN', 'CAJERA'] },
  { key: 'nuevo-cliente', label: 'Nuevo Cliente', path: '/vendedor/nuevo-cliente', roles: ['VENDEDOR'] },
  { key: 'clientes', label: 'Clientes', path: '/clients', roles: ['ADMIN', 'CAJERA', 'VENDEDOR'] },
  { key: 'ventas', label: 'Ventas', path: '/sales', roles: ['CAJERA'] },
  { key: 'usuarios', label: 'Usuarios', path: '/admin-users', roles: ['ADMIN'] },
  { key: 'campanas', label: 'Campañas WhatsApp', path: '/campaigns', roles: ['ADMIN', 'CAJERA'] },
  { key: 'productos', label: 'Productos', path: '/products', roles: ['ADMIN'] },
  { key: 'reglas-puntos', label: 'Reglas de Puntos', path: '/point-rules', roles: ['ADMIN'] },
  { key: 'premios', label: 'Premios', path: '/prizes', roles: ['ADMIN', 'CAJERA'] },
  { key: 'sucursales', label: 'Sucursales', path: '/branches', roles: ['ADMIN'] },
  { key: 'marcas', label: 'Marcas', path: '/brands', roles: ['ADMIN'] },
  { key: 'categorias', label: 'Categorías', path: '/categories', roles: ['ADMIN'] },
  { key: 'promociones', label: 'Promociones', path: '/promotions', roles: ['ADMIN', 'CAJERA'] },
  { key: 'cupones', label: 'Cupones', path: '/coupons', roles: ['ADMIN', 'CAJERA'] },
  { key: 'desafios', label: 'Desafíos', path: '/challenges', roles: ['ADMIN', 'CAJERA'] },
  { key: 'beneficios', label: 'Beneficios', path: '/benefits', roles: ['ADMIN', 'CAJERA'] },
  { key: 'configuracion', label: 'Configuración', path: '/system-config', roles: ['ADMIN'] },
];

/** Opciones para el modal de permisos (sin duplicar "Nuevo Cliente") */
export const MENU_PERMISSION_OPTIONS: Array<MenuItem & { description: string }> = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', roles: [], description: 'Estadísticas y reportes de ventas' },
  { key: 'nuevo-cliente', label: 'Nuevo Cliente', path: '/nuevo-cliente', roles: [], description: 'Dar de alta nuevos clientes' },
  { key: 'clientes', label: 'Clientes', path: '/clients', roles: [], description: 'Ver y editar clientes, ajustar puntos' },
  { key: 'ventas', label: 'Ventas', path: '/sales', roles: [], description: 'Registrar ventas y canjes' },
  { key: 'usuarios', label: 'Usuarios', path: '/admin-users', roles: [], description: 'Gestionar usuarios del sistema' },
  { key: 'campanas', label: 'Campañas WhatsApp', path: '/campaigns', roles: [], description: 'Enviar campañas de WhatsApp' },
  { key: 'productos', label: 'Productos', path: '/products', roles: [], description: 'Catálogo de productos' },
  { key: 'reglas-puntos', label: 'Reglas de Puntos', path: '/point-rules', roles: [], description: 'Configurar cómo se ganan puntos' },
  { key: 'premios', label: 'Premios', path: '/prizes', roles: [], description: 'Catálogo de premios y canjes' },
  { key: 'sucursales', label: 'Sucursales', path: '/branches', roles: [], description: 'Gestionar sucursales' },
  { key: 'marcas', label: 'Marcas', path: '/brands', roles: [], description: 'Catálogo de marcas' },
  { key: 'categorias', label: 'Categorías', path: '/categories', roles: [], description: 'Catálogo de categorías' },
  { key: 'promociones', label: 'Promociones', path: '/promotions', roles: [], description: 'Promociones y multiplicadores' },
  { key: 'cupones', label: 'Cupones', path: '/coupons', roles: [], description: 'Crear y asignar cupones' },
  { key: 'desafios', label: 'Desafíos', path: '/challenges', roles: [], description: 'Desafíos para clientes' },
  { key: 'beneficios', label: 'Beneficios', path: '/benefits', roles: [], description: 'Beneficios para clientes' },
  { key: 'configuracion', label: 'Configuración', path: '/system-config', roles: [], description: 'Configuración general del sistema' },
];

/**
 * Secciones que ve cada rol por defecto (cuando el usuario no tiene
 * permisos personalizados). Debe coincidir con los roles del menú.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  ADMIN: MENU_PERMISSION_OPTIONS.map((o) => o.key),
  CAJERA: ['dashboard', 'nuevo-cliente', 'clientes', 'ventas', 'campanas', 'premios', 'promociones', 'cupones', 'desafios', 'beneficios'],
  VENDEDOR: ['nuevo-cliente', 'clientes'],
  CLIENTE: [],
};

/**
 * Secciones que solo el ADMIN puede usar, aunque alguien le cargue el permiso.
 * Los permisos personalizados expanden al personal dentro de las secciones
 * de nivel cajera; no elevan a nadie a funciones de administración.
 */
export const ADMIN_ONLY_MENU_KEYS = new Set([
  'usuarios',
  'productos',
  'reglas-puntos',
  'sucursales',
  'marcas',
  'categorias',
  'configuracion',
]);

/**
 * Indica si un usuario puede ver una sección del menú.
 * - ADMIN: siempre (no se puede bloquear para no perder acceso al panel).
 * - Con permisos personalizados: solo las claves habilitadas.
 * - Sin permisos personalizados: los defaults de su rol.
 */
export function hasMenuPermission(
  user: { role: string; permissions?: string[] | null } | null | undefined,
  key: string
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (Array.isArray(user.permissions)) return user.permissions.includes(key);
  const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
  return defaults.includes(key);
}

/**
 * Home según rol Y permisos: devuelve la primera sección habilitada del menú.
 * Evita bucles de redirección cuando, por ejemplo, se le saca el Dashboard a
 * una cajera (getHomeForRole siempre mandaría a /dashboard).
 */
export function getHomeForUser(user?: { role: string; permissions?: string[] | null } | null): string {
  if (!user) return '/login';
  if (user.role === 'CLIENTE') return '/app/home';
  const custom = Array.isArray(user.permissions);
  for (const item of MENU_ITEMS) {
    // Con permisos personalizados el menú puede incluir secciones fuera del
    // rol por defecto (salvo las solo-admin), así que no se filtra por roles.
    if (!custom && !item.roles.includes(user.role)) continue;
    if (custom && ADMIN_ONLY_MENU_KEYS.has(item.key)) continue;
    if (!hasMenuPermission(user, item.key)) continue;
    return item.path;
  }
  return '/profile';
}
