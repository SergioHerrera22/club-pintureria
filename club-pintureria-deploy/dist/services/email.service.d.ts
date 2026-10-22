declare class EmailService {
    private transporter;
    private getTransporter;
    sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean>;
    sendWelcomeEmail(email: string, firstName: string): Promise<void>;
    sendPointsEarnedEmail(email: string, firstName: string, points: number, newBalance: number): Promise<void>;
    sendRedemptionConfirmationEmail(email: string, firstName: string, prizeName: string, pointsSpent: number, newBalance: number): Promise<void>;
    sendPointsExpiringEmail(email: string, firstName: string, points: number, daysLeft: number): Promise<void>;
    sendBirthdayBonusEmail(email: string, firstName: string, bonusPoints: number): Promise<void>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.service.d.ts.map