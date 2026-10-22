import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getDashboardStats: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getSalesReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPointsReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getMovementsReport: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getBranchSummary: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getSalesByBranch: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getSalesByCashier: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getRecentPurchases: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=dashboard.controller.d.ts.map