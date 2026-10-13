import nodemailer from 'nodemailer';
import { config } from '../config';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  
  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
    return this.transporter;
  }
  
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!config.email.user || !config.email.pass) {
      console.warn('Email no configurado, saltando envío');
      return false;
    }
    
    try {
      await this.getTransporter().sendMail({
        from: config.email.from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });
      return true;
    } catch (error) {
      console.error('Error enviando email:', error);
      return false;
    }
  }
  
  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const html = `
      <h1>¡Bienvenido al Club Robles, ${firstName}!</h1>
      <p>Gracias por unirte a nuestro programa de fidelidad.</p>
      <p>Comienza a ganar puntos en cada compra y canjéalos por increíbles premios.</p>
      <p>Visita tu sucursal más cercana y presenta tu DNI para empezar.</p>
    `;
    await this.sendEmail(email, 'Bienvenido al Club Robles', html);
  }
  
  async sendPointsEarnedEmail(email: string, firstName: string, points: number, newBalance: number): Promise<void> {
    const html = `
      <h1>¡Ganaste ${points} puntos, ${firstName}!</h1>
      <p>Tu nuevo saldo es de <strong>${newBalance} puntos</strong>.</p>
      <p>Sigue comprando para alcanzar los mejores premios.</p>
    `;
    await this.sendEmail(email, `Ganaste ${points} puntos en Club Robles`, html);
  }
  
  async sendRedemptionConfirmationEmail(
    email: string,
    firstName: string,
    prizeName: string,
    pointsSpent: number,
    newBalance: number
  ): Promise<void> {
    const html = `
      <h1>Canje confirmado, ${firstName}</h1>
      <p>Has canjeado <strong>${prizeName}</strong> por ${pointsSpent} puntos.</p>
      <p>Tu saldo actual: <strong>${newBalance} puntos</strong>.</p>
      <p>Pasa por la sucursal para retirar tu premio.</p>
    `;
    await this.sendEmail(email, 'Canje confirmado - Club Robles', html);
  }
  
  async sendPointsExpiringEmail(email: string, firstName: string, points: number, daysLeft: number): Promise<void> {
    const html = `
      <h1>Tus puntos están por vencer, ${firstName}</h1>
      <p>Tienes <strong>${points} puntos</strong> que vencen en <strong>${daysLeft} días</strong>.</p>
      <p>¡No los pierdas! Realiza una compra para mantenerlos activos.</p>
    `;
    await this.sendEmail(email, 'Tus puntos vencen pronto - Club Robles', html);
  }
  
  async sendBirthdayBonusEmail(email: string, firstName: string, bonusPoints: number): Promise<void> {
    const html = `
      <h1>¡Feliz Cumpleaños, ${firstName}!</h1>
      <p>Te regalamos <strong>${bonusPoints} puntos extra</strong> por tu día.</p>
      <p>¡Disfruta tu día y sigue ganando con Club Robles!</p>
    `;
    await this.sendEmail(email, '¡Feliz Cumpleaños! - Club Robles', html);
  }
}

export const emailService = new EmailService();