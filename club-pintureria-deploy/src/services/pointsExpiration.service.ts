import { prisma } from '../config/prisma';
import { TransactionType } from '@prisma/client';
import { emailService } from './email.service';
import { whatsappService } from './whatsapp.service';
import { SystemConfigService } from './systemConfig.service';

interface ExpirationResult {
  expiredCount: number;
  notifiedCount: number;
  errors: string[];
}

export class PointsExpirationService {
  static async expirePoints(): Promise<ExpirationResult> {
    const result: ExpirationResult = { expiredCount: 0, notifiedCount: 0, errors: [] };

    try {
      const now = new Date();

      const expiryDays = await SystemConfigService.getPointsExpiryDays();
      if (expiryDays <= 0) {
        return result;
      }

      // Get all clients with points
      const clients = await prisma.user.findMany({
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
        SystemConfigService.getPointsExpiryWarningDays(),
        SystemConfigService.getNotificationsEnabled('email'),
        SystemConfigService.getNotificationsEnabled('whatsapp'),
      ]);

      const warningDays = Math.min(warningDaysConfig, Math.max(expiryDays - 1, 0));

      for (const user of clients) {
        if (!user.clientProfile) continue;

        const lastActivity = user.transactions[0]?.createdAt || user.clientProfile.lastPurchaseAt || user.createdAt;
        const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceActivity >= expiryDays) {
          try {
            await this.expireClientPoints(user.id, user.clientProfile.currentPoints, expiryDays);
            result.expiredCount++;
          } catch (err) {
            result.errors.push(`Error expirando puntos de ${user.dni}: ${err}`);
          }
        } else if (daysSinceActivity >= expiryDays - warningDays && daysSinceActivity < expiryDays) {
          try {
            await this.notifyExpiryWarning(user, expiryDays - daysSinceActivity, emailEnabled, whatsappEnabled);
            result.notifiedCount++;
          } catch (err) {
            result.errors.push(`Error notificando expiración a ${user.dni}: ${err}`);
          }
        }
      }
    } catch (error) {
      result.errors.push(`Error general: ${error}`);
    }

    return result;
  }

  private static async expireClientPoints(userId: string, points: number, expiryDays: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.VENCIMIENTO,
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

  private static async notifyExpiryWarning(user: any, daysLeft: number, emailEnabled: boolean, whatsappEnabled: boolean): Promise<void> {
    const message = `Tus ${user.clientProfile?.currentPoints || 0} puntos vencerán en ${daysLeft} días por inactividad. Realiza una compra para mantenerlos activos.`;

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'POINTS_EXPIRING_SOON',
        title: 'Puntos por vencer',
        message,
        metadata: { daysLeft, points: user.clientProfile?.currentPoints },
      },
    });

    if (emailEnabled && user.email) {
      await emailService.sendPointsExpiringEmail(user.email, user.firstName, user.clientProfile?.currentPoints || 0, daysLeft);
    }

    if (whatsappEnabled && user.phone) {
      await whatsappService.sendExpiringNotification(
        user.phone,
        user.firstName,
        user.clientProfile?.currentPoints || 0,
        daysLeft
      );
    }
  }

  // Manual trigger for admin
  static async expirePointsForClient(dni: string): Promise<{ success: boolean; message: string }> {
    const expiryDays = await SystemConfigService.getPointsExpiryDays();
    if (expiryDays <= 0) {
      return { success: false, message: 'El vencimiento de puntos está deshabilitado (points_expiry_days = 0)' };
    }

    const user = await prisma.user.findUnique({
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
