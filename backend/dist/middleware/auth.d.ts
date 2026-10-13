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
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map