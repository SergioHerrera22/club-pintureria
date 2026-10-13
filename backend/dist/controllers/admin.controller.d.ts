import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getUsers: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getUserById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createUser: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateUser: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteUser: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const adjustPoints: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=admin.controller.d.ts.map