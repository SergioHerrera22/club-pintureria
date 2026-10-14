import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as campaignController from '../controllers/campaign.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'CAJERA'));

router.get('/recipients', campaignController.getRecipients);
router.get('/templates', campaignController.getTemplates);

const sendCampaignSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'El mensaje es requerido'),
    sendToAll: z.boolean().optional(),
    recipientIds: z.array(z.string()).optional(),
    testPhone: z.string().optional(),
  }),
});

router.post('/send', validate(sendCampaignSchema), campaignController.sendCampaign);
router.post('/prepare', validate(sendCampaignSchema), campaignController.prepareCampaign);

export default router;
