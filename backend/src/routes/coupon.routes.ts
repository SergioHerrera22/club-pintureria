import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as couponController from '../controllers/coupon.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

const createCouponValidation = z.object({
  body: z.object({
    code: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']),
    value: z.number().positive(),
    maxUses: z.number().int().positive().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().optional(),
    clientId: z.string().optional(),
    promotionId: z.string().optional(),
  }),
});

const bulkCouponValidation = z.object({
  body: z.object({
    prefix: z.string().min(1),
    count: z.number().int().positive().max(1000),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']),
    value: z.number().positive(),
    maxUses: z.number().int().positive().optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isActive: z.boolean().optional(),
  }),
});

const updateCouponValidation = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(['DESCUENTO_PORCENTUAL', 'PUNTOS_BONUS', 'PRODUCTO_GRATIS', 'ENVIO_GRATIS']).optional(),
    value: z.number().positive().optional(),
    maxUses: z.number().int().positive().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    clientId: z.string().optional(),
    promotionId: z.string().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), couponController.getCoupons);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), couponController.getCouponById);

router.post('/', authenticate, authorize('ADMIN'), validate(createCouponValidation), couponController.createCoupon);
router.post('/bulk', authenticate, authorize('ADMIN'), validate(bulkCouponValidation), couponController.createBulkCoupons);

router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCouponValidation), couponController.updateCoupon);
router.delete('/:id', authenticate, authorize('ADMIN'), couponController.deleteCoupon);

// Validación pública para checkout
router.post('/validate', validate(z.object({
  body: z.object({
    code: z.string().min(1),
    clientId: z.string().optional(),
  }),
})), couponController.validateCoupon);

router.post('/use', validate(z.object({
  body: z.object({
    code: z.string().min(1),
    clientId: z.string().min(1),
  }),
})), couponController.useCoupon);

router.post('/assign', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    couponId: z.string().min(1),
    clientId: z.string().min(1),
  }),
})), couponController.assignCoupon);

router.post('/assign-bulk', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    couponIds: z.array(z.string()).min(1),
    clientId: z.string().min(1),
  }),
})), couponController.assignBulkCoupons);

export default router;