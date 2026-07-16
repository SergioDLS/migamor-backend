import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restringe un handler a los roles indicados. Uso: @Roles('admin') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
