import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';

/**
 * Verifica el rol del usuario (poblado por SupabaseAuthGuard) contra los
 * roles requeridos por @Roles(). Autorización a nivel de aplicación que
 * replica la lógica de roles del RLS (porque el backend usa la secret key).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('No autorizado para este recurso');
    }
    return true;
  }
}
