import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as currentAccountController from '../controllers/currentAccount.controller';
import { authenticate, authorize, requireMenuPermission } from '../middleware/auth';

const router = Router();

// DNI o CUIT, con o sin puntos/guiones (el servicio los normaliza)
const dniInput = (msg: string) => z.string().min(5, msg).max(16, msg).regex(/^[\d\-.\s]+$/, msg);

// ===== CUENTAS CORRIENTES =====

// Listado con puntos de cliente y pintor (ADMIN, CAJERA, VENDEDOR)
router.get('/', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), requireMenuPermission('cuentas-corrientes'), currentAccountController.listAccounts);

// Alta de cuenta corriente con el pintor designado (cajera/vendedor/admin)
const createValidation = z.object({
  body: z.object({
    clientDni: dniInput('DNI del cliente inválido'),
    painterDni: dniInput('DNI del pintor inválido'),
    notes: z.string().max(500).optional(),
  }),
});
router.post('/', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), requireMenuPermission('cuentas-corrientes'), validate(createValidation), currentAccountController.createAccount);

// Solicitud de cambio de cuenta propuesta por cajera/vendedor (la aprueba el admin)
const requestEditValidation = z.object({
  body: z.object({
    newPainterDni: dniInput('DNI del nuevo pintor inválido').optional(),
    active: z.boolean().optional(),
    notes: z.string().max(500).optional(),
    observation: z.string().min(10, 'Explicá el motivo del cambio (mínimo 10 caracteres)').max(1000),
  }),
});
router.post('/:id/edit-request', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), validate(requestEditValidation), currentAccountController.requestEdit);

// Edición directa del admin
const adminUpdateValidation = z.object({
  body: z.object({
    newPainterDni: z.string().optional(),
    active: z.boolean().optional(),
    notes: z.string().max(500).optional(),
  }),
});
router.patch('/:id', authenticate, authorize('ADMIN'), validate(adminUpdateValidation), currentAccountController.adminUpdate);

// ===== SOLICITUDES DE EDICIÓN =====
// Listado de solicitudes (admin)
router.get('/edit-requests', authenticate, authorize('ADMIN'), currentAccountController.listEditRequests);

// Solicitudes del propio usuario (cajera/vendedor)
router.get('/edit-requests/mine', authenticate, authorize('CAJERA', 'ADMIN', 'VENDEDOR'), currentAccountController.getMyEditRequests);

// Aprobar / rechazar una solicitud (admin)
const approveValidation = z.object({
  body: z.object({
    note: z.string().max(1000).optional(),
  }),
});
const rejectValidation = z.object({
  body: z.object({
    reason: z.string().min(5, 'Indicá el motivo del rechazo (mínimo 5 caracteres)').max(1000),
  }),
});
router.post('/edit-requests/:id/approve', authenticate, authorize('ADMIN'), validate(approveValidation), currentAccountController.approveEdit);
router.post('/edit-requests/:id/reject', authenticate, authorize('ADMIN'), validate(rejectValidation), currentAccountController.rejectEdit);

export default router;
