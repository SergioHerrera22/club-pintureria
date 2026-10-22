import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dni: z.string().min(7).max(8),
    phone: z.string().optional(),
    birthDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
    role: z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
    branchId: z.string().optional(),
  }),
});

router.post('/users', validate(createUserSchema), adminController.createUser);

const PERMISSION_KEYS = [
  'dashboard',
  'nuevo-cliente',
  'clientes',
  'ventas',
  'usuarios',
  'campanas',
  'productos',
  'reglas-puntos',
  'premios',
  'sucursales',
  'marcas',
  'categorias',
  'promociones',
  'cupones',
  'desafios',
  'beneficios',
  'configuracion',
] as const;

const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    birthDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
    role: z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().optional().nullable(),
    permissions: z.array(z.enum(PERMISSION_KEYS)).nullable().optional(),
    confirmationKey: z.string().optional(),
  }),
  params: z.object({ id: z.string() }),
});

router.put('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

const adjustPointsSchema = z.object({
  body: z.object({
    userId: z.string(),
    points: z.number().int(),
    reason: z.string().min(1),
  }),
});

router.post('/adjust-points', validate(adjustPointsSchema), adminController.adjustPoints);

export default router;