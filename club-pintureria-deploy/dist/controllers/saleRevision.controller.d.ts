import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getMyPurchases: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requestRevision: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getVendorsForSale: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const listRevisions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getMyRevisions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const approveRevision: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const rejectRevision: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=saleRevision.controller.d.ts.map