import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getProducts: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getProductById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createProduct: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProduct: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteProduct: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getCategories: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=product.controller.d.ts.map