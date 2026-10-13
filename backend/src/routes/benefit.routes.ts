import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as benefitController from '../controllers/benefit.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const benefitValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['DESCUENTO_PORCENTUAL', 'ENVIO_GRATIS', 'MULTIPLICADOR_PUNTOS', 'PRODUCTO_BONIFICADO', 'ACCESO_ANTICIPADO', 'REGALO_CUMPLEANOS', 'ATENCION_PRIORITARIA']),
    value: z.number().positive(),
    isActive: z.boolean().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    autoApply: z.boolean().optional(),
  }),
});

const updateBenefitValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['DESCUENTO_PORCENTUAL', 'ENVIO_GRATIS', 'MULTIPLICADOR_PUNTOS', 'PRODUCTO_BONIFICADO', 'ACCESO_ANTICIPADO', 'REGALO_CUMPLEANOS', 'ATENCION_PRIORITARIA']).optional(),
    value: z.number().positive().optional(),
    isActive: z.boolean().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    autoApply: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), benefitController.getBenefits);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), benefitController.getBenefitById);
router.post('/', authenticate, authorize('ADMIN'), validate(benefitValidation), benefitController.createBenefit);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateBenefitValidation), benefitController.updateBenefit);
router.delete('/:id', authenticate, authorize('ADMIN'), benefitController.deleteBenefit);

export default router;