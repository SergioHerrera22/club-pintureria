import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const generateTokens: (user: {
    id: string;
    email: string;
    role: string;
    dni: string;
    branchId?: string | null;
}) => {
    accessToken: string;
    refreshToken: string;
};
export declare const register: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMe: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const changePassword: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
/**
 * Recuperación de contraseña (empleados/admin). Siempre responde lo mismo para
 * no revelar si el correo existe; el enlace se envía sólo a usuarios activos
 * que no sean clientes (los clientes usan el portal /users).
 */
export declare const forgotPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/** Consumo del enlace: valida el token (un solo uso y no vencido) y guarda la clave nueva. */
export declare const resetPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map