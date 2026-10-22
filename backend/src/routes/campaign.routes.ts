import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as campaignController from '../controllers/campaign.controller';
import { authenticate, authorizeWithPermission, requireMenuPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorizeWithPermission(['ADMIN', 'CAJERA'], 'campanas'));

router.get('/recipients', campaignController.getRecipients);
router.get('/templates', campaignController.getTemplates);

const sendCampaignSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'El mensaje es requerido'),
    sendToAll: z.boolean().optional(),
    recipientIds: z.array(z.string()).optional(),
    testPhone: z.string().optional(),
    branchId: z.string().optional(),
  }),
});

router.post('/send', requireMenuPermission('campanas'), validate(sendCampaignSchema), campaignController.sendCampaign);
router.post('/prepare', requireMenuPermission('campanas'), validate(sendCampaignSchema), campaignController.prepareCampaign);

export default router;
