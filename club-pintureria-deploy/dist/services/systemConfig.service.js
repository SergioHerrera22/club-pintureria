"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemConfigService = exports.DEFAULT_WHATSAPP_CAMPAIGN_MESSAGE = exports.DEFAULT_WHATSAPP_TEMPLATES = exports.PLATFORM_URL = exports.SYSTEM_CONFIG_KEYS = void 0;
const prisma_1 = require("../config/prisma");
exports.SYSTEM_CONFIG_KEYS = [
    'email_notifications_enabled',
    'whatsapp_notifications_enabled',
    'points_expiry_days',
    'points_expiry_warning_days',
    'min_purchase_for_points',
    'max_points_per_purchase',
    'redemption_min_points',
    'company_name',
    'company_logo_url',
    'support_email',
    'support_phone',
    'whatsapp_templates',
];
/**
 * Plataforma del club: el link que se comparte en los mensajes para que el
 * cliente vea sus puntos y consulte todo sobre el club.
 */
exports.PLATFORM_URL = 'https://club.roblespinturerias.com/';
/**
 * Plantillas por defecto (v3). Formato de WhatsApp: *negrita*, listas con
 * emojis y saltos de línea con \n. Variables disponibles por plantilla:
 * - points_earned: {nombre} {puntos} {total} {monto} {ticket} {sucursal} {fecha} {empresa}
 * - welcome: {nombre} {empresa}
 * - redemption: {nombre} {premio} {puntos} {total} {empresa}
 * - points_expiring: {nombre} {puntos} {dias} {empresa}
 * - campaign_default: {nombre} {apellido} {dni} {puntos} {total} {empresa}
 * - premio_cerca: {nombre} {premio} {faltan} {total} {empresa}
 * - resumen_semanal: {nombre} {compras_semana} {puntos_semana} {periodo} {total} {empresa}
 */
exports.DEFAULT_WHATSAPP_TEMPLATES = {
    points_earned: `¡Hola {nombre}! 🛒\n\nGracias por tu compra en *{empresa}*.\n\n✅ Sumaste *{puntos} puntos*\n💰 Saldo acumulado: *{total} puntos*\n🧾 Ticket {ticket} · {monto}\n📍 {sucursal} · {fecha}\n\n🌐 Mirá tus puntos y todo sobre el club:\n${exports.PLATFORM_URL}\n\nSeguí sumando puntos y canjealos por premios. 🎁\n\n{empresa}`,
    welcome: `¡Hola {nombre}! 🎉\n\n¡Bienvenido/a a *{empresa}*!\n\nYa sos parte del club de puntos: con cada compra vas a acumular puntos para canjear por premios y descuentos.\n\n✨ Solo tenés que presentar tu DNI en caja al pagar.\n✨ Tus puntos se acreditan al instante.\n\n🌐 Ingresá con tu DNI y mirá tus puntos:\n${exports.PLATFORM_URL}\n\n¡Te esperamos!\n\n{empresa}`,
    redemption: `¡Hola {nombre}! 🎁\n\nCanjeaste *{premio}* por *{puntos} puntos*.\n💰 Saldo restante: *{total} puntos*.\n\nPasá por la sucursal a retirarlo presentando tu DNI.\n\n🌐 Mirá tus puntos y tus canjes:\n${exports.PLATFORM_URL}\n\n{empresa}`,
    points_expiring: `⏳ *{empresa}*\n\nHola {nombre}: tus *{puntos} puntos* vencen en *{dias} días* por inactividad.\n\nHacé una compra para mantenerlos activos o canjealos ahora por premios.\n\n🌐 Ingresá con tu DNI y mirá tu saldo:\n${exports.PLATFORM_URL}\n\n{empresa}`,
    campaign_default: `¡Hola {nombre}! 👋\n\n¡Tenemos novedades para vos en *{empresa}*!\n\nMirá lo nuevo y acercate a conocerlo.\n\n🌐 Ingresá con tu DNI y mirá tus puntos y promociones:\n${exports.PLATFORM_URL}\n\n{empresa}`,
    premio_cerca: `¡Hola {nombre}! 🎁\n\nEstás a un paso: te faltan *{faltan} puntos* para llevarte *{premio}*.\n\nYa tenés *{total} puntos* acumulados.\n\n🌐 Mirá tus premios y tu saldo:\n${exports.PLATFORM_URL}\n\n¡Una compra más y es tuyo!\n\n{empresa}`,
    resumen_semanal: `¡Hola {nombre}! 📊\n\nResumen de los últimos {periodo} días:\n✅ {compras_semana} compra(s)\n✅ {puntos_semana} puntos sumados\n\n💰 Saldo acumulado: *{total} puntos*\n\n🌐 Ingresá con tu DNI y mirá tus puntos:\n${exports.PLATFORM_URL}\n\n{empresa}`,
};
/**
 * Versiones anteriores de los defaults (guardadas tal cual en la DB de algunas
 * instalaciones). Si el valor almacenado coincide exactamente con alguna de
 * ellas, nadie la personalizó: en ese caso se usa el default nuevo. Las
 * plantillas que el usuario editó de verdad se respetan tal cual.
 */
const SUPERSEDED_WHATSAPP_TEMPLATES = [
    {
        points_earned: 'Hola {nombre}!\n\nGanaste *{puntos} puntos* en tu compra.\nTu nuevo saldo es: *{total} puntos*.\n\nSegui comprando para canjear por premios increibles.\n\n{empresa}',
        welcome: 'Hola {nombre}!\n\nBienvenido a *{empresa}*.\n\nTu cuenta esta lista para empezar a ganar puntos en cada compra. Presenta tu DNI en la sucursal y empeza a sumar.\n\nTe esperamos.\n\n{empresa}',
        redemption: 'Hola {nombre}!\n\nCanjeaste *{premio}* por *{puntos} puntos*.\nTu saldo actual: *{total} puntos*.\n\nPasa por la sucursal para retirar tu premio.\n\n{empresa}',
        points_expiring: 'Aviso {empresa}\n\nTus *{puntos} puntos* venceran en *{dias} dias* por inactividad.\n\nRealiza una compra para mantenerlos activos.\n\n{empresa}',
        campaign_default: 'Hola {nombre}!\n\n{empresa} tiene novedades para vos.\n\nTe esperamos.',
    },
    {
        points_earned: '¡Hola {nombre}! 🛒\n\nGracias por tu compra en *{empresa}*.\n\n✅ Sumaste *{puntos} puntos*\n💰 Saldo acumulado: *{total} puntos*\n🧾 Ticket {ticket} · {monto}\n📍 {sucursal} · {fecha}\n\nSeguí sumando puntos y canjealos por premios. 🎁\n\n{empresa}',
        welcome: '¡Hola {nombre}! 🎉\n\n¡Bienvenido/a a *{empresa}*!\n\nYa sos parte del club de puntos: con cada compra vas a acumular puntos para canjear por premios y descuentos.\n\n✨ Solo tenés que presentar tu DNI en caja al pagar.\n✨ Tus puntos se acreditan al instante.\n\n¡Te esperamos!\n\n{empresa}',
        redemption: '¡Hola {nombre}! 🎁\n\nCanjeaste *{premio}* por *{puntos} puntos*.\n💰 Saldo restante: *{total} puntos*.\n\nPasá por la sucursal a retirarlo presentando tu DNI.\n\n{empresa}',
        points_expiring: '⏳ *{empresa}*\n\nHola {nombre}: tus *{puntos} puntos* vencen en *{dias} días* por inactividad.\n\nHacé una compra para mantenerlos activos o canjealos ahora por premios.\n\n{empresa}',
        campaign_default: '¡Hola {nombre}! 👋\n\n¡Tenemos novedades para vos en *{empresa}*!\n\nMirá lo nuevo y acercate a conocerlo.\n\n{empresa}',
    },
];
exports.DEFAULT_WHATSAPP_CAMPAIGN_MESSAGE = exports.DEFAULT_WHATSAPP_TEMPLATES.campaign_default;
class SystemConfigService {
    static async get(key, fallback) {
        try {
            const config = await prisma_1.prisma.systemConfig.findUnique({ where: { key } });
            return config?.value ?? fallback;
        }
        catch {
            return fallback;
        }
    }
    static async getNotificationsEnabled(channel) {
        const key = channel === 'email' ? 'email_notifications_enabled' : 'whatsapp_notifications_enabled';
        const c = await this.get(key, { enabled: channel === 'whatsapp' });
        return c.enabled === true;
    }
    static async getCompanyName() {
        const c = await this.get('company_name', { name: 'Robles Pinturerias' });
        return (c.name && String(c.name).trim()) || 'Robles Pinturerias';
    }
    static async getWhatsappTemplates() {
        const stored = await this.get('whatsapp_templates', {});
        const templates = { ...exports.DEFAULT_WHATSAPP_TEMPLATES };
        for (const key of Object.keys(exports.DEFAULT_WHATSAPP_TEMPLATES)) {
            const value = stored?.[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                // Si es literalmente un default viejo, nadie lo personalizó: usamos el nuevo.
                const isSupersededDefault = SUPERSEDED_WHATSAPP_TEMPLATES.some((version) => value.trim() === (version[key] ?? '').trim());
                if (!isSupersededDefault) {
                    templates[key] = value;
                }
            }
        }
        return templates;
    }
    static async getMinPurchaseForPoints() {
        const c = await this.get('min_purchase_for_points', { amount: 0 });
        const amount = Number(c.amount) || 0;
        return amount > 0 ? amount : 0;
    }
    static async getMaxPointsPerPurchase() {
        const c = await this.get('max_points_per_purchase', { limit: 0 });
        const limit = Number(c.limit) || 0;
        return limit > 0 ? limit : 0;
    }
    static async getRedemptionMinPoints() {
        const c = await this.get('redemption_min_points', { points: 0 });
        const points = Number(c.points) || 0;
        return points > 0 ? points : 0;
    }
    static async getPointsExpiryDays() {
        const c = await this.get('points_expiry_days', { days: 0 });
        const days = Number(c.days) || 0;
        return days > 0 ? days : 0;
    }
    static async getPointsExpiryWarningDays() {
        const c = await this.get('points_expiry_warning_days', { days: 7 });
        const days = Number(c.days) || 7;
        return days > 0 ? days : 7;
    }
    static async hasBirthdayBonusAwardedThisYear(userId) {
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const count = await prisma_1.prisma.notification.count({
            where: { userId, type: 'BIRTHDAY_BONUS', createdAt: { gte: yearStart } },
        });
        return count > 0;
    }
}
exports.SystemConfigService = SystemConfigService;
//# sourceMappingURL=systemConfig.service.js.map