import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getCategories: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getCategoryTree: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getCategoryById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createCategory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateCategory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteCategory: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=category.controller.d.ts.map