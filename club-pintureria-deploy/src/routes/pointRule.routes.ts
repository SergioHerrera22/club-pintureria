import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as pointRuleController from '../controllers/pointRule.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const createRuleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['POR_MONTO', 'POR_PRODUCTO', 'POR_CATEGORIA', 'PRIMERA_COMPRA', 'CUMPLEANOS', 'RANGO_MONTO']),
    config: z.record(z.unknown()).optional(),
    priority: z.number().int().default(0),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  }),
});

const updateRuleSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(['POR_MONTO', 'POR_PRODUCTO', 'POR_CATEGORIA', 'PRIMERA_COMPRA', 'CUMPLEANOS', 'RANGO_MONTO']).optional(),
    config: z.record(z.unknown()).optional(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  }),
  params: z.object({ id: z.string() }),
});

// GET - CAJERA and ADMIN can view
router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), pointRuleController.getPointRules);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), pointRuleController.getPointRuleById);

// POST/PUT/DELETE - ADMIN only
router.post('/', authenticate, authorize('ADMIN'), validate(createRuleSchema), pointRuleController.createPointRule);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateRuleSchema), pointRuleController.updatePointRule);
router.delete('/:id', authenticate, authorize('ADMIN'), pointRuleController.deletePointRule);

export default router;