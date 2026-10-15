import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as purchaseController from '../controllers/purchase.controller';
import { authenticate, authorize, requireMenuPermission } from '../middleware/auth';

const router = Router();

const createPurchaseValidation = z.object({
  body: z.object({
    clientId: z.string().min(1),
    // Opcional: para staff se usa su propia sucursal; el admin puede indicarla.
    branchId: z.string().min(1).optional(),
    items: z.array(z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      discount: z.number().min(0).max(100).optional(),
    })).min(1),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
  }),
});

router.post('/', authenticate, authorize('CAJERA', 'ADMIN'), requireMenuPermission('ventas'), validate(createPurchaseValidation), purchaseController.createPurchase);
router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), purchaseController.getPurchases);
router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), purchaseController.getPurchaseById);
router.post('/:id/cancel', authenticate, authorize('ADMIN'), purchaseController.cancelPurchase);

export default router;