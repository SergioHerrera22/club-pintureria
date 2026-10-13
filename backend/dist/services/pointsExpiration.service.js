"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsExpirationService = void 0;
const prisma_1 = require("../config/prisma");
const client_1 = require("@prisma/client");
const email_service_1 = require("./email.service");
const whatsapp_service_1 = require("./whatsapp.service");
const systemConfig_service_1 = require("./systemConfig.service");
class PointsExpirationService {
    static async expirePoints() {
        const result = { expiredCount: 0, notifiedCount: 0, errors: [] };
        try {
            const now = new Date();
            const expiryDays = await systemConfig_service_1.SystemConfigService.getPointsExpiryDays();
            if (expiryDays <= 0) {
                return result;
            }
            // Get all clients with points
            const clients = await prisma_1.prisma.user.findMany({
                where: {
                    role: 'CLIENTE',
                    isActive: true,
                    clientProfile: {
                        currentPoints: { gt: 0 },
                    },
                },
                include: {
                    clientProfile: true,
                    transactions: {
                        where: { type: { in: ['COMPRA', 'CANJE'] } },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            });
            const [warningDaysConfig, emailEnabled, whatsappEnabled] = await Promise.all([
                systemConfig_service_1.SystemConfigService.getPointsExpiryWarningDays(),
                systemConfig_service_1.SystemConfigService.getNotificationsEnabled('email'),
                systemConfig_service_1.SystemConfigService.getNotificationsEnabled('whatsapp'),
            ]);
            const warningDays = Math.min(warningDaysConfig, Math.max(expiryDays - 1, 0));
            for (const user of clients) {
                if (!user.clientProfile)
                    continue;
                const lastActivity = user.transactions[0]?.createdAt || user.clientProfile.lastPurchaseAt || user.createdAt;
                const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceActivity >= expiryDays) {
                    try {
                        await this.expireClientPoints(user.id, user.clientProfile.currentPoints, expiryDays);
                        result.expiredCount++;
                    }
                    catch (err) {
                        result.errors.push(`Error expirando puntos de ${user.dni}: ${err}`);
                    }
                }
                else if (daysSinceActivity >= expiryDays - warningDays && daysSinceActivity < expiryDays) {
                    try {
                        await this.notifyExpiryWarning(user, expiryDays - daysSinceActivity, emailEnabled, whatsappEnabled);
                        result.notifiedCount++;
                    }
                    catch (err) {
                        result.errors.push(`Error notificando expiración a ${user.dni}: ${err}`);
                    }
                }
            }
        }
        catch (error) {
            result.errors.push(`Error general: ${error}`);
        }
        return result;
    }
    static async expireClientPoints(userId, points, expiryDays) {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.transaction.create({
                data: {
                    userId,
                    type: client_1.TransactionType.VENCIMIENTO,
                    subtotal: 0,
                    total: 0,
                    pointsEarned: -points,
                    pointsBalance: 0,
                    description: `Vencimiento por inactividad de ${expiryDays} días`,
                },
            });
            await tx.clientProfile.update({
                where: { userId },
                data: {
                    currentPoints: 0,
                },
            });
            await tx.notification.create({
                data: {
                    userId,
                    type: 'POINTS_EXPIRED',
                    title: 'Puntos vencidos',
                    message: `Tus ${points} puntos han vencido por inactividad de ${expiryDays} días`,
                    metadata: { points, expiryDays },
                },
            });
        });
    }
    static async notifyExpiryWarning(user, daysLeft, emailEnabled, whatsappEnabled) {
        const message = `Tus ${user.clientProfile?.currentPoints || 0} puntos vencerán en ${daysLeft} días por inactividad. Realiza una compra para mantenerlos activos.`;
        await prisma_1.prisma.notification.create({
            data: {
                userId: user.id,
                type: 'POINTS_EXPIRING_SOON',
                title: 'Puntos por vencer',
                message,
                metadata: { daysLeft, points: user.clientProfile?.currentPoints },
            },
        });
        if (emailEnabled && user.email) {
            await email_service_1.emailService.sendPointsExpiringEmail(user.email, user.firstName, user.clientProfile?.currentPoints || 0, daysLeft);
        }
        if (whatsappEnabled && user.phone) {
            await whatsapp_service_1.whatsappService.sendExpiringNotification(user.phone, user.firstName, user.clientProfile?.currentPoints || 0, daysLeft);
        }
    }
    // Manual trigger for admin
    static async expirePointsForClient(dni) {
        const expiryDays = await systemConfig_service_1.SystemConfigService.getPointsExpiryDays();
        if (expiryDays <= 0) {
            return { success: false, message: 'El vencimiento de puntos está deshabilitado (points_expiry_days = 0)' };
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { dni },
            include: { clientProfile: true },
        });
        if (!user || !user.clientProfile) {
            return { success: false, message: 'Cliente no encontrado' };
        }
        await this.expireClientPoints(user.id, user.clientProfile.currentPoints, expiryDays);
        return { success: true, message: `Expirados ${user.clientProfile.currentPoints} puntos` };
    }
}
exports.PointsExpirationService = PointsExpirationService;
//# sourceMappingURL=pointsExpiration.service.js.map