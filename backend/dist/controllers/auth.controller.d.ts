import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const register: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getMe: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const changePassword: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map