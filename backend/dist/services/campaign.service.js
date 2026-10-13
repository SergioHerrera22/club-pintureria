"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const prisma_1 = require("../config/prisma");
const whatsapp_service_1 = require("./whatsapp.service");
const systemConfig_service_1 = require("./systemConfig.service");
const errorHandler_1 = require("../middleware/errorHandler");
class CampaignService {
    static async getRecipients() {
        const users = await prisma_1.prisma.user.findMany({
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
        const recipients = users.map((u) => ({
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
    static async sendCampaign(input) {
        const message = (input.message || '').trim();
        if (!message) {
            throw new errorHandler_1.AppError(400, 'El mensaje no puede estar vacío');
        }
        const company = await systemConfig_service_1.SystemConfigService.getCompanyName();
        const result = {
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
            const body = whatsapp_service_1.whatsappService.renderTemplate(message, {
                nombre: 'Cliente',
                apellido: '',
                dni: '',
                puntos: 0,
                total: 0,
                empresa: company,
            });
            const ok = await whatsapp_service_1.whatsappService.sendMessage(input.testPhone.trim(), body);
            if (ok)
                result.sent = 1;
            else {
                result.failed = 1;
                result.errors.push({ recipient: input.testPhone.trim(), error: 'No se pudo enviar (verificá el número)' });
            }
            return result;
        }
        let recipients = [];
        if (input.sendToAll) {
            const data = await this.getRecipients();
            recipients = data.recipients;
        }
        else if (input.recipientIds && input.recipientIds.length > 0) {
            const users = await prisma_1.prisma.user.findMany({
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
        }
        else {
            throw new errorHandler_1.AppError(400, 'Seleccioná al menos un destinatario o elegí "todos los clientes"');
        }
        result.total = recipients.length;
        for (const recipient of recipients) {
            if (!recipient.phone || !recipient.phone.trim()) {
                result.skippedNoPhone++;
                continue;
            }
            const body = whatsapp_service_1.whatsappService.renderTemplate(message, {
                nombre: recipient.firstName,
                apellido: recipient.lastName,
                dni: recipient.dni,
                puntos: recipient.currentPoints,
                total: recipient.currentPoints,
                empresa: company,
            });
            const ok = await whatsapp_service_1.whatsappService.sendMessage(recipient.phone, body);
            if (ok) {
                result.sent++;
            }
            else {
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
exports.CampaignService = CampaignService;
//# sourceMappingURL=campaign.service.js.map