import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getChallenges: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getChallengeById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const createChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const updateChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const deleteChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=challenge.controller.d.ts.map