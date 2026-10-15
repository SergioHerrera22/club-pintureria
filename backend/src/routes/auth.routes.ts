import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as authController from '../controllers/auth.controller';
import { authenticate, optionalAuth, requireStaffMenuPermission } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6).optional().default('123456'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dni: z.string().min(7).max(8),
    phone: z.string().optional(),
    birthDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Fecha inválida' }),
    role: z.enum(['ADMIN', 'CAJERA', 'VENDEDOR', 'CLIENTE']).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(6),
  }),
});

// Alta de clientes: público, pero si la hace un empleado con permisos
// personalizados, exige que tenga habilitada la carga de clientes.
router.post('/register', optionalAuth, requireStaffMenuPermission('clientes', 'nuevo-cliente'), validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateProfile);
router.put('/me/password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;