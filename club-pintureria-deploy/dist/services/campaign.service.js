"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const prisma_1 = require("../config/prisma");
const whatsapp_service_1 = require("./whatsapp.service");
const systemConfig_service_1 = require("./systemConfig.service");
const errorHandler_1 = require("../middleware/errorHandler");
class CampaignService {
    /**
     * Filtro de sucursal para los destinatarios:
     * - Sin branchId (o vacío): todos los clientes.
     * - Con branchId: solo los clientes de esa sucursal.
     */
    static branchWhere(branchId) {
        const id = (branchId || '').trim();
        return id ? { branchId: id } : {};
    }
    static async getRecipients(branchId) {
        const users = await prisma_1.prisma.user.findMany({
            where: { role: 'CLIENTE', isActive: true, ...this.branchWhere(branchId) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                dni: true,
                phone: true,
                createdAt: true,
                branchId: true,
                branch: { select: { name: true } },
                clientProfile: { select: { currentPoints: true } },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });
        const recipients = users.map((u) => this.toRecipient(u));
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
        const recipients = await this.resolveRecipients(input);
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
    /**
     * Mapea un usuario (cliente) al formato de destinatario de la campaña.
     * Compartido entre el listado y la resolución de destinatarios del envío.
     */
    static toRecipient(u) {
        return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            dni: u.dni,
            phone: u.phone,
            currentPoints: u.clientProfile?.currentPoints ?? 0,
            branchId: u.branchId,
            branchName: u.branch?.name ?? null,
            createdAt: u.createdAt.toISOString(),
        };
    }
    static async resolveRecipients(input) {
        if (input.sendToAll) {
            const data = await this.getRecipients(input.branchId);
            return data.recipients;
        }
        if (input.recipientIds && input.recipientIds.length > 0) {
            const users = await prisma_1.prisma.user.findMany({
                where: { id: { in: input.recipientIds }, role: 'CLIENTE', ...this.branchWhere(input.branchId) },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    dni: true,
                    phone: true,
                    createdAt: true,
                    branchId: true,
                    branch: { select: { name: true } },
                    clientProfile: { select: { currentPoints: true } },
                },
            });
            return users.map((u) => this.toRecipient(u));
        }
        throw new errorHandler_1.AppError(400, 'Seleccioná al menos un destinatario o elegí "todos los clientes"');
    }
    /**
     * Prepara la campaña sin enviarla: devuelve el mensaje ya renderizado y el
     * teléfono normalizado de cada destinatario, para que el frontend abra
     * WhatsApp Web con el texto precargado.
     */
    static async prepareCampaign(input) {
        const message = (input.message || '').trim();
        if (!message) {
            throw new errorHandler_1.AppError(400, 'El mensaje no puede estar vacío');
        }
        const company = await systemConfig_service_1.SystemConfigService.getCompanyName();
        const result = { isTest: false, messages: [], skipped: [] };
        // Prueba a un único número
        if (input.testPhone && input.testPhone.trim()) {
            result.isTest = true;
            const phone = whatsapp_service_1.whatsappService.formatPhoneNumber(input.testPhone.trim());
            if (!phone) {
                result.skipped.push({
                    name: 'Número de prueba',
                    phone: input.testPhone.trim(),
                    reason: 'Teléfono inválido',
                });
                return result;
            }
            result.messages.push({
                id: 'test',
                name: 'Mensaje de prueba',
                phone,
                message: whatsapp_service_1.whatsappService.renderTemplate(message, {
                    nombre: 'Cliente',
                    apellido: '',
                    dni: '',
                    puntos: 0,
                    total: 0,
                    empresa: company,
                }),
            });
            return result;
        }
        const recipients = await this.resolveRecipients(input);
        for (const recipient of recipients) {
            const name = `${recipient.firstName} ${recipient.lastName}`.trim();
            if (!recipient.phone || !recipient.phone.trim()) {
                result.skipped.push({ name: `${name} (${recipient.dni})`, phone: null, reason: 'Sin teléfono' });
                continue;
            }
            const phone = whatsapp_service_1.whatsappService.formatPhoneNumber(recipient.phone);
            if (!phone) {
                result.skipped.push({
                    name: `${name} (${recipient.dni})`,
                    phone: recipient.phone,
                    reason: 'Teléfono inválido para WhatsApp',
                });
                continue;
            }
            result.messages.push({
                id: recipient.id,
                name: `${name} (${recipient.dni})`,
                phone,
                message: whatsapp_service_1.whatsappService.renderTemplate(message, {
                    nombre: recipient.firstName,
                    apellido: recipient.lastName,
                    dni: recipient.dni,
                    puntos: recipient.currentPoints,
                    total: recipient.currentPoints,
                    empresa: company,
                }),
            });
        }
        return result;
    }
}
exports.CampaignService = CampaignService;
//# sourceMappingURL=campaign.service.js.map