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
      <h1>¡Bienvenido a Robles Pinturerias, ${firstName}!</h1>
      <p>Gracias por unirte a nuestro programa de fidelidad.</p>
      <p>Comienza a ganar puntos en cada compra y canjéalos por increíbles premios.</p>
      <p>Visita tu sucursal más cercana y presenta tu DNI para empezar.</p>
    `;
    await this.sendEmail(email, 'Bienvenido a Robles Pinturerias', html);
  }
  
  async sendPointsEarnedEmail(email: string, firstName: string, points: number, newBalance: number): Promise<void> {
    const html = `
      <h1>¡Ganaste ${points} puntos, ${firstName}!</h1>
      <p>Tu nuevo saldo es de <strong>${newBalance} puntos</strong>.</p>
      <p>Sigue comprando para alcanzar los mejores premios.</p>
    `;
    await this.sendEmail(email, `Ganaste ${points} puntos en Robles Pinturerias`, html);
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
    await this.sendEmail(email, 'Canje confirmado - Robles Pinturerias', html);
  }
  
  async sendPointsExpiringEmail(email: string, firstName: string, points: number, daysLeft: number): Promise<void> {
    const html = `
      <h1>Tus puntos están por vencer, ${firstName}</h1>
      <p>Tienes <strong>${points} puntos</strong> que vencen en <strong>${daysLeft} días</strong>.</p>
      <p>¡No los pierdas! Realiza una compra para mantenerlos activos.</p>
    `;
    await this.sendEmail(email, 'Tus puntos vencen pronto - Robles Pinturerias', html);
  }
  
  /**
   * Enlace para restablecer la contraseña (un solo uso, vence en 30 minutos).
   * Devuelve false si el correo no pudo enviarse (SMTP sin configurar u error).
   */
  async sendPasswordResetEmail(email: string, firstName: string, resetLink: string): Promise<boolean> {
    const html = `
      <h1>Restablecer contraseña, ${firstName}</h1>
      <p>Recibimos un pedido para restablecer tu contraseña.</p>
      <p><a href="${resetLink}">Hacé clic acá para elegir una nueva</a>.</p>
      <p>Si el enlace no se abre, pegá este link en el navegador:</p>
      <p>${resetLink}</p>
      <p>Vence en 30 minutos. Si no pediste esto, ignorá este correo: tu contraseña no cambia.</p>
    `;
    return this.sendEmail(email, 'Restablecer contraseña - Robles Pinturerias', html);
  }

  async sendBirthdayBonusEmail(email: string, firstName: string, bonusPoints: number): Promise<void> {
    const html = `
      <h1>¡Feliz Cumpleaños, ${firstName}!</h1>
      <p>Te regalamos <strong>${bonusPoints} puntos extra</strong> por tu día.</p>
      <p>¡Disfruta tu día y sigue ganando con Robles Pinturerias!</p>
    `;
    await this.sendEmail(email, '¡Feliz Cumpleaños! - Robles Pinturerias', html);
  }
}

export const emailService = new EmailService();