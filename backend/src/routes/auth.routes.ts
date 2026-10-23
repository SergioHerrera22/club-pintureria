import { Router, Request, Response, NextFunction } from 'express';
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

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Correo inválido'),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(10),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
  }),
});

// El rate limit global está deshabilitado: limitamos fuerza bruta/abuso
// puntual sobre la recuperación de contraseña (por IP, en memoria).
const attempts = new Map<string, { count: number; resetAt: number }>();
const recoveryRateLimit = (max: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt < now) {
      attempts.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' });
      return;
    }
    next();
  };
};

// Alta de clientes: público, pero si la hace un empleado con permisos
// personalizados, exige que tenga habilitada la carga de clientes.
router.post('/register', optionalAuth, requireStaffMenuPermission('clientes', 'nuevo-cliente'), validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Recuperación de contraseña (público, con límite de intentos)
router.post('/forgot-password', recoveryRateLimit(10, 15 * 60 * 1000), validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', recoveryRateLimit(20, 15 * 60 * 1000), validate(resetPasswordSchema), authController.resetPassword);

router.post('/refresh', validate(refreshSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateProfile);
router.put('/me/password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;