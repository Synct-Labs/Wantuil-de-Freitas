import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true },
      orderBy: { nome: 'asc' },
    });
  }

  async create(data: { nome: string; email: string; senha: string; perfil: string }) {
    const existe = await this.prisma.usuario.findUnique({ where: { email: data.email } });
    if (existe) throw new ConflictException('E-mail ja cadastrado');
    const senha = await bcrypt.hash(data.senha, 10);
    const u = await this.prisma.usuario.create({
      data: { ...data, senha, perfil: data.perfil as any },
    });
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
  }

  async update(id: string, data: any) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    if (data.senha) data.senha = await bcrypt.hash(data.senha, 10);
    const u = await this.prisma.usuario.update({ where: { id }, data });
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo };
  }
}
