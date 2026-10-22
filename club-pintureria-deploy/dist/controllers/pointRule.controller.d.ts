import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getPointRules: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getPointRuleById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createPointRule: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updatePointRule: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deletePointRule: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=pointRule.controller.d.ts.map