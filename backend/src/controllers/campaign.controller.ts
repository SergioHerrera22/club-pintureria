import { Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';
import { SystemConfigService } from '../services/systemConfig.service';
import { AuthRequest } from '../middleware/auth';

export const getRecipients = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await CampaignService.getRecipients();
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
    const result = await CampaignService.sendCampaign({ message, sendToAll, recipientIds, testPhone });
    res.json(result);
  } catch (error) {
    next(error);
  }
};
