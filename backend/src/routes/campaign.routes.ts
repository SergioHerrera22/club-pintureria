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

const startCampaignSchema = sendCampaignSchema.extend({
  body: sendCampaignSchema.shape.body.extend({
    audience: z.enum(['near_prize', 'weekly_summary']).optional(),
    maxFaltan: z.number().int().positive().optional(),
    days: z.number().int().positive().max(90).optional(),
  }),
});

const ackDeliverySchema = z.object({
  body: z.object({
    clientId: z.string().min(1),
    status: z.enum(['ENVIADO', 'OMITIDO', 'ERROR']),
    reason: z.string().max(200).optional(),
  }),
});

router.post('/send', requireMenuPermission('campanas'), validate(sendCampaignSchema), campaignController.sendCampaign);
router.post('/prepare', requireMenuPermission('campanas'), validate(sendCampaignSchema), campaignController.prepareCampaign);
router.post('/start', requireMenuPermission('campanas'), validate(startCampaignSchema), campaignController.startCampaign);

// Rutas con path fijo antes de '/:id' para que no las coma el param.
router.get('/active', campaignController.getActiveCampaigns);
router.get('/audience/:kind', campaignController.getAudience);
router.get('/:id', campaignController.getCampaign);
router.post('/:id/ack', validate(ackDeliverySchema), campaignController.ackDelivery);
router.post('/:id/cancel', campaignController.cancelCampaign);

export default router;
