import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPrizes: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPrizeById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createPrize: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePrize: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deletePrize: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const redeemPrize: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getRedemptions: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getAvailablePrizes: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const redeemPrizeByClient: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=prize.controller.d.ts.map