import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('products')
@UseGuards(SupabaseAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // GET /products — catálogo con precio según el tier del usuario.
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.products.findAllForTier(user.priceTier);
  }
}
