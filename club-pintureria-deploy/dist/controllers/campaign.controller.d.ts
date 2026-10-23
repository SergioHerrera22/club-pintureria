import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare const getRecipients: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getTemplates: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const sendCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const prepareCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Inicia una campaña persistiéndola (registro + un entregable por cliente). */
export declare const startCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Audiencias automáticas (cercanía a premio / resumen semanal). */
export declare const getAudience: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Campañas sin terminar, para retomar el envío desde donde quedó. */
export declare const getActiveCampaigns: (_req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Progreso de una campaña + destinatarios pendientes (para retomar). */
export declare const getCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Marca un destinatario como enviado/omitido (idempotente). */
export declare const ackDelivery: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/** Descarta una campaña sin terminar. */
export declare const cancelCampaign: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=campaign.controller.d.ts.map