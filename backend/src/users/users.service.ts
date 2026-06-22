import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const PERFIS_VALIDOS = ['MASTER', 'ADMIN', 'ALMOXARIFE', 'GESTOR', 'OPERADOR'];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Apenas MASTER pode criar/editar/excluir outros MASTERs.
   * ADMIN consegue gerenciar ADMIN, ALMOXARIFE, GESTOR, OPERADOR.
   */
  private exigirMasterParaTocarEm(perfilAlvo: string, perfilAtor: string) {
    if (perfilAlvo === 'MASTER' && perfilAtor !== 'MASTER') {
      throw new ForbiddenException('Apenas usuarios MASTER podem gerenciar contas MASTER');
    }
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, receberEmail: true, createdAt: true },
      orderBy: { nome: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, receberEmail: true },
    });
  }

  async create(
    data: { nome: string; email: string; senha: string; perfil: string; receberEmail?: boolean },
    perfilAtor: string,
  ) {
    if (!data.email || !data.senha) {
      throw new BadRequestException('E-mail e senha sao obrigatorios');
    }
    if (data.senha.length < 6) {
      throw new BadRequestException('Senha deve ter no minimo 6 caracteres');
    }
    if (!PERFIS_VALIDOS.includes(data.perfil)) {
      throw new BadRequestException(`Perfil invalido. Use: ${PERFIS_VALIDOS.join(', ')}`);
    }
    this.exigirMasterParaTocarEm(data.perfil, perfilAtor);

    const emailNormalizado = data.email.trim().toLowerCase();
    const existe = await this.prisma.usuario.findUnique({ where: { email: emailNormalizado } });
    if (existe) throw new ConflictException('E-mail ja cadastrado');

    const senhaHash = await bcrypt.hash(data.senha, 10);

    const u = await this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: emailNormalizado,
        senha: senhaHash,
        perfil: data.perfil as any,
        ativo: true,
        receberEmail: data.receberEmail ?? true,
      },
    });

    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, receberEmail: u.receberEmail };
  }

  async update(id: string, data: any, perfilAtor: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    // Bloqueia ADMIN de editar um MASTER existente
    this.exigirMasterParaTocarEm(usuario.perfil, perfilAtor);
    // Bloqueia ADMIN de PROMOVER alguem para MASTER
    if (data.perfil) this.exigirMasterParaTocarEm(data.perfil, perfilAtor);

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
    if (data.receberEmail !== undefined) updateData.receberEmail = !!data.receberEmail;
    if (data.senha) {
      if (data.senha.length < 6) throw new BadRequestException('Senha deve ter no minimo 6 caracteres');
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }

    const u = await this.prisma.usuario.update({ where: { id }, data: updateData });
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, receberEmail: u.receberEmail };
  }

  async desativar(id: string, idLogado: string, perfilAtor: string) {
    if (id === idLogado) {
      throw new BadRequestException('Voce nao pode desativar a si mesmo');
    }
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    this.exigirMasterParaTocarEm(usuario.perfil, perfilAtor);
    return this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
  }

  async excluir(id: string, idLogado: string, perfilAtor: string) {
    if (id === idLogado) {
      throw new BadRequestException('Voce nao pode excluir a si mesmo');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      include: { _count: { select: { movimentacoes: true, logs: true } } },
    });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');
    this.exigirMasterParaTocarEm(usuario.perfil, perfilAtor);

    // Se tiver historico, apenas desativa para preservar referencias (RN-03)
    if (usuario._count.movimentacoes > 0 || usuario._count.logs > 0) {
      await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
      return { mensagem: 'Usuario possui historico e foi desativado em vez de excluido' };
    }

    await this.prisma.usuario.delete({ where: { id } });
    return { mensagem: 'Usuario excluido com sucesso' };
  }
}
