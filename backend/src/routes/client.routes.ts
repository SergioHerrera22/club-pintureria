import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as clientController from '../controllers/client.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('CAJERA', 'ADMIN'), clientController.listClients);

const createClientSchema = z.object({
  body: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dni: z.string().min(7).max(8),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
    password: z.string().min(6).optional(),
  }),
});

// Alta de nuevos clientes: Admin, Cajera y Vendedor
router.post('/', authenticate, authorize('ADMIN', 'CAJERA', 'VENDEDOR'), validate(createClientSchema), clientController.createClient);

router.get('/:id', authenticate, authorize('CAJERA', 'ADMIN'), clientController.getClientDetail);
router.get('/dni/:dni', authenticate, authorize('CAJERA', 'ADMIN'), clientController.findClientByDni);
router.get('/dni/:dni/points', clientController.getClientPoints);
router.get('/dni/:dni/history', authenticate, authorize('CAJERA', 'ADMIN'), clientController.getClientHistory);

router.put('/:id', authenticate, authorize('CAJERA', 'ADMIN'), validate(z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({ id: z.string() }),
})), clientController.updateClient);

router.delete('/:id', authenticate, authorize('ADMIN'), clientController.deleteClient);

const purchaseSchema = z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive().default(1),
    })).min(1),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
    // Optional fields for auto-creating new client
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
  }),
});

const quickPurchaseSchema = z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
    amount: z.number().positive(),
    notes: z.string().optional(),
    // Optional fields for auto-creating new client
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
  }),
});

router.post('/purchase', authenticate, authorize('CAJERA', 'ADMIN'), validate(purchaseSchema), clientController.registerPurchase);
router.post('/quick-purchase', authenticate, authorize('CAJERA', 'ADMIN'), validate(quickPurchaseSchema), clientController.registerQuickPurchase);

export default router;