import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import type { OrderStatus } from '@prisma/client';

const STATUS_COPY: Record<OrderStatus, { subject: string; heading: string; body: string }> = {
  requested: {
    subject: 'Recibimos tu solicitud de pedido',
    heading: '¡Recibimos tu solicitud! 🧾',
    body: 'Tu pedido quedó registrado. El equipo de Masamor lo revisará y confirmará pronto.',
  },
  confirmed: {
    subject: 'Tu pedido fue confirmado',
    heading: '¡Pedido confirmado! ✅',
    body: 'Confirmamos tu pedido y comenzaremos a prepararlo.',
  },
  in_production: {
    subject: 'Tu pedido está en producción',
    heading: 'Manos a la masa 🧑‍🍳',
    body: 'Tu pedido está en producción en nuestro horno.',
  },
  shipped: {
    subject: 'Tu pedido va en camino',
    heading: '¡En camino! 🚚',
    body: 'Tu pedido fue despachado y va rumbo a ti.',
  },
  delivered: {
    subject: 'Tu pedido fue entregado',
    heading: '¡Entregado! 🎉',
    body: '¡Tu pedido fue entregado! Gracias por confiar en Masamor.',
  },
  cancelled: {
    subject: 'Tu pedido fue cancelado',
    heading: 'Pedido cancelado',
    body: 'Lamentamos informarte que tu pedido fue cancelado.',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.resend = key ? new Resend(key) : null;
    this.from = process.env.RESEND_FROM ?? 'Masamor <onboarding@resend.dev>';
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — los emails se omiten (se registran en log).',
      );
    }
  }

  /** Notifica al cliente un cambio de estado. Nunca lanza: no debe romper el flujo. */
  async sendOrderStatus(
    to: string | undefined,
    params: { orderId: string; status: OrderStatus; reason?: string | null },
  ): Promise<void> {
    const { orderId, status, reason } = params;
    const copy = STATUS_COPY[status];
    const shortId = orderId.slice(0, 8);

    if (!to) {
      this.logger.warn(`Sin email de destino para pedido #${shortId}`);
      return;
    }

    if (!this.resend) {
      this.logger.log(
        `[email omitido] a ${to} · pedido #${shortId} · ${status}${
          reason ? ` · motivo: ${reason}` : ''
        }`,
      );
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `${copy.subject} · Pedido #${shortId}`,
        html: this.render(copy, shortId, reason),
      });
      this.logger.log(`Email enviado a ${to} · pedido #${shortId} · ${status}`);
    } catch (err) {
      this.logger.error(
        `Falló el envío de email (pedido #${shortId}): ${(err as Error).message}`,
      );
    }
  }

  private render(
    copy: { heading: string; body: string },
    shortId: string,
    reason?: string | null,
  ): string {
    const portalUrl = `${this.frontendUrl}/portal/orders`;
    return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f9f5ef;padding:32px">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaddce">
        <div style="background:#4e2d1e;padding:24px;text-align:center">
          <div style="color:#f9e6c8;font-size:26px;font-weight:700;letter-spacing:.3px">Masamor</div>
          <div style="color:#ebaba2;font-size:13px;margin-top:2px">Calidad, horno y corazón</div>
        </div>
        <div style="padding:28px">
          <h1 style="color:#4e2d1e;font-size:20px;margin:0 0 12px">${copy.heading}</h1>
          <p style="color:#5b4636;font-size:15px;line-height:1.6;margin:0 0 8px">${copy.body}</p>
          <p style="color:#8a7a6c;font-size:13px;margin:0 0 20px">Pedido <strong>#${shortId}</strong></p>
          ${
            reason
              ? `<div style="background:#fdecec;border-radius:10px;padding:12px 14px;color:#b23b3b;font-size:14px;margin-bottom:20px"><strong>Motivo:</strong> ${reason}</div>`
              : ''
          }
          <a href="${portalUrl}" style="display:inline-block;background:#ee7264;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">Ver mi pedido</a>
        </div>
      </div>
      <p style="text-align:center;color:#b3a595;font-size:12px;margin-top:16px">© Masamor · Este es un mensaje automático.</p>
    </div>`;
  }
}
