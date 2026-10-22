import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { PointsExpirationService } from '../services/pointsExpiration.service';
import { emailService } from '../services/email.service';
import { whatsappService } from '../services/whatsapp.service';
import { prisma } from '../config/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Ejecutar expiración de puntos (para cron job)
router.post('/expire-points', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const result = await PointsExpirationService.expirePoints();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Notificar puntos por vencer (para cron job diario)
router.post('/notify-expiring', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    // This is handled within expirePoints, but can be called separately
    const result = await PointsExpirationService.expirePoints();
    res.json({ message: 'Notificaciones enviadas', ...result });
  } catch (error) {
    next(error);
  }
});

// Enviar email de bienvenida a nuevos clientes
router.post('/welcome-email', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
  }),
})), async (req, res, next) => {
  try {
    const { dni } = req.body;
    const user = await prisma.user.findUnique({ where: { dni } });
    
    if (!user) throw new Error('Cliente no encontrado');
    if (!user.email) throw new Error('Cliente sin email');
    
    await emailService.sendWelcomeEmail(user.email, user.firstName);
    
    // Send WhatsApp welcome
    if (user.phone) {
      const body = `👋 *¡Bienvenido ${user.firstName} a Club Robles!*\n\nTu cuenta está lista para empezar a ganar puntos en cada compra. Presentá tu DNI en la sucursal y comenzá a sumar.\n\nClub Robles 🎨`;
      await whatsappService.sendMessage(user.phone, body);
    }
    
    res.json({ message: 'Email de bienvenida enviado' });
  } catch (error) {
    next(error);
  }
});

// Manual expire points for specific client
router.post('/expire-client', authenticate, authorize('ADMIN'), validate(z.object({
  body: z.object({
    dni: z.string().min(7).max(8),
  }),
})), async (req, res, next) => {
  try {
    const { dni } = req.body;
    const result = await PointsExpirationService.expirePointsForClient(dni);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;