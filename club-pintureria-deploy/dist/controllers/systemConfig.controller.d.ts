import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getSystemConfigs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getSystemConfigByKey: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateSystemConfig: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteSystemConfig: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const initializeDefaultConfigs: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=systemConfig.controller.d.ts.map