import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller()
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // POST /orders — crear solicitud de pedido (cliente).
  @Post('orders')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, user.priceTier, dto);
  }

  // GET /orders/mine — mis pedidos (cliente).
  @Get('orders/mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.orders.findMine(user.id);
  }

  // GET /admin/orders — todos los pedidos (admin).
  @Get('admin/orders')
  @Roles('admin')
  findAll() {
    return this.orders.findAll();
  }

  // PATCH /admin/orders/:id — cambiar estado (admin).
  @Patch('admin/orders/:id')
  @Roles('admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto.status);
  }

  // PATCH /admin/orders/:id/cancel — cancelar con observación (admin).
  @Patch('admin/orders/:id/cancel')
  @Roles('admin')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancel(id, dto.reason);
  }
}
