import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Valida el JWT emitido por Supabase Auth y adjunta el usuario + su perfil
 * (rol, price_tier) al request. No duplica la autenticación: solo verifica
 * el token emitido por Supabase.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token faltante');

    const { data, error } = await this.supabase.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token inválido');

    // Perfil extendido (rol + tier). Se autocrea vía trigger al registrarse.
    const profile = await this.prisma.profile.findUnique({
      where: { id: data.user.id },
      select: { role: true, priceTier: true, businessName: true },
    });

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role ?? 'entrepreneur',
      priceTier: profile?.priceTier ?? 'retail',
      businessName: profile?.businessName ?? null,
    };

    return true;
  }
}
