import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getCoupons: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getCouponById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createCoupon: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createBulkCoupons: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateCoupon: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteCoupon: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const validateCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const useCoupon: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const assignCoupon: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const assignBulkCoupons: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=coupon.controller.d.ts.map