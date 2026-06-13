import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const PERFIS_VALIDOS = ['ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true },
      orderBy: { nome: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    });
  }

  async create(data: { nome: string; email: string; senha: string; perfil: string }) {
    if (!data.email || !data.senha) {
      throw new BadRequestException('E-mail e senha sao obrigatorios');
    }
    if (data.senha.length < 6) {
      throw new BadRequestException('Senha deve ter no minimo 6 caracteres');
    }
    if (!PERFIS_VALIDOS.includes(data.perfil)) {
      throw new BadRequestException(`Perfil invalido. Use: ${PERFIS_VALIDOS.join(', ')}`);
    }

    const emailNormalizado = data.email.trim().toLowerCase();
    const existe = await this.prisma.usuario.findUnique({ where: { email: emailNormalizado } });
    if (existe) throw new ConflictException('E-mail ja cadastrado');

    const senhaHash = await bcrypt.hash(data.senha, 10);

    // CRITICO: explicitar cada campo, NAO usar spread para evitar passar senha em texto plano
    const u = await this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: emailNormalizado,
        senha: senhaHash,
        perfil: data.perfil as any,
        ativo: true, // explicito
      },
    });

    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo };
  }

  async update(id: string, data: any) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    const updateData: any = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase();
    if (data.perfil !== undefined) {
      if (!PERFIS_VALIDOS.includes(data.perfil)) {
        throw new BadRequestException(`Perfil invalido`);
      }
      updateData.perfil = data.perfil;
    }
    if (data.ativo !== undefined) updateData.ativo = data.ativo;
    if (data.senha) {
      if (data.senha.length < 6) throw new BadRequestException('Senha deve ter no minimo 6 caracteres');
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const u = await this.prisma.usuario.update({ where: { id }, data: updateData });
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo };
  }

  async desativar(id: string, idLogado: string) {
    if (id === idLogado) {
      throw new BadRequestException('Voce nao pode desativar a si mesmo');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    return this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
  }

  async excluir(id: string, idLogado: string) {
    if (id === idLogado) {
      throw new BadRequestException('Voce nao pode excluir a si mesmo');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: { _count: { select: { movimentacoes: true, logs: true } } },
    });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    // Se tiver historico, apenas desativa para preservar referencias (RN-03)
    if (usuario._count.movimentacoes > 0 || usuario._count.logs > 0) {
      await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Usuario possui historico e foi desativado em vez de excluido' };
    }

    await this.prisma.usuario.delete({ where: { id } });
    return { mensagem: 'Usuario excluido com sucesso' };
  }
}
