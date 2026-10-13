import { prisma } from '../config/prisma';
import { whatsappService } from './whatsapp.service';
import { SystemConfigService } from './systemConfig.service';
import { AppError } from '../middleware/errorHandler';

export interface CampaignRecipient {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string | null;
  currentPoints: number;
}

export interface SendCampaignInput {
  message: string;
  sendToAll?: boolean;
  recipientIds?: string[];
  testPhone?: string;
}

export interface CampaignResult {
  total: number;
  sent: number;
  failed: number;
  skippedNoPhone: number;
  isTest: boolean;
  errors: Array<{ recipient: string; error: string }>;
}

export class CampaignService {
  static async getRecipients(): Promise<{
    recipients: CampaignRecipient[];
    total: number;
    withPhone: number;
    withoutPhone: number;
  }> {
    const users = await prisma.user.findMany({
      where: { role: 'CLIENTE', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dni: true,
        phone: true,
        clientProfile: { select: { currentPoints: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const recipients: CampaignRecipient[] = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      dni: u.dni,
      phone: u.phone,
      currentPoints: u.clientProfile?.currentPoints ?? 0,
    }));

    const withPhone = recipients.filter((r) => !!r.phone && r.phone.trim().length > 0).length;

    return {
      recipients,
      total: recipients.length,
      withPhone,
      withoutPhone: recipients.length - withPhone,
    };
  }

  static async sendCampaign(input: SendCampaignInput): Promise<CampaignResult> {
    const message = (input.message || '').trim();
    if (!message) {
      throw new AppError(400, 'El mensaje no puede estar vacío');
    }

    const company = await SystemConfigService.getCompanyName();
    const result: CampaignResult = {
      total: 0,
      sent: 0,
      failed: 0,
      skippedNoPhone: 0,
      isTest: false,
      errors: [],
    };

    // Envío de prueba a un único número
    if (input.testPhone && input.testPhone.trim()) {
      result.isTest = true;
      result.total = 1;
      const body = whatsappService.renderTemplate(message, {
        nombre: 'Cliente',
        apellido: '',
        dni: '',
        puntos: 0,
        total: 0,
        empresa: company,
      });
      const ok = await whatsappService.sendMessage(input.testPhone.trim(), body);
      if (ok) result.sent = 1;
      else {
        result.failed = 1;
        result.errors.push({ recipient: input.testPhone.trim(), error: 'No se pudo enviar (verificá el número)' });
      }
      return result;
    }

    let recipients: CampaignRecipient[] = [];

    if (input.sendToAll) {
      const data = await this.getRecipients();
      recipients = data.recipients;
    } else if (input.recipientIds && input.recipientIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: input.recipientIds }, role: 'CLIENTE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dni: true,
          phone: true,
          clientProfile: { select: { currentPoints: true } },
        },
      });
      recipients = users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        dni: u.dni,
        phone: u.phone,
        currentPoints: u.clientProfile?.currentPoints ?? 0,
      }));
    } else {
      throw new AppError(400, 'Seleccioná al menos un destinatario o elegí "todos los clientes"');
    }

    result.total = recipients.length;

    for (const recipient of recipients) {
      if (!recipient.phone || !recipient.phone.trim()) {
        result.skippedNoPhone++;
        continue;
      }

      const body = whatsappService.renderTemplate(message, {
        nombre: recipient.firstName,
        apellido: recipient.lastName,
        dni: recipient.dni,
        puntos: recipient.currentPoints,
        total: recipient.currentPoints,
        empresa: company,
      });

      const ok = await whatsappService.sendMessage(recipient.phone, body);
      if (ok) {
        result.sent++;
      } else {
        result.failed++;
        result.errors.push({
          recipient: `${recipient.firstName} ${recipient.lastName} (${recipient.dni})`,
          error: 'No se pudo enviar',
        });
      }
    }

    return result;
  }
}
