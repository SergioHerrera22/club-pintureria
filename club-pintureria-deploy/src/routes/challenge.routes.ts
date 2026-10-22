import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as challengeController from '../controllers/challenge.controller';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';

const router = Router();

const challengeValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['CANTIDAD_PRODUCTOS', 'CANTIDAD_COMPRAS', 'MARCAS_DIFERENTES', 'CATEGORIAS_DIFERENTES', 'MONTO_ACUMULADO', 'FRECUENCIA_COMPRA']),
    target: z.number().int().positive(),
    condition: z.record(z.unknown()),
    rewardPoints: z.number().int().nonnegative(),
    rewardCoupon: z.string().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().optional(),
  }),
});

const updateChallengeValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['CANTIDAD_PRODUCTOS', 'CANTIDAD_COMPRAS', 'MARCAS_DIFERENTES', 'CATEGORIAS_DIFERENTES', 'MONTO_ACUMULADO', 'FRECUENCIA_COMPRA']).optional(),
    target: z.number().int().positive().optional(),
    condition: z.record(z.unknown()).optional(),
    rewardPoints: z.number().int().nonnegative().optional(),
    rewardCoupon: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'desafios'), challengeController.getChallenges);
router.get('/:id', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'desafios'), challengeController.getChallengeById);
router.post('/', authenticate, authorize('ADMIN'), validate(challengeValidation), challengeController.createChallenge);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateChallengeValidation), challengeController.updateChallenge);
router.delete('/:id', authenticate, authorize('ADMIN'), challengeController.deleteChallenge);

export default router;