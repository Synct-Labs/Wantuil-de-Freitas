import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, senha: string) {
    const emailNormalizado = (email || '').trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { email: emailNormalizado } });

    if (!usuario) throw new UnauthorizedException('E-mail ou senha incorretos');
    if (!usuario.ativo) throw new ForbiddenException('Usuario desativado. Contate o administrador.');

    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) throw new UnauthorizedException('E-mail ou senha incorretos');

    const payload = { sub: usuario.id, email: usuario.email, perfil: usuario.perfil, nome: usuario.nome };
    return {
      token: this.jwt.sign(payload),
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    };
  }

  async me(id: string) {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    });
    if (!u || !u.ativo) throw new UnauthorizedException();
    return u;
  }
}
