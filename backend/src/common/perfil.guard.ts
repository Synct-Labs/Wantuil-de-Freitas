import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PerfilGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<string[]>('perfis', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perfis || perfis.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return perfis.includes(user?.perfil);
  }
}
