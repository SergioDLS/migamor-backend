import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email?: string;
  role: 'restaurant' | 'entrepreneur' | 'admin';
  priceTier: 'wholesale' | 'retail';
  businessName: string | null;
}

/** Inyecta el usuario autenticado (poblado por SupabaseAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
