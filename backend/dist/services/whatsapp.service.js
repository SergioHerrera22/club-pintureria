"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const systemConfig_service_1 = require("./systemConfig.service");
class WhatsAppService {
    client = null;
    getClient() {
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
            }
            else if (provider === 'whatsapp-business') {
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
    async sendMessage(to, body) {
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
            }
            else if (client.provider === 'whatsapp-business') {
                const response = await fetch(`https://graph.facebook.com/v18.0/${client.phoneNumberId}/messages`, {
                    method: 'POST',
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
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(`WhatsApp Business API error: ${JSON.stringify(error)}`);
                }
                return true;
            }
            else {
                console.log('📱 [WhatsApp MOCK] Enviando a:', cleanPhone);
                console.log('📱 [WhatsApp MOCK] Mensaje:', body);
                return true;
            }
        }
        catch (error) {
            console.error('Error enviando WhatsApp:', error);
            return false;
        }
    }
    formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('549')) {
            cleaned = '54' + cleaned.substring(3);
        }
        else if (cleaned.startsWith('54')) {
        }
        else if (cleaned.length === 10) {
            cleaned = '549' + cleaned;
        }
        else if (cleaned.length === 11 && cleaned.startsWith('9')) {
            cleaned = '54' + cleaned;
        }
        if (cleaned.length >= 11 && cleaned.startsWith('54')) {
            return cleaned;
        }
        return null;
    }
    renderTemplate(template, vars = {}) {
        return template.replace(/\{(\w+)\}/g, (match, key) => {
            const value = vars[key];
            return value === undefined || value === null ? match : String(value);
        });
    }
    async sendPointsEarnedNotification(phone, firstName, pointsEarned, newBalance) {
        const [templates, company] = await Promise.all([
            systemConfig_service_1.SystemConfigService.getWhatsappTemplates(),
            systemConfig_service_1.SystemConfigService.getCompanyName(),
        ]);
        const body = this.renderTemplate(templates.points_earned || systemConfig_service_1.DEFAULT_WHATSAPP_TEMPLATES.points_earned, {
            nombre: firstName,
            puntos: pointsEarned.toLocaleString('es-AR'),
            total: newBalance.toLocaleString('es-AR'),
            empresa: company,
        });
        return this.sendMessage(phone, body);
    }
    async sendRedemptionNotification(phone, firstName, prizeName, pointsSpent, newBalance) {
        const [templates, company] = await Promise.all([
            systemConfig_service_1.SystemConfigService.getWhatsappTemplates(),
            systemConfig_service_1.SystemConfigService.getCompanyName(),
        ]);
        const body = this.renderTemplate(templates.redemption || systemConfig_service_1.DEFAULT_WHATSAPP_TEMPLATES.redemption, {
            nombre: firstName,
            premio: prizeName,
            puntos: pointsSpent.toLocaleString('es-AR'),
            total: newBalance.toLocaleString('es-AR'),
            empresa: company,
        });
        return this.sendMessage(phone, body);
    }
    async sendWelcomeNotification(phone, firstName) {
        const [templates, company] = await Promise.all([
            systemConfig_service_1.SystemConfigService.getWhatsappTemplates(),
            systemConfig_service_1.SystemConfigService.getCompanyName(),
        ]);
        const body = this.renderTemplate(templates.welcome || systemConfig_service_1.DEFAULT_WHATSAPP_TEMPLATES.welcome, {
            nombre: firstName,
            empresa: company,
        });
        return this.sendMessage(phone, body);
    }
    async sendExpiringNotification(phone, firstName, points, daysLeft) {
        const [templates, company] = await Promise.all([
            systemConfig_service_1.SystemConfigService.getWhatsappTemplates(),
            systemConfig_service_1.SystemConfigService.getCompanyName(),
        ]);
        const body = this.renderTemplate(templates.points_expiring || systemConfig_service_1.DEFAULT_WHATSAPP_TEMPLATES.points_expiring, {
            nombre: firstName,
            puntos: points.toLocaleString('es-AR'),
            dias: daysLeft,
            empresa: company,
        });
        return this.sendMessage(phone, body);
    }
}
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=whatsapp.service.js.map