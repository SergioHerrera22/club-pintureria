export type WhatsAppTemplateVars = Record<string, string | number | undefined | null>;
declare class WhatsAppService {
    private client;
    private getClient;
    sendMessage(to: string, body: string): Promise<boolean>;
    formatPhoneNumber(phone: string): string | null;
    renderTemplate(template: string, vars?: WhatsAppTemplateVars): string;
    /** Formato de puntos: 1.500 (es-AR, sin decimales). */
    private formatPoints;
    /** Formato de dinero: $ 12.500 (es-AR, sin decimales). */
    private formatAmount;
    /** Fecha/hora corta: 22/10/2026, 15:10 */
    private formatDateTime;
    /**
     * Mensaje de WhatsApp de una compra para abrirlo en WhatsApp Web desde el
     * navegador de la cajera (flujo de carga de venta).
     * - Primera compra del cliente → plantilla de bienvenida.
     * - Resto → plantilla de puntos ganados (puntos de la compra + saldo acumulado).
     * Devuelve null si el cliente no tiene teléfono válido: no se abre nada.
     */
    buildPurchaseMessage(input: {
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
    } | null>;
    sendPointsEarnedNotification(phone: string, firstName: string, pointsEarned: number, newBalance: number, meta?: {
        amount?: number | null;
        receiptNumber?: string | null;
        branchName?: string | null;
    }): Promise<boolean>;
    sendRedemptionNotification(phone: string, firstName: string, prizeName: string, pointsSpent: number, newBalance: number): Promise<boolean>;
    sendWelcomeNotification(phone: string, firstName: string): Promise<boolean>;
    sendExpiringNotification(phone: string, firstName: string, points: number, daysLeft: number): Promise<boolean>;
}
export declare const whatsappService: WhatsAppService;
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map