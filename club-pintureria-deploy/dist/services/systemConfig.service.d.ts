export declare const SYSTEM_CONFIG_KEYS: readonly ["email_notifications_enabled", "whatsapp_notifications_enabled", "points_expiry_days", "points_expiry_warning_days", "min_purchase_for_points", "max_points_per_purchase", "redemption_min_points", "company_name", "company_logo_url", "support_email", "support_phone", "whatsapp_templates"];
export type SystemConfigKey = (typeof SYSTEM_CONFIG_KEYS)[number];
export interface WhatsAppTemplates {
    points_earned: string;
    welcome: string;
    redemption: string;
    points_expiring: string;
    campaign_default: string;
}
/**
 * Plataforma del club: el link que se comparte en los mensajes para que el
 * cliente vea sus puntos y consulte todo sobre el club.
 */
export declare const PLATFORM_URL = "https://club.roblespinturerias.com/";
/**
 * Plantillas por defecto (v3). Formato de WhatsApp: *negrita*, listas con
 * emojis y saltos de línea con \n. Variables disponibles por plantilla:
 * - points_earned: {nombre} {puntos} {total} {monto} {ticket} {sucursal} {fecha} {empresa}
 * - welcome: {nombre} {empresa}
 * - redemption: {nombre} {premio} {puntos} {total} {empresa}
 * - points_expiring: {nombre} {puntos} {dias} {empresa}
 * - campaign_default: {nombre} {apellido} {dni} {puntos} {total} {empresa}
 */
export declare const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplates;
export declare const DEFAULT_WHATSAPP_CAMPAIGN_MESSAGE: string;
export declare class SystemConfigService {
    static get<T>(key: string, fallback: T): Promise<T>;
    static getNotificationsEnabled(channel: 'email' | 'whatsapp'): Promise<boolean>;
    static getCompanyName(): Promise<string>;
    static getWhatsappTemplates(): Promise<WhatsAppTemplates>;
    static getMinPurchaseForPoints(): Promise<number>;
    static getMaxPointsPerPurchase(): Promise<number>;
    static getRedemptionMinPoints(): Promise<number>;
    static getPointsExpiryDays(): Promise<number>;
    static getPointsExpiryWarningDays(): Promise<number>;
    static hasBirthdayBonusAwardedThisYear(userId: string): Promise<boolean>;
}
//# sourceMappingURL=systemConfig.service.d.ts.map