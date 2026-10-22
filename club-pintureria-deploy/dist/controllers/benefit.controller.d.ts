import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getBenefits: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getBenefitById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createBenefit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateBenefit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteBenefit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=benefit.controller.d.ts.map