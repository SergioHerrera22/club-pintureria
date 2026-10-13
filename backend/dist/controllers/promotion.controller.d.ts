import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPromotions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPromotionById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createPromotion: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePromotion: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deletePromotion: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const activatePromotion: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deactivatePromotion: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const validatePromotion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=promotion.controller.d.ts.map