"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../middleware/validation");
const pointsExpiration_service_1 = require("../services/pointsExpiration.service");
const email_service_1 = require("../services/email.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const prisma_1 = require("../config/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Ejecutar expiración de puntos (para cron job)
router.post('/expire-points', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res, next) => {
    try {
        const result = await pointsExpiration_service_1.PointsExpirationService.expirePoints();
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Notificar puntos por vencer (para cron job diario)
router.post('/notify-expiring', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), async (req, res, next) => {
    try {
        // This is handled within expirePoints, but can be called separately
        const result = await pointsExpiration_service_1.PointsExpirationService.expirePoints();
        res.json({ message: 'Notificaciones enviadas', ...result });
    }
    catch (error) {
        next(error);
    }
});
// Enviar email de bienvenida a nuevos clientes
router.post('/welcome-email', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
    }),
})), async (req, res, next) => {
    try {
        const { dni } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { dni } });
        if (!user)
            throw new Error('Cliente no encontrado');
        if (!user.email)
            throw new Error('Cliente sin email');
        await email_service_1.emailService.sendWelcomeEmail(user.email, user.firstName);
        // Send WhatsApp welcome
        if (user.phone) {
            const body = `👋 *¡Bienvenido ${user.firstName} a Club Robles!*\n\nTu cuenta está lista para empezar a ganar puntos en cada compra. Presentá tu DNI en la sucursal y comenzá a sumar.\n\nClub Robles 🎨`;
            await whatsapp_service_1.whatsappService.sendMessage(user.phone, body);
        }
        res.json({ message: 'Email de bienvenida enviado' });
    }
    catch (error) {
        next(error);
    }
});
// Manual expire points for specific client
router.post('/expire-client', auth_1.authenticate, (0, auth_1.authorize)('ADMIN'), (0, validation_1.validate)(zod_1.z.object({
    body: zod_1.z.object({
        dni: zod_1.z.string().min(7).max(8),
    }),
})), async (req, res, next) => {
    try {
        const { dni } = req.body;
        const result = await pointsExpiration_service_1.PointsExpirationService.expirePointsForClient(dni);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=automation.routes.js.map