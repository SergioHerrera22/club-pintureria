import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import * as clientPortalController from '../controllers/clientPortal.controller';

const router = Router();

/**
 * Limitador de intentos en memoria (por IP). El rate limit global está
 * deshabilitado, pero el portal es público: limitamos fuerza bruta sobre
 * check/claim/login.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const portalRateLimit = (max: number, windowMs: number) => {
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

// Limpieza periódica para que el mapa no crezca indefinidamente
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(ip);
  }
}, 10 * 60 * 1000).unref();

const dniSchema = z.object({
  body: z.object({
    dni: z.string().min(6, 'DNI inválido').max(12, 'DNI inválido'),
  }),
});

const claimSchema = z.object({
  body: z.object({
    dni: z.string().min(6).max(12),
    phone: z.string().max(30).optional(),
    email: z.string().email('Email inválido').optional(),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
  }),
});

const portalLoginSchema = z.object({
  body: z.object({
    dni: z.string().min(6).max(12),
    password: z.string().min(1, 'Contraseña requerida').max(72),
  }),
});

const portalRegisterSchema = z.object({
  body: z.object({
    dni: z.string().min(6).max(12),
    firstName: z.string().min(1, 'Nombre requerido').max(50),
    lastName: z.string().min(1, 'Apellido requerido').max(50),
    phone: z.string().min(6, 'Teléfono requerido').max(30),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
  }),
});

const portalRecoverSchema = z.object({
  body: z.object({
    dni: z.string().min(6).max(12),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
    phone: z.string().max(30).optional(),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
  }),
});

router.post('/check', portalRateLimit(30, 15 * 60 * 1000), validate(dniSchema), clientPortalController.checkDni);
router.post('/claim', portalRateLimit(10, 15 * 60 * 1000), validate(claimSchema), clientPortalController.claimAccount);
router.post('/recover-password', portalRateLimit(10, 15 * 60 * 1000), validate(portalRecoverSchema), clientPortalController.recoverClientPassword);
router.post('/login', portalRateLimit(15, 15 * 60 * 1000), validate(portalLoginSchema), clientPortalController.loginClient);
router.post('/register', portalRateLimit(10, 15 * 60 * 1000), validate(portalRegisterSchema), clientPortalController.registerClient);

export default router;
