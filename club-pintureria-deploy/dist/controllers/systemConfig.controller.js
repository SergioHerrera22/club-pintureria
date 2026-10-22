"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDefaultConfigs = exports.deleteSystemConfig = exports.updateSystemConfig = exports.getSystemConfigByKey = exports.getSystemConfigs = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const systemConfig_service_1 = require("../services/systemConfig.service");
const whatsappTemplatesSchema = zod_1.z.object({
    points_earned: zod_1.z.string().optional(),
    welcome: zod_1.z.string().optional(),
    redemption: zod_1.z.string().optional(),
    points_expiring: zod_1.z.string().optional(),
    campaign_default: zod_1.z.string().optional(),
}).passthrough();
const valueSchemas = {
    email_notifications_enabled: zod_1.z.object({ enabled: zod_1.z.boolean() }),
    whatsapp_notifications_enabled: zod_1.z.object({ enabled: zod_1.z.boolean() }),
    points_expiry_days: zod_1.z.object({ days: zod_1.z.number().int().nonnegative() }),
    points_expiry_warning_days: zod_1.z.object({ days: zod_1.z.number().int().positive() }),
    min_purchase_for_points: zod_1.z.object({ amount: zod_1.z.number().nonnegative() }),
    max_points_per_purchase: zod_1.z.object({ limit: zod_1.z.number().nonnegative() }),
    redemption_min_points: zod_1.z.object({ points: zod_1.z.number().int().nonnegative() }),
    company_name: zod_1.z.object({ name: zod_1.z.string().min(1) }),
    company_logo_url: zod_1.z.object({ url: zod_1.z.string() }),
    support_email: zod_1.z.object({ email: zod_1.z.string().email() }),
    support_phone: zod_1.z.object({ phone: zod_1.z.string().min(1) }),
    whatsapp_templates: whatsappTemplatesSchema,
};
const getSystemConfigs = async (req, res, next) => {
    try {
        const configs = await prisma_1.prisma.systemConfig.findMany({
            orderBy: { key: 'asc' },
        });
        res.json({ configs });
    }
    catch (error) {
        next(error);
    }
};
exports.getSystemConfigs = getSystemConfigs;
const getSystemConfigByKey = async (req, res, next) => {
    try {
        const { key } = req.params;
        const config = await prisma_1.prisma.systemConfig.findUnique({ where: { key } });
        if (!config)
            throw new errorHandler_1.AppError(404, 'Configuración no encontrada');
        res.json(config);
    }
    catch (error) {
        next(error);
    }
};
exports.getSystemConfigByKey = getSystemConfigByKey;
const updateSystemConfig = async (req, res, next) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        if (!systemConfig_service_1.SYSTEM_CONFIG_KEYS.includes(key)) {
            throw new errorHandler_1.AppError(400, `Clave de configuración no válida. Claves permitidas: ${systemConfig_service_1.SYSTEM_CONFIG_KEYS.join(', ')}`);
        }
        const valueSchema = valueSchemas[key];
        let sanitizedValue = value;
        if (valueSchema) {
            const parsed = valueSchema.safeParse(value);
            if (!parsed.success) {
                const detail = parsed.error.errors.map(e => `${e.path.join('.') || 'value'}: ${e.message}`).join('; ');
                throw new errorHandler_1.AppError(400, `Valor inválido para '${key}': ${detail}`);
            }
            sanitizedValue = parsed.data;
        }
        const config = await prisma_1.prisma.systemConfig.upsert({
            where: { key },
            update: { value: sanitizedValue, description },
            create: { key, value: sanitizedValue, description },
        });
        res.json(config);
    }
    catch (error) {
        next(error);
    }
};
exports.updateSystemConfig = updateSystemConfig;
const deleteSystemConfig = async (req, res, next) => {
    try {
        const { key } = req.params;
        await prisma_1.prisma.systemConfig.delete({ where: { key } });
        res.json({ message: 'Configuración eliminada' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteSystemConfig = deleteSystemConfig;
const initializeDefaultConfigs = async (req, res, next) => {
    try {
        const defaultConfigs = [
            {
                key: 'email_notifications_enabled',
                value: { enabled: true },
                description: 'Habilitar notificaciones por email',
            },
            {
                key: 'whatsapp_notifications_enabled',
                value: { enabled: true },
                description: 'Habilitar notificaciones por WhatsApp',
            },
            {
                key: 'points_expiry_days',
                value: { days: 0 },
                description: 'Días de inactividad para que venzan los puntos (0 = sin vencimiento)',
            },
            {
                key: 'points_expiry_warning_days',
                value: { days: 7 },
                description: 'Días de antelación para avisar sobre vencimiento de puntos',
            },
            {
                key: 'min_purchase_for_points',
                value: { amount: 1000 },
                description: 'Monto mínimo de compra para que las reglas de puntos por compra generen puntos',
            },
            {
                key: 'max_points_per_purchase',
                value: { limit: 10000 },
                description: 'Máximo de puntos que se pueden ganar en una sola compra (0 = sin límite)',
            },
            {
                key: 'redemption_min_points',
                value: { points: 100 },
                description: 'Mínimo de puntos en saldo para poder canjear premios (0 = sin mínimo)',
            },
            {
                key: 'company_name',
                value: { name: 'Robles Pinturerias' },
                description: 'Nombre de la empresa para comunicaciones',
            },
            {
                key: 'company_logo_url',
                value: { url: '' },
                description: 'URL del logo de la empresa',
            },
            {
                key: 'support_email',
                value: { email: 'soporte@clubrobles.com' },
                description: 'Email de soporte para comunicaciones',
            },
            {
                key: 'support_phone',
                value: { phone: '+54 11 1234-5678' },
                description: 'Teléfono de soporte',
            },
            {
                key: 'whatsapp_templates',
                value: { ...systemConfig_service_1.DEFAULT_WHATSAPP_TEMPLATES },
                description: 'Plantillas editables de los mensajes de WhatsApp. Variables: {nombre}, {apellido}, {dni}, {empresa}, {puntos} (puntos de la compra; en campañas, los de la última compra), {total} (saldo acumulado), {monto}, {ticket}, {sucursal}, {fecha} (sólo en la plantilla de compra), {premio} (canje), {dias} (vencimiento)',
            },
        ];
        // Solo crear las que faltan: no sobrescribir valores personalizados por el admin
        const existing = await prisma_1.prisma.systemConfig.findMany({ select: { key: true } });
        const existingKeys = new Set(existing.map(c => c.key));
        const missing = defaultConfigs.filter(c => !existingKeys.has(c.key));
        if (missing.length > 0) {
            await prisma_1.prisma.systemConfig.createMany({ data: missing });
        }
        const configs = await prisma_1.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
        res.json({ configs, created: missing.length, skipped: defaultConfigs.length - missing.length });
    }
    catch (error) {
        next(error);
    }
};
exports.initializeDefaultConfigs = initializeDefaultConfigs;
//# sourceMappingURL=systemConfig.controller.js.map