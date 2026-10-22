import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getRecipients: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getTemplates: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const sendCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const prepareCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=campaign.controller.d.ts.map