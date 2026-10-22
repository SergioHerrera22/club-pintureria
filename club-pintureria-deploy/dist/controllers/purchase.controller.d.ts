import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const createPurchase: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPurchaseById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPurchases: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const cancelPurchase: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=purchase.controller.d.ts.map