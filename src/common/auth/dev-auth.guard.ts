import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestUser } from './user.types';

/**
 * DEV ONLY auth guard.
 * Reads:
 *  - x-user-id: UUID
 *  - x-user-role: user|admin (optional, default user)
 *
 * Replace with real JWT AuthGuard in production.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const userId = (req.headers['x-user-id'] as string | undefined)?.trim();
    if (!userId) throw new UnauthorizedException('Missing x-user-id header (dev auth)');

    const roleRaw = (req.headers['x-user-role'] as string | undefined)?.trim() ?? 'user';
    const role = roleRaw === 'admin' ? 'admin' : 'user';

    const user: RequestUser = { id: userId, role };
    req.user = user;

    return true;
  }
}
