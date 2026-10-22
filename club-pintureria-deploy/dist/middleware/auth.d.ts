import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: UserRole;
        dni: string;
        firstName: string;
        lastName: string;
        branchId: string | null;
        /** Permisos de menú personalizados. null/undefined = usar los del rol. */
        permissions: string[] | null;
    };
}
export declare const NO_BRANCH = "__NO_BRANCH__";
/**
 * Resuelve el scope de sucursal para el usuario autenticado.
 * - ADMIN: ve todo (scope global, isGlobal=true, branchId null).
 * - CAJERA/VENDEDOR: solo datos de su propia sucursal.
 * - Sin sucursal asignada: no ve datos de nadie (sentinel NO_BRANCH).
 */
export declare const resolveBranchScope: (user?: {
    role: UserRole;
    branchId: string | null;
}) => {
    isGlobal: boolean;
    branchId: string | null;
};
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authorize: (...allowedRoles: UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Como authorize(), pero permite además el acceso a un usuario con
 * permisos personalizados que incluyan alguna de las secciones indicadas.
 * Así el admin puede otorgar a un vendedor acceso a secciones de nivel
 * cajera (ej: Clientes, Ventas, Dashboard) sin cambiarle el rol.
 * - El rol por defecto pasa siempre (luego requireMenuPermission puede
 *   bloquear si tiene permisos personalizados que excluyen la sección).
 * - CLIENTE nunca pasa por aquí.
 */
export declare const authorizeWithPermission: (allowedRoles: UserRole[], ...permissionKeys: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Indica si el usuario tiene habilitada una sección del menú.
 * - ADMIN: siempre true (no se puede bloquear para no perder acceso al panel).
 * - Sin permisos personalizados (permissions null): true (usa los defaults del rol).
 * - Con permisos personalizados: true solo si la clave está en la lista.
 */
export declare const hasMenuPermission: (user?: AuthRequest["user"], ...keys: string[]) => boolean;
/**
 * Bloquea la acción si el usuario tiene permisos personalizados y ninguno
 * de las claves indicadas está habilitado. ADMIN y usuarios sin
 * personalización pasan siempre.
 */
export declare const requireMenuPermission: (...keys: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Variante para módulos donde las lecturas (GET) se usan desde varias
 * pantallas: solo exige el permiso para métodos de escritura.
 */
export declare const requireMenuPermissionForWrite: (...keys: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Para rutas públicas/semi-públicas (ej. POST /auth/register con optionalAuth):
 * si el que llama es un empleado autenticado con permisos personalizados,
 * exige que alguna de las claves esté habilitada. Los anónimos pasan.
 */
export declare const requireStaffMenuPermission: (...keys: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map