import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERFIS_KEY, QUALQUER_LOGADO_KEY } from './perfil.decorator';

@Injectable()
export class PerfilGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Rotas marcadas com @QualquerLogado sao permitidas para qualquer autenticado
    const qualquerLogado = this.reflector.getAllAndOverride<boolean>(QUALQUER_LOGADO_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (qualquerLogado) return true;

    const perfis = this.reflector.getAllAndOverride<string[]>(PERFIS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Se nao tem @Perfis nem @QualquerLogado, permite (modo permissivo para nao quebrar rotas legadas)
    if (!perfis || perfis.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Usuario nao autenticado');

    if (!perfis.includes(user.perfil)) {
      throw new ForbiddenException(`Acesso negado. Requer perfil: ${perfis.join(' ou ')}`);
    }
    return true;
  }
}
