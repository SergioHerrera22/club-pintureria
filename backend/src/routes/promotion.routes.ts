import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as promotionController from '../controllers/promotion.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const promotionValidation = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['DOBLE_PUNTOS', 'TRIPLE_PUNTOS', 'PUNTOS_EXTRA', 'DESCUENTO_PORCENTUAL', 'PRODUCTO_BONIFICADO', 'ENVIO_GRATIS']),
    multiplier: z.number().positive().optional(),
    bonusPoints: z.number().int().nonnegative().optional(),
    discount: z.number().positive().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    brands: z.array(z.string()).optional(),
    products: z.array(z.string()).optional(),
    conditions: z.record(z.unknown()).optional(),
  }),
});

const updatePromotionValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    type: z.enum(['DOBLE_PUNTOS', 'TRIPLE_PUNTOS', 'PUNTOS_EXTRA', 'DESCUENTO_PORCENTUAL', 'PRODUCTO_BONIFICADO', 'ENVIO_GRATIS']).optional(),
    multiplier: z.number().positive().optional(),
    bonusPoints: z.number().int().nonnegative().optional(),
    discount: z.number().positive().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    brands: z.array(z.string()).optional(),
    products: z.array(z.string()).optional(),
    conditions: z.record(z.unknown()).optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), promotionController.getPromotions);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), promotionController.getPromotionById);

router.post('/', authenticate, authorize('ADMIN'), validate(promotionValidation), promotionController.createPromotion);

router.put('/:id', authenticate, authorize('ADMIN'), validate(updatePromotionValidation), promotionController.updatePromotion);

router.delete('/:id', authenticate, authorize('ADMIN'), promotionController.deletePromotion);

router.post('/:id/activate', authenticate, authorize('ADMIN'), promotionController.activatePromotion);
router.post('/:id/deactivate', authenticate, authorize('ADMIN'), promotionController.deactivatePromotion);

// Validación pública para checkout
router.post('/validate', validate(z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      lineTotal: z.number().positive(),
    })).min(1),
    subtotal: z.number().positive(),
    categoryIds: z.array(z.string()).optional(),
    brandIds: z.array(z.string()).optional(),
    productIds: z.array(z.string()).optional(),
  }),
})), promotionController.validatePromotion);

export default router;