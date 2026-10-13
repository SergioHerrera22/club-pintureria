import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getBrands: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getBrandById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createBrand: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateBrand: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteBrand: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=brand.controller.d.ts.map