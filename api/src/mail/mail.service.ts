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
    return process.env.SMTP_FROM || 'ORBIT <no-reply@nei-isep.org>';
  }

  async sendWelcomeEmail(to: string, name: string, password: string) {
    const subject = 'Bem-vindo ao ORBIT — as tuas credenciais de acesso';
    const text = [
      `Olá ${name},`,
      '',
      'A tua conta ORBIT foi criada com sucesso.',
      '',
      `Email: ${to}`,
      `Password: ${password}`,
      '',
      'Recomendamos que alteres a tua palavra-passe após o primeiro login.',
      'Acede em: https://orbit.nei-isep.org',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h2 style="font-size: 18px;">Bem-vindo ao ORBIT</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>A tua conta ORBIT foi criada com sucesso.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; color: #555;">Email</td><td style="padding: 6px 12px; font-weight: 600;">${to}</td></tr>
          <tr><td style="padding: 6px 12px; color: #555;">Password</td><td style="padding: 6px 12px; font-weight: 600;">${password}</td></tr>
        </table>
        <p style="font-size: 13px; color: #777;">Recomendamos que alteres a tua palavra-passe após o primeiro login.</p>
        <a href="https://orbit.nei-isep.org" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Aceder ao ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Welcome email for ${name} <${to}> — password: ${password}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }

  async sendAnnouncementNotification(to: string, userName: string, title: string, content: string, origin: string) {
    const subject = `[ORBIT] ${title}`;
    const text = [
      `Olá ${userName},`,
      '',
      `Foi publicado um novo anúncio (${origin}):`,
      '',
      title,
      '',
      content,
      '',
      'Acede ao ORBIT para veres mais detalhes.',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <p style="font-size: 14px; color: #555;">Olá <strong>${userName}</strong>,</p>
        <p style="font-size: 13px; color: #777;">Foi publicado um novo anúncio (${origin}):</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <h3 style="margin: 0 0 8px; font-size: 15px;">${title}</h3>
          <p style="margin: 0; font-size: 13px; color: #555; white-space: pre-wrap;">${content}</p>
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/announcements" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Announcement notification for ${userName} <${to}>: ${title}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }

  async sendTaskAssigned(to: string, userName: string, taskTitle: string, boardName?: string) {
    const subject = `[ORBIT] Task atribuída: ${taskTitle}`;
    const where = boardName ? ` no board "${boardName}"` : '';
    const text = [
      `Olá ${userName},`,
      '',
      `Foi-te atribuída uma task${where}:`,
      '',
      taskTitle,
      '',
      'Acede ao ORBIT para veres a task.',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <p style="font-size: 14px; color: #555;">Olá <strong>${userName}</strong>,</p>
        <p style="font-size: 13px; color: #777;">Foi-te atribuída uma task${where}:</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${taskTitle}</p>
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/tasks" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Task assigned to ${userName} <${to}>: ${taskTitle}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }

  async sendPlanStatusUpdate(to: string, userName: string, planName: string, status: string, rejectionNote?: string) {
    const statusLabel = status === 'APPROVED' ? 'aprovado' : status === 'REJECTED' ? 'rejeitado' : status;
    const subject = `[ORBIT] Plano ${statusLabel}: ${planName}`;
    const text = [
      `Olá ${userName},`,
      '',
      `O teu plano "${planName}" foi ${statusLabel}.`,
      ...(rejectionNote ? ['', `Motivo: ${rejectionNote}`] : []),
      '',
      'Acede ao ORBIT para veres mais detalhes.',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <p style="font-size: 14px; color: #555;">Olá <strong>${userName}</strong>,</p>
        <p style="font-size: 13px; color: #777;">O teu plano foi <strong>${statusLabel}</strong>:</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${planName}</p>
          ${rejectionNote ? `<p style="margin: 8px 0 0; font-size: 13px; color: #dc2626;">Motivo: ${rejectionNote}</p>` : ''}
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/plans" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Plan ${statusLabel} for ${userName} <${to}>: ${planName}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
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

  async sendPasswordChanged(to: string, userName: string) {
    const subject = 'ORBIT — Palavra-passe alterada';
    const text = [
      `Olá ${userName},`,
      '',
      'A palavra-passe da tua conta ORBIT foi alterada com sucesso.',
      '',
      'Se não foste tu a fazer esta alteração, contacta o administrador do sistema imediatamente.',
      '',
      'Acede em: https://orbit.nei-isep.org',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h2 style="font-size: 18px;">Palavra-passe alterada</h2>
        <p>Olá <strong>${userName}</strong>,</p>
        <p>A palavra-passe da tua conta ORBIT foi alterada com sucesso.</p>
        <div style="border: 1px solid #fbbf24; background: #fffbeb; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            <strong>⚠ Atenção:</strong> Se não foste tu a fazer esta alteração, contacta o administrador do sistema imediatamente.
          </p>
        </div>
        <a href="https://orbit.nei-isep.org" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Aceder ao ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(`[DEV] Password changed notification for ${userName} <${to}>`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }
}
