import { SystemConfigService, DEFAULT_WHATSAPP_TEMPLATES } from './systemConfig.service';

interface WhatsAppMessage {
  to: string;
  body: string;
}

export type WhatsAppTemplateVars = Record<string, string | number | undefined | null>;

class WhatsAppService {
  private client: any = null;

  private getClient() {
    if (!this.client) {
      const provider = process.env.WHATSAPP_PROVIDER || 'mock';
      
      if (provider === 'twilio') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
        
        if (accountSid && authToken && fromNumber) {
          const twilio = require('twilio');
          this.client = {
            provider: 'twilio',
            client: twilio(accountSid, authToken),
            fromNumber,
          };
        }
      } else if (provider === 'whatsapp-business') {
        const accessToken = process.env.WHATSAPP_BUSINESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
        
        if (accessToken && phoneNumberId) {
          this.client = {
            provider: 'whatsapp-business',
            accessToken,
            phoneNumberId,
          };
        }
      }
      
      if (!this.client) {
        this.client = { provider: 'mock' };
      }
    }
    return this.client;
  }

  async sendMessage(to: string, body: string): Promise<boolean> {
    const client = this.getClient();
    const cleanPhone = this.formatPhoneNumber(to);
    
    if (!cleanPhone) {
      console.warn('WhatsApp: Número de teléfono inválido', to);
      return false;
    }

    try {
      if (client.provider === 'twilio') {
        await client.client.messages.create({
          from: `whatsapp:${client.fromNumber}`,
          to: `whatsapp:${cleanPhone}`,
          body,
        });
        return true;
      } else if (client.provider === 'whatsapp-business') {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${client.phoneNumberId}/messages`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(10_000), // no colgar el request si la API no responde
            headers: {
              'Authorization': `Bearer ${client.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: cleanPhone,
              type: 'text',
              text: { body },
            }),
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(`WhatsApp Business API error: ${JSON.stringify(error)}`);
        }
        return true;
      } else {
        console.log('📱 [WhatsApp MOCK] Enviando a:', cleanPhone);
        console.log('📱 [WhatsApp MOCK] Mensaje:', body);
        return true;
      }
    } catch (error) {
      console.error('Error enviando WhatsApp:', error);
      return false;
    }
  }

  formatPhoneNumber(phone: string): string | null {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('549')) {
      cleaned = '54' + cleaned.substring(3);
    } else if (cleaned.startsWith('54')) {
    } else if (cleaned.length === 10) {
      cleaned = '549' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('9')) {
      cleaned = '54' + cleaned;
    }
    
    if (cleaned.length >= 11 && cleaned.startsWith('54')) {
      return cleaned;
    }
    
    return null;
  }

  renderTemplate(template: string, vars: WhatsAppTemplateVars = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? match : String(value);
    });
  }

  /** Formato de puntos: 1.500 (es-AR, sin decimales). */
  private formatPoints(value: number): string {
    return new Intl.NumberFormat('es-AR').format(Math.round(value));
  }

  /** Formato de dinero: $ 12.500 (es-AR, sin decimales). */
  private formatAmount(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  }

  /** Fecha/hora corta: 22/10/2026, 15:10 */
  private formatDateTime(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  /**
   * Mensaje de WhatsApp de una compra para abrirlo en WhatsApp Web desde el
   * navegador de la cajera (flujo de carga de venta).
   * - Primera compra del cliente → plantilla de bienvenida.
   * - Resto → plantilla de puntos ganados (puntos de la compra + saldo acumulado).
   * Devuelve null si el cliente no tiene teléfono válido: no se abre nada.
   */
  async buildPurchaseMessage(input: {
    phone?: string | null;
    firstName: string;
    lastName?: string;
    dni?: string;
    pointsEarned: number;
    pointsBalance: number;
    amount?: number | null;
    receiptNumber?: string | null;
    branchName?: string | null;
    purchasedAt?: Date;
    isFirstPurchase: boolean;
  }): Promise<{
    phone: string;
    message: string;
    templateKey: 'welcome' | 'points_earned';
    isFirstPurchase: boolean;
  } | null> {
    const phone = this.formatPhoneNumber(input.phone || '');
    if (!phone) return null;

    const [templates, company] = await Promise.all([
      SystemConfigService.getWhatsappTemplates(),
      SystemConfigService.getCompanyName(),
    ]);

    const templateKey = input.isFirstPurchase ? 'welcome' : 'points_earned';
    const message = this.renderTemplate(templates[templateKey], {
      nombre: input.firstName,
      apellido: input.lastName || '',
      dni: input.dni || '',
      puntos: this.formatPoints(input.pointsEarned),
      total: this.formatPoints(input.pointsBalance),
      monto: input.amount !== undefined && input.amount !== null ? this.formatAmount(input.amount) : '',
      ticket: input.receiptNumber || '',
      sucursal: input.branchName || '',
      fecha: this.formatDateTime(input.purchasedAt || new Date()),
      empresa: company,
    });

    return { phone, message, templateKey, isFirstPurchase: input.isFirstPurchase };
  }

  async sendPointsEarnedNotification(
    phone: string,
    firstName: string,
    pointsEarned: number,
    newBalance: number,
    meta?: {
      amount?: number | null;
      receiptNumber?: string | null;
      branchName?: string | null;
    }
  ): Promise<boolean> {
    const [templates, company] = await Promise.all([
      SystemConfigService.getWhatsappTemplates(),
      SystemConfigService.getCompanyName(),
    ]);

    const body = this.renderTemplate(templates.points_earned || DEFAULT_WHATSAPP_TEMPLATES.points_earned, {
      nombre: firstName,
      puntos: this.formatPoints(pointsEarned),
      total: this.formatPoints(newBalance),
      monto: meta?.amount !== undefined && meta?.amount !== null ? this.formatAmount(meta.amount) : '',
      ticket: meta?.receiptNumber || '',
      sucursal: meta?.branchName || '',
      fecha: this.formatDateTime(),
      empresa: company,
    });
    
    return this.sendMessage(phone, body);
  }

  async sendRedemptionNotification(
    phone: string,
    firstName: string,
    prizeName: string,
    pointsSpent: number,
    newBalance: number
  ): Promise<boolean> {
    const [templates, company] = await Promise.all([
      SystemConfigService.getWhatsappTemplates(),
      SystemConfigService.getCompanyName(),
    ]);

    const body = this.renderTemplate(templates.redemption || DEFAULT_WHATSAPP_TEMPLATES.redemption, {
      nombre: firstName,
      premio: prizeName,
      puntos: pointsSpent.toLocaleString('es-AR'),
      total: newBalance.toLocaleString('es-AR'),
      empresa: company,
    });
    
    return this.sendMessage(phone, body);
  }

  async sendWelcomeNotification(
    phone: string,
    firstName: string
  ): Promise<boolean> {
    const [templates, company] = await Promise.all([
      SystemConfigService.getWhatsappTemplates(),
      SystemConfigService.getCompanyName(),
    ]);

    const body = this.renderTemplate(templates.welcome || DEFAULT_WHATSAPP_TEMPLATES.welcome, {
      nombre: firstName,
      empresa: company,
    });
    
    return this.sendMessage(phone, body);
  }

  async sendExpiringNotification(
    phone: string,
    firstName: string,
    points: number,
    daysLeft: number
  ): Promise<boolean> {
    const [templates, company] = await Promise.all([
      SystemConfigService.getWhatsappTemplates(),
      SystemConfigService.getCompanyName(),
    ]);

    const body = this.renderTemplate(templates.points_expiring || DEFAULT_WHATSAPP_TEMPLATES.points_expiring, {
      nombre: firstName,
      puntos: points.toLocaleString('es-AR'),
      dias: daysLeft,
      empresa: company,
    });
    
    return this.sendMessage(phone, body);
  }
}

export const whatsappService = new WhatsAppService();
