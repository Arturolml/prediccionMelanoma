
import { SetMetadata } from '@nestjs/common';
import { tipo_rol } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: tipo_rol[]) => SetMetadata(ROLES_KEY, roles);
