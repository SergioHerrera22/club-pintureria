import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as purchaseController from '../controllers/purchase.controller';
import * as saleRevisionController from '../controllers/saleRevision.controller';
import { authenticate, authorize, authorizeWithPermission, requireMenuPermission } from '../middleware/auth';

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

// ===== MIS VENTAS + REVISIONES =====
// Importante: declarar ANTES de las rutas /:id para que "mine" y "revisions"
// no sean interpretados como un id de compra.

// Ventas propias del usuario (vendedor/cajera/admin)
router.get('/mine', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), saleRevisionController.getMyPurchases);

// Vendedores activos para el selector al registrar una venta (cajera/admin)
router.get('/vendors', authenticate, authorize('CAJERA', 'ADMIN'), saleRevisionController.getVendorsForSale);

// Solicitudes de revisión (admin)
router.get('/revisions', authenticate, authorize('ADMIN'), saleRevisionController.listRevisions);

// Estado de mis solicitudes de revisión
router.get('/revisions/mine', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), saleRevisionController.getMyRevisions);

// Aprobar / rechazar una solicitud (admin)
const approveRevisionValidation = z.object({
  body: z.object({
    note: z.string().max(1000).optional(),
  }),
});
const rejectRevisionValidation = z.object({
  body: z.object({
    reason: z.string().min(5, 'Indicá el motivo del rechazo (mínimo 5 caracteres)').max(1000),
  }),
});
router.post('/revisions/:id/approve', authenticate, authorize('ADMIN'), validate(approveRevisionValidation), saleRevisionController.approveRevision);
router.post('/revisions/:id/reject', authenticate, authorize('ADMIN'), validate(rejectRevisionValidation), saleRevisionController.rejectRevision);

// El vendedor/cajera solicita la revisión de una venta propia del día
const revisionRequestValidation = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      discount: z.number().min(0).max(100).optional(),
    })).min(1).optional(),
    newClientDni: z.string().regex(/^\d{7,8}$/, 'DNI inválido').optional(),
    notes: z.string().max(500).optional(),
    observation: z.string().min(10, 'Explicá el motivo de la revisión (mínimo 10 caracteres)').max(1000),
  }),
});
router.post('/:id/revision', authenticate, authorize('VENDEDOR', 'CAJERA'), validate(revisionRequestValidation), saleRevisionController.requestRevision);

// ===== VENTAS =====
router.post('/', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'ventas'), requireMenuPermission('ventas'), validate(createPurchaseValidation), purchaseController.createPurchase);
router.get('/', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'ventas'), purchaseController.getPurchases);
router.get('/:id', authenticate, authorizeWithPermission(['CAJERA', 'ADMIN'], 'ventas'), purchaseController.getPurchaseById);
router.post('/:id/cancel', authenticate, authorize('ADMIN'), purchaseController.cancelPurchase);

export default router;