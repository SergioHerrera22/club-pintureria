import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getBranches: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getBranchById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createBranch: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateBranch: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteBranch: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=branch.controller.d.ts.map