import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const listClients: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateClient: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteClient: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getClientDetail: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const findClientByDni: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createClient: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const registerPurchase: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getClientHistory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const registerQuickPurchase: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getClientPoints: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=client.controller.d.ts.map