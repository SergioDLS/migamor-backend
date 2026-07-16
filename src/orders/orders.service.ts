import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { OrderStatus, PriceTier, Prisma } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';

// Máquina de estados del pedido: transiciones de avance permitidas.
// La cancelación es una transición aparte (ver cancel()).
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  requested: ['confirmed'],
  confirmed: ['in_production'],
  in_production: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Include reutilizable: ítems + historial ordenado cronológicamente.
const ORDER_INCLUDE = {
  items: { include: { product: true } },
  history: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  /** Crea una solicitud de pedido calculando precios según el tier del cliente. */
  async create(customerId: string, tier: PriceTier, dto: CreateOrderDto) {
    const productIds = dto.items.map((i) => i.productId);

    const prices = await this.prisma.productPrice.findMany({
      where: { productId: { in: productIds }, tier },
    });
    const priceByProduct = new Map(prices.map((p) => [p.productId, p.price]));

    // Valida que todos los productos existan y tengan precio para ese tier.
    for (const item of dto.items) {
      if (!priceByProduct.has(item.productId)) {
        throw new BadRequestException(
          `Producto ${item.productId} no disponible para el tier ${tier}`,
        );
      }
    }

    let total = new Prisma.Decimal(0);
    const items = dto.items.map((item) => {
      const unitPrice = priceByProduct.get(item.productId)!;
      total = total.plus(unitPrice.mul(item.quantity));
      return { productId: item.productId, quantity: item.quantity, unitPrice };
    });

    const order = await this.prisma.order.create({
      data: {
        customerId,
        notes: dto.notes,
        total,
        status: 'requested',
        items: { create: items },
        history: { create: { status: 'requested' } },
      },
      include: ORDER_INCLUDE,
    });

    await this.notify(customerId, order.id, 'requested');
    return order;
  }

  /** Pedidos del cliente autenticado (con historial de seguimiento). */
  findMine(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  /** Todos los pedidos (admin). */
  findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ...ORDER_INCLUDE,
        customer: { select: { businessName: true, role: true } },
      },
    });
  }

  /** Cambia el estado de un pedido respetando la máquina de estados (admin). */
  async updateStatus(id: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (order.status !== next && !allowed.includes(next)) {
      throw new BadRequestException(
        `Transición inválida: ${order.status} → ${next}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: next,
        history: { create: { status: next } },
      },
      include: ORDER_INCLUDE,
    });

    await this.notify(order.customerId, id, next);
    return updated;
  }

  /** Cancela un pedido con una observación obligatoria (admin). */
  async cancel(id: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    if (order.status === 'delivered') {
      throw new BadRequestException('No se puede cancelar un pedido ya entregado');
    }
    if (order.status === 'cancelled') {
      throw new BadRequestException('El pedido ya está cancelado');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellationReason: reason,
        history: { create: { status: 'cancelled', note: reason } },
      },
      include: ORDER_INCLUDE,
    });

    await this.notify(order.customerId, id, 'cancelled', reason);
    return updated;
  }

  /**
   * Notifica por email al cliente. Resuelve el email desde Supabase Auth.
   * Nunca lanza: un fallo de correo no debe romper el cambio de estado.
   */
  private async notify(
    customerId: string,
    orderId: string,
    status: OrderStatus,
    reason?: string,
  ) {
    try {
      const { data } = await this.supabase.client.auth.admin.getUserById(
        customerId,
      );
      await this.mail.sendOrderStatus(data.user?.email, {
        orderId,
        status,
        reason,
      });
    } catch {
      // silencioso: el correo es best-effort
    }
  }
}
