import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as prizeController from '../controllers/prize.controller';
import { authenticate, authorize, authorizeWithPermission, requireMenuPermission } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, prizeController.getPrizes);
router.get('/:id', authenticate, prizeController.getPrizeById);

router.post('/', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    pointsCost: z.number().int().positive(),
    stock: z.number().int().nonnegative().default(0),
    category: z.string().min(1),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
  }),
})), prizeController.createPrize);

router.put('/:id', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    pointsCost: z.number().int().positive().optional(),
    stock: z.number().int().nonnegative().optional(),
    category: z.string().optional(),
    status: z.enum(['DISPONIBLE', 'AGOTADO', 'DESCONTINUADO']).optional(),
    isActive: z.boolean().optional(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
  }),
  params: z.object({ id: z.string() }),
})), prizeController.updatePrize);

router.delete('/:id', authenticate, authorize('ADMIN'), prizeController.deletePrize);

router.post('/redeem', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'premios'), requireMenuPermission('premios'), validate(z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
    prizeId: z.string(),
  }),
})), prizeController.redeemPrize);

router.get('/available/:dni', prizeController.getAvailablePrizes);
router.post('/redeem/client', validate(z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
    prizeId: z.string(),
  }),
})), prizeController.redeemPrizeByClient);

router.get('/redemptions/history', authenticate, authorize('ADMIN'), prizeController.getRedemptions);

export default router;