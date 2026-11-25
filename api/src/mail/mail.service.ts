import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { sanitizeAnnouncementHtml } from '../announcements/announcement-html';

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (process.env.NODE_ENV === 'production' && (!host || !user || !pass)) {
      throw new Error('Production requires authenticated SMTP configuration.');
    }
    if (!host) {
      this.logger.warn('SMTP_HOST is unset. Outgoing mail is disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.NODE_ENV === 'production',
      disableFileAccess: true,
      disableUrlAccess: true,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private get from() {
    return process.env.SMTP_FROM || 'ORBIT <no-reply@nei-isep.org>';
  }

  async sendAnnouncementNotification(
    to: string,
    userName: string,
    title: string,
    content: string,
    origin: string,
  ) {
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
        <p style="font-size: 14px; color: #555;">Olá <strong>${escapeHtml(userName)}</strong>,</p>
        <p style="font-size: 13px; color: #777;">Foi publicado um novo anúncio (${escapeHtml(origin)}):</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <h3 style="margin: 0 0 8px; font-size: 15px;">${escapeHtml(title)}</h3>
          <div style="margin: 0; font-size: 13px; color: #555;">${sanitizeAnnouncementHtml(content)}</div>
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/announcements" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV] Announcement notification for ${userName} <${to}>: ${title}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }

  async sendTaskAssigned(
    to: string,
    userName: string,
    taskTitle: string,
    boardName?: string,
  ) {
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
        <p style="font-size: 14px; color: #555;">Olá <strong>${escapeHtml(userName)}</strong>,</p>
        <p style="font-size: 13px; color: #777;">Foi-te atribuída uma task${escapeHtml(where)}:</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${escapeHtml(taskTitle)}</p>
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/tasks" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV] Task assigned to ${userName} <${to}>: ${taskTitle}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }

  async sendPlanStatusUpdate(
    to: string,
    userName: string,
    planName: string,
    status: string,
    rejectionNote?: string,
  ) {
    const statusLabel =
      status === 'APPROVED'
        ? 'aprovado'
        : status === 'REJECTED'
          ? 'rejeitado'
          : status;
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
        <p style="font-size: 14px; color: #555;">Olá <strong>${escapeHtml(userName)}</strong>,</p>
        <p style="font-size: 13px; color: #777;">O teu plano foi <strong>${escapeHtml(statusLabel)}</strong>:</p>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600;">${escapeHtml(planName)}</p>
          ${rejectionNote ? `<p style="margin: 8px 0 0; font-size: 13px; color: #dc2626;">Motivo: ${escapeHtml(rejectionNote)}</p>` : ''}
        </div>
        <a href="https://orbit.nei-isep.org/dashboard/plans" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
          Ver no ORBIT
        </a>
      </div>
    `;

    if (!this.transporter) {
      this.logger.log(
        `[DEV] Plan ${statusLabel} for ${userName} <${to}>: ${planName}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
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
          <a href="${escapeHtml(resetUrl)}" style="display: inline-block; padding: 10px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;">
            Definir nova palavra-passe
          </a>
        </p>
        <p style="font-size: 13px; color: #555;">Este link é válido por 1 hora. Se não foste tu a fazer este pedido, ignora este email.</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">${escapeHtml(resetUrl)}</p>
      </div>
    `;

    if (!this.transporter) return;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
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
        <p>Olá <strong>${escapeHtml(userName)}</strong>,</p>
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
      this.logger.log(
        `[DEV] Password changed notification for ${userName} <${to}>`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }
}
