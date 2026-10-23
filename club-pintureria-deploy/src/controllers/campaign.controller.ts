import { Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { SystemConfigService } from '../services/systemConfig.service';
import { AuthRequest } from '../middleware/auth';

/**
 * Lee el filtro de sucursal (query o body). undefined/string vacío = todas.
 */
const readBranchId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export const getRecipients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await CampaignService.getRecipients(readBranchId(req.query.branchId));
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getTemplates = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const templates = await SystemConfigService.getWhatsappTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
};

export const sendCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, sendToAll, recipientIds, testPhone } = req.body;
    const result = await CampaignService.sendCampaign({
      message, sendToAll, recipientIds, testPhone,
      branchId: readBranchId(req.body.branchId),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const prepareCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, sendToAll, recipientIds, testPhone } = req.body;
    const result = await CampaignService.prepareCampaign({
      message, sendToAll, recipientIds, testPhone,
      branchId: readBranchId(req.body.branchId),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Inicia una campaña persistiéndola (registro + un entregable por cliente). */
export const startCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, sendToAll, recipientIds, testPhone, audience, maxFaltan, days } = req.body;
    const result = await CampaignService.startCampaign(
      {
        message, sendToAll, recipientIds, testPhone,
        branchId: readBranchId(req.body.branchId),
        audience,
        maxFaltan,
        days,
      },
      req.user?.id
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/** Audiencias automáticas (cercanía a premio / resumen semanal). */
export const getAudience = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const kind = String(req.params.kind);
    if (kind !== 'near_prize' && kind !== 'weekly_summary') {
      res.status(400).json({ error: 'Audiencia desconocida' });
      return;
    }
    const rawMaxFaltan = Number(req.query.maxFaltan);
    const rawDays = Number(req.query.days);
    const result = await CampaignService.getAudience(kind, {
      branchId: readBranchId(req.query.branchId),
      maxFaltan: Number.isFinite(rawMaxFaltan) && rawMaxFaltan > 0 ? rawMaxFaltan : undefined,
      days: Number.isFinite(rawDays) && rawDays > 0 ? rawDays : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Campañas sin terminar, para retomar el envío desde donde quedó. */
export const getActiveCampaigns = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaigns = await CampaignService.getActiveCampaigns();
    res.json({ campaigns });
  } catch (error) {
    next(error);
  }
};

/** Progreso de una campaña + destinatarios pendientes (para retomar). */
export const getCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await CampaignService.getCampaign(String(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Marca un destinatario como enviado/omitido (idempotente). */
export const ackDelivery = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { clientId, status, reason } = req.body;
    const result = await CampaignService.ackDelivery(String(req.params.id), clientId, status, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Descarta una campaña sin terminar. */
export const cancelCampaign = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await CampaignService.cancelCampaign(String(req.params.id));
    res.json({ message: 'Campaña descartada' });
  } catch (error) {
    next(error);
  }
};
