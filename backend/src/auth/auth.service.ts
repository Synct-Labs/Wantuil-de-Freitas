import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) throw new UnauthorizedException('Credenciais invalidas');

    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) throw new UnauthorizedException('Credenciais invalidas');

    const payload = { sub: usuario.id, email: usuario.email, perfil: usuario.perfil, nome: usuario.nome };
    return {
      token: this.jwt.sign(payload),
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    };
  }
}
