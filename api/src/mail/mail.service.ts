import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn(
        'SMTP_HOST not configured — emails will be logged to the console instead of sent.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }

  private get from() {
    return process.env.SMTP_FROM || 'ORBIT <noreply@nei-isep.org>';
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const subject = 'ORBIT — Repor palavra-passe';
    const text = [
      'Recebemos um pedido para repor a palavra-passe da tua conta ORBIT.',
      '',
      `Abre este link para definir uma nova palavra-passe (válido por 1 hora):`,
      resetUrl,
      '',
      'Se não foste tu a fazer este pedido, podes ignorar este email.',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h2 style="font-size: 18px;">Repor palavra-passe</h2>
        <p>Recebemos um pedido para repor a palavra-passe da tua conta ORBIT.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
            Definir nova palavra-passe
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">Este link é válido por 1 hora. Se não foste tu a fazer este pedido, ignora este email.</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">${resetUrl}</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Password reset link for ${to}: ${resetUrl}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }
}
