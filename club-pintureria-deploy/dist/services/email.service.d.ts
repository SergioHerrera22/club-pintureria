declare class EmailService {
    private transporter;
    private getTransporter;
    sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean>;
    sendWelcomeEmail(email: string, firstName: string): Promise<void>;
    sendPointsEarnedEmail(email: string, firstName: string, points: number, newBalance: number): Promise<void>;
    sendRedemptionConfirmationEmail(email: string, firstName: string, prizeName: string, pointsSpent: number, newBalance: number): Promise<void>;
    sendPointsExpiringEmail(email: string, firstName: string, points: number, daysLeft: number): Promise<void>;
    /**
     * Enlace para restablecer la contraseña (un solo uso, vence en 30 minutos).
     * Devuelve false si el correo no pudo enviarse (SMTP sin configurar u error).
     */
    sendPasswordResetEmail(email: string, firstName: string, resetLink: string): Promise<boolean>;
    sendBirthdayBonusEmail(email: string, firstName: string, bonusPoints: number): Promise<void>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.service.d.ts.map