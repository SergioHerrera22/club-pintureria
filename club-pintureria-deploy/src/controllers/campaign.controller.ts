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
