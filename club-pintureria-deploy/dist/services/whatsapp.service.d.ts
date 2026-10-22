export type WhatsAppTemplateVars = Record<string, string | number | undefined | null>;
declare class WhatsAppService {
    private client;
    private getClient;
    sendMessage(to: string, body: string): Promise<boolean>;
    formatPhoneNumber(phone: string): string | null;
    renderTemplate(template: string, vars?: WhatsAppTemplateVars): string;
    sendPointsEarnedNotification(phone: string, firstName: string, pointsEarned: number, newBalance: number): Promise<boolean>;
    sendRedemptionNotification(phone: string, firstName: string, prizeName: string, pointsSpent: number, newBalance: number): Promise<boolean>;
    sendWelcomeNotification(phone: string, firstName: string): Promise<boolean>;
    sendExpiringNotification(phone: string, firstName: string, points: number, daysLeft: number): Promise<boolean>;
}
export declare const whatsappService: WhatsAppService;
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map