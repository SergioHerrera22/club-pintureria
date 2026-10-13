"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
class EmailService {
    transporter = null;
    getTransporter() {
        if (!this.transporter) {
            this.transporter = nodemailer_1.default.createTransport({
                host: config_1.config.email.host,
                port: config_1.config.email.port,
                secure: config_1.config.email.secure,
                auth: {
                    user: config_1.config.email.user,
                    pass: config_1.config.email.pass,
                },
            });
        }
        return this.transporter;
    }
    async sendEmail(to, subject, html, text) {
        if (!config_1.config.email.user || !config_1.config.email.pass) {
            console.warn('Email no configurado, saltando envío');
            return false;
        }
        try {
            await this.getTransporter().sendMail({
                from: config_1.config.email.from,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, ''),
            });
            return true;
        }
        catch (error) {
            console.error('Error enviando email:', error);
            return false;
        }
    }
    async sendWelcomeEmail(email, firstName) {
        const html = `
      <h1>¡Bienvenido al Club Robles, ${firstName}!</h1>
      <p>Gracias por unirte a nuestro programa de fidelidad.</p>
      <p>Comienza a ganar puntos en cada compra y canjéalos por increíbles premios.</p>
      <p>Visita tu sucursal más cercana y presenta tu DNI para empezar.</p>
    `;
        await this.sendEmail(email, 'Bienvenido al Club Robles', html);
    }
    async sendPointsEarnedEmail(email, firstName, points, newBalance) {
        const html = `
      <h1>¡Ganaste ${points} puntos, ${firstName}!</h1>
      <p>Tu nuevo saldo es de <strong>${newBalance} puntos</strong>.</p>
      <p>Sigue comprando para alcanzar los mejores premios.</p>
    `;
        await this.sendEmail(email, `Ganaste ${points} puntos en Club Robles`, html);
    }
    async sendRedemptionConfirmationEmail(email, firstName, prizeName, pointsSpent, newBalance) {
        const html = `
      <h1>Canje confirmado, ${firstName}</h1>
      <p>Has canjeado <strong>${prizeName}</strong> por ${pointsSpent} puntos.</p>
      <p>Tu saldo actual: <strong>${newBalance} puntos</strong>.</p>
      <p>Pasa por la sucursal para retirar tu premio.</p>
    `;
        await this.sendEmail(email, 'Canje confirmado - Club Robles', html);
    }
    async sendPointsExpiringEmail(email, firstName, points, daysLeft) {
        const html = `
      <h1>Tus puntos están por vencer, ${firstName}</h1>
      <p>Tienes <strong>${points} puntos</strong> que vencen en <strong>${daysLeft} días</strong>.</p>
      <p>¡No los pierdas! Realiza una compra para mantenerlos activos.</p>
    `;
        await this.sendEmail(email, 'Tus puntos vencen pronto - Club Robles', html);
    }
    async sendBirthdayBonusEmail(email, firstName, bonusPoints) {
        const html = `
      <h1>¡Feliz Cumpleaños, ${firstName}!</h1>
      <p>Te regalamos <strong>${bonusPoints} puntos extra</strong> por tu día.</p>
      <p>¡Disfruta tu día y sigue ganando con Club Robles!</p>
    `;
        await this.sendEmail(email, '¡Feliz Cumpleaños! - Club Robles', html);
    }
}
exports.emailService = new EmailService();
//# sourceMappingURL=email.service.js.map