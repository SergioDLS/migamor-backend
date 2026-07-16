import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PriceTier } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catálogo activo con el precio correspondiente al tier del usuario.
   * Precios diferenciados por segmento B2B (wholesale / retail).
   */
  async findAllForTier(tier: PriceTier) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        prices: { where: { tier }, select: { price: true } },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      tier,
      price: p.prices[0] ? Number(p.prices[0].price) : null,
    }));
  }
}
