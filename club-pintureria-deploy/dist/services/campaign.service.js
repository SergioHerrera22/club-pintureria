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
        await this.attachLastPointsEarned(recipients);
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
                puntos: recipient.lastPointsEarned,
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
            lastPointsEarned: 0,
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
            const recipients = users.map((u) => this.toRecipient(u));
            await this.attachLastPointsEarned(recipients);
            return recipients;
        }
        throw new errorHandler_1.AppError(400, 'Seleccioná al menos un destinatario o elegí "todos los clientes"');
    }
    /**
     * Completa cada destinatario con los puntos ganados en su última compra
     * (variable {puntos} de la campaña). Una sola query con distinct por cliente.
     */
    static async attachLastPointsEarned(recipients) {
        if (recipients.length === 0)
            return;
        const rows = await prisma_1.prisma.purchase.findMany({
            where: { clientId: { in: recipients.map((r) => r.id) }, status: 'COMPLETADA' },
            orderBy: { createdAt: 'desc' },
            distinct: ['clientId'],
            select: { clientId: true, pointsEarned: true },
        });
        const lastByClient = new Map(rows.map((row) => [row.clientId, row.pointsEarned]));
        for (const recipient of recipients) {
            recipient.lastPointsEarned = lastByClient.get(recipient.id) ?? 0;
        }
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
                    puntos: recipient.lastPointsEarned,
                    total: recipient.currentPoints,
                    empresa: company,
                }),
            });
        }
        return result;
    }
    /** Filtra una lista de destinatarios por ids (vacío/ausente = sin filtrar). */
    static filterIds(list, ids) {
        if (!ids || ids.length === 0)
            return list;
        const set = new Set(ids);
        return list.filter((item) => set.has(item.id));
    }
    /**
     * Audiencias automáticas de campaña:
     * - near_prize: clientes que están a pocos puntos de un premio.
     * - weekly_summary: clientes que compraron en los últimos N días.
     * Devuelve los destinatarios con las variables extra de cada uno para que el
     * mensaje se renderice con datos propios ({premio}, {faltan}, {puntos_semana}…).
     */
    static async getAudience(kind, opts = {}) {
        const base = await this.getRecipients(opts.branchId);
        const pool = this.filterIds(base.recipients, opts.recipientIds);
        let recipients = [];
        if (kind === 'near_prize') {
            const maxFaltan = opts.maxFaltan && opts.maxFaltan > 0 ? Math.floor(opts.maxFaltan) : 500;
            const prizes = await prisma_1.prisma.prize.findMany({
                where: { isActive: true, status: 'DISPONIBLE', pointsCost: { gt: 0 } },
                select: { name: true, pointsCost: true },
                orderBy: { pointsCost: 'asc' },
            });
            if (prizes.length > 0) {
                for (const r of pool) {
                    // Premio más cercano: el de menor costo que todavía no alcanzó.
                    const target = prizes.find((p) => p.pointsCost > r.currentPoints);
                    if (!target)
                        continue;
                    const faltan = target.pointsCost - r.currentPoints;
                    if (faltan > maxFaltan)
                        continue;
                    recipients.push({ ...r, extra: { premio: target.name, faltan } });
                }
            }
        }
        else {
            const days = opts.days && opts.days > 0 ? Math.min(Math.floor(opts.days), 90) : 7;
            const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const rows = await prisma_1.prisma.purchase.groupBy({
                by: ['clientId'],
                where: { status: 'COMPLETADA', createdAt: { gte: since } },
                _count: { _all: true },
                _sum: { pointsEarned: true },
            });
            const byId = new Map(rows.map((row) => [row.clientId, row]));
            recipients = pool
                .filter((r) => byId.has(r.id))
                .map((r) => {
                const agg = byId.get(r.id);
                return {
                    ...r,
                    extra: {
                        puntos_semana: agg._sum.pointsEarned ?? 0,
                        compras_semana: agg._count._all,
                        periodo: days,
                    },
                };
            });
        }
        const withPhone = recipients.filter((r) => !!r.phone && r.phone.trim().length > 0).length;
        return { kind, recipients, total: recipients.length, withPhone, withoutPhone: recipients.length - withPhone };
    }
    /**
     * Inicia una campaña persistiéndola: un registro Campaign y un CampaignDelivery
     * por destinatario (PENDIENTE u OMITIDO). El frontend va marcando cada entrega
     * con ackDelivery; un destinatario sólo puede pasar de PENDIENTE una vez, así
     * que recargar la página o repetir el click no vuelve a enviar.
     * Los envíos de prueba no crean registro.
     */
    static async startCampaign(input, createdById) {
        const message = (input.message || '').trim();
        if (!message) {
            throw new errorHandler_1.AppError(400, 'El mensaje no puede estar vacío');
        }
        if (input.testPhone && input.testPhone.trim()) {
            // Los envíos de prueba no persisten nada: reutilizamos el flujo de prepare.
            const { audience: _audience, maxFaltan: _maxFaltan, days: _days, ...testInput } = input;
            const prep = await this.prepareCampaign(testInput);
            return { campaignId: null, isTest: prep.isTest, messages: prep.messages, skipped: prep.skipped };
        }
        const company = await systemConfig_service_1.SystemConfigService.getCompanyName();
        let pool;
        if (input.audience) {
            const aud = await this.getAudience(input.audience, {
                branchId: input.branchId,
                recipientIds: input.recipientIds,
                maxFaltan: input.maxFaltan,
                days: input.days,
            });
            pool = aud.recipients;
        }
        else {
            pool = (await this.resolveRecipients(input)).map((r) => ({ ...r, extra: {} }));
        }
        const messages = [];
        const skipped = [];
        const pendingRows = [];
        const skippedRows = [];
        for (const recipient of pool) {
            const name = `${recipient.firstName} ${recipient.lastName}`.trim();
            const label = `${name} (${recipient.dni})`;
            if (!recipient.phone || !recipient.phone.trim()) {
                skipped.push({ name: label, phone: null, reason: 'Sin teléfono' });
                skippedRows.push({
                    clientId: recipient.id, clientName: name, dni: recipient.dni, phone: null,
                    message, status: 'OMITIDO', reason: 'Sin teléfono',
                });
                continue;
            }
            const phone = whatsapp_service_1.whatsappService.formatPhoneNumber(recipient.phone);
            if (!phone) {
                skipped.push({ name: label, phone: recipient.phone, reason: 'Teléfono inválido para WhatsApp' });
                skippedRows.push({
                    clientId: recipient.id, clientName: name, dni: recipient.dni, phone: recipient.phone,
                    message, status: 'OMITIDO', reason: 'Teléfono inválido para WhatsApp',
                });
                continue;
            }
            const rendered = whatsapp_service_1.whatsappService.renderTemplate(message, {
                nombre: recipient.firstName,
                apellido: recipient.lastName,
                dni: recipient.dni,
                puntos: recipient.lastPointsEarned,
                total: recipient.currentPoints,
                empresa: company,
                ...recipient.extra,
            });
            messages.push({ id: recipient.id, name: label, phone, message: rendered });
            pendingRows.push({
                clientId: recipient.id, clientName: name, dni: recipient.dni, phone: recipient.phone,
                message: rendered, status: 'PENDIENTE',
            });
        }
        if (messages.length === 0 && skipped.length === 0) {
            throw new errorHandler_1.AppError(400, 'La campaña no tiene destinatarios para el criterio elegido');
        }
        const campaign = await prisma_1.prisma.campaign.create({
            data: {
                name: (message.split('\n')[0] || message).trim().slice(0, 60) || 'Campaña',
                message,
                audience: input.audience ?? null,
                branchId: input.branchId ?? null,
                scope: input.recipientIds && input.recipientIds.length > 0 ? 'SELECCIONADOS' : 'TODOS',
                createdById: createdById ?? null,
                deliveries: {
                    create: [...pendingRows, ...skippedRows],
                },
            },
        });
        return { campaignId: campaign.id, isTest: false, messages, skipped };
    }
    /** Campañas sin terminar (para ofrecer "Retomar envío" al volver a entrar). */
    static async getActiveCampaigns(limit = 5) {
        const campaigns = await prisma_1.prisma.campaign.findMany({
            where: { status: 'ENVIANDO' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { deliveries: { select: { status: true } } },
        });
        return campaigns.map((c) => {
            const total = c.deliveries.length;
            const sent = c.deliveries.filter((d) => d.status === 'ENVIADO').length;
            const skipped = c.deliveries.filter((d) => d.status !== 'ENVIADO' && d.status !== 'PENDIENTE').length;
            return {
                id: c.id,
                name: c.name,
                audience: c.audience,
                status: c.status,
                createdAt: c.createdAt,
                total,
                sent,
                skipped,
                pending: total - sent - skipped,
            };
        });
    }
    /** Progreso de una campaña + los destinatarios todavía pendientes. */
    static async getCampaign(id) {
        const c = await prisma_1.prisma.campaign.findUnique({
            where: { id },
            include: { deliveries: { orderBy: { createdAt: 'asc' } } },
        });
        if (!c)
            throw new errorHandler_1.AppError(404, 'Campaña no encontrada');
        const messages = [];
        for (const d of c.deliveries) {
            if (d.status !== 'PENDIENTE' || !d.phone)
                continue;
            const phone = whatsapp_service_1.whatsappService.formatPhoneNumber(d.phone);
            if (!phone)
                continue;
            messages.push({ id: d.clientId, name: `${d.clientName} (${d.dni})`, phone, message: d.message });
        }
        const total = c.deliveries.length;
        const sent = c.deliveries.filter((d) => d.status === 'ENVIADO').length;
        const skipped = c.deliveries.filter((d) => d.status !== 'ENVIADO' && d.status !== 'PENDIENTE').length;
        return {
            progress: {
                id: c.id,
                name: c.name,
                audience: c.audience,
                status: c.status,
                createdAt: c.createdAt,
                total,
                sent,
                skipped,
                pending: total - sent - skipped,
            },
            messages,
        };
    }
    /**
     * Marca un destinatario como procesado. La actualización es condicional
     * (sólo si sigue PENDIENTE): si ya estaba marcado, no se pisa el estado
     * y se devuelve alreadyProcessed=true. Al no quedar pendientes, la campaña
     * pasa a COMPLETADA.
     */
    static async ackDelivery(campaignId, clientId, status, reason) {
        const existing = await prisma_1.prisma.campaignDelivery.findUnique({
            where: { campaignId_clientId: { campaignId, clientId } },
            select: { status: true },
        });
        if (!existing)
            throw new errorHandler_1.AppError(404, 'Destinatario no encontrado en esta campaña');
        let currentStatus = existing.status;
        if (existing.status === 'PENDIENTE') {
            await prisma_1.prisma.campaignDelivery.updateMany({
                where: { campaignId, clientId, status: 'PENDIENTE' },
                data: { status, reason: reason ?? null, sentAt: status === 'ENVIADO' ? new Date() : null },
            });
            currentStatus = status;
        }
        const pending = await prisma_1.prisma.campaignDelivery.count({ where: { campaignId, status: 'PENDIENTE' } });
        if (pending === 0) {
            await prisma_1.prisma.campaign.updateMany({ where: { id: campaignId, status: 'ENVIANDO' }, data: { status: 'COMPLETADA' } });
        }
        return { status: currentStatus, alreadyProcessed: existing.status !== 'PENDIENTE', pending };
    }
    /** Descarta una campaña: los pendientes quedan OMITIDos y el registro, CANCELADA. */
    static async cancelCampaign(id) {
        const campaign = await prisma_1.prisma.campaign.findUnique({ where: { id }, select: { id: true } });
        if (!campaign)
            throw new errorHandler_1.AppError(404, 'Campaña no encontrada');
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.campaignDelivery.updateMany({
                where: { campaignId: id, status: 'PENDIENTE' },
                data: { status: 'OMITIDO', reason: 'Campaña descartada' },
            }),
            prisma_1.prisma.campaign.update({ where: { id }, data: { status: 'CANCELADA' } }),
        ]);
    }
}
exports.CampaignService = CampaignService;
//# sourceMappingURL=campaign.service.js.map