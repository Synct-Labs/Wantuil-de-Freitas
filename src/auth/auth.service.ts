import {
  Injectable, UnauthorizedException, ForbiddenException,
  BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');
  private resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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

  // ═══════════ TOKEN DE SENHA (convite e reset) ═══════════

  /**
   * Gera um token unico, salva no banco e envia email com o link.
   * Tipo 'CONVITE' = 7 dias de validade (usuario novo). 
   * Tipo 'RESET'   = 1 hora de validade  (esqueci minha senha).
   */
  async gerarTokenESnviarEmail(
    usuarioId: string,
    tipo: 'CONVITE' | 'RESET',
  ): Promise<{ enviado: boolean; motivo?: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario nao encontrado');

    // Invalida tokens anteriores do mesmo tipo (so o ultimo vale)
    await this.prisma.tokenSenha.updateMany({
      where: { usuarioId, tipo, usado: false },
      data: { usado: true },
    });

    const token = crypto.randomBytes(32).toString('hex'); // 64 chars seguros
    const horas = tipo === 'CONVITE' ? 24 * 7 : 1;
    const expiraEm = new Date(Date.now() + horas * 60 * 60 * 1000);

    await this.prisma.tokenSenha.create({
      data: { token, usuarioId, tipo, expiraEm },
    });

    const appUrl = process.env.APP_URL || 'https://syncontrol.cloud';
    const link = `${appUrl}/definir-senha?token=${token}`;

    const assunto = tipo === 'CONVITE'
      ? 'Bem-vindo(a) ao Sistema de Almoxarifado Wantuil'
      : 'Recuperação de senha — Sistema Wantuil';

    const corpo = tipo === 'CONVITE'
      ? this.corpoEmailConvite(usuario.nome, link)
      : this.corpoEmailReset(usuario.nome, link);

    return this.dispararEmail(usuario.email, assunto, corpo);
  }

  private corpoEmailConvite(nome: string, link: string): string {
    return [
      `Olá, ${nome}!`,
      ``,
      `Sua conta foi criada no Sistema de Almoxarifado da Associação Espírita Wantuil de Freitas.`,
      ``,
      `Para acessar o sistema, defina sua senha clicando no link abaixo:`,
      ``,
      link,
      ``,
      `Este link expira em 7 dias e só pode ser usado uma vez.`,
      ``,
      `Se você não esperava este e-mail, pode ignorá-lo — sua conta ficará sem senha definida e ninguém terá acesso.`,
      ``,
      `--`,
      `Sistema de Almoxarifado · Associação Espírita Wantuil de Freitas`,
      `Cuiabá/MT`,
    ].join('\n');
  }

  private corpoEmailReset(nome: string, link: string): string {
    return [
      `Olá, ${nome}!`,
      ``,
      `Recebemos um pedido para redefinir a senha da sua conta no Sistema de Almoxarifado Wantuil.`,
      ``,
      `Para criar uma nova senha, clique no link abaixo:`,
      ``,
      link,
      ``,
      `Este link expira em 1 hora.`,
      ``,
      `Se você não pediu esta redefinição, ignore este e-mail — sua senha atual continua valendo.`,
      ``,
      `--`,
      `Sistema de Almoxarifado · Associação Espírita Wantuil de Freitas`,
    ].join('\n');
  }

  private async dispararEmail(email: string, assunto: string, corpo: string): Promise<{ enviado: boolean; motivo?: string }> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY ausente — email para ${email} nao enviado`);
      return { enviado: false, motivo: 'Servidor sem RESEND_API_KEY configurada' };
    }
    const from = process.env.EMAIL_FROM || 'Almoxarifado <onboarding@resend.dev>';
    try {
      await this.resend.emails.send({ from, to: [email], subject: assunto, text: corpo });
      this.logger.log(`Email enviado para ${email}: ${assunto}`);
      return { enviado: true };
    } catch (e: any) {
      const det = e?.response?.body?.message || e?.message || 'erro desconhecido';
      this.logger.error(`Falha ao enviar para ${email}: ${det}`);
      return { enviado: false, motivo: det };
    }
  }

  /**
   * Verifica o token e retorna dados minimos para a tela publica decidir
   * se mostra o formulario.
   */
  async validarToken(token: string) {
    const t = await this.prisma.tokenSenha.findUnique({
      where: { token },
      include: { usuario: { select: { nome: true, email: true, ativo: true } } },
    });
    if (!t) throw new NotFoundException('Token invalido');
    if (t.usado) throw new BadRequestException('Este link ja foi usado');
    if (t.expiraEm < new Date()) throw new BadRequestException('Este link expirou. Solicite um novo.');
    if (!t.usuario.ativo) throw new BadRequestException('Conta desativada. Contate o administrador.');

    return { valido: true, nome: t.usuario.nome, email: t.usuario.email, tipo: t.tipo };
  }

  /**
   * Define a senha do usuario a partir do token. Marca o token como usado.
   */
  async definirSenha(token: string, senha: string) {
    if (!senha || senha.length < 6) {
      throw new BadRequestException('Senha deve ter no minimo 6 caracteres');
    }
    const t = await this.prisma.tokenSenha.findUnique({
      where: { token },
      include: { usuario: true },
    });
    if (!t) throw new NotFoundException('Token invalido');
    if (t.usado) throw new BadRequestException('Este link ja foi usado');
    if (t.expiraEm < new Date()) throw new BadRequestException('Este link expirou');
    if (!t.usuario.ativo) throw new BadRequestException('Conta desativada');

    const senhaHash = await bcrypt.hash(senha, 10);

    // Atomico: atualiza senha e marca token como usado
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: t.usuarioId }, data: { senha: senhaHash } }),
      this.prisma.tokenSenha.update({ where: { id: t.id }, data: { usado: true } }),
    ]);

    this.logger.log(`Senha definida para ${t.usuario.email} (token tipo ${t.tipo})`);
    return { sucesso: true, email: t.usuario.email };
  }

  /**
   * "Esqueci minha senha" — sempre retorna sucesso, mesmo se email nao existir,
   * para nao expor quais emails estao cadastrados (timing attack).
   */
  async solicitarResetSenha(email: string) {
    const emailNorm = (email || '').trim().toLowerCase();
    const u = await this.prisma.usuario.findUnique({ where: { email: emailNorm } });

    // Resposta uniforme: o frontend nao distingue caso de email inexistente
    if (!u || !u.ativo) {
      this.logger.warn(`Solicitacao de reset para email inexistente/inativo: ${emailNorm}`);
      return { mensagem: 'Se este e-mail estiver cadastrado, você receberá um link em instantes.' };
    }

    await this.gerarTokenESnviarEmail(u.id, 'RESET');
    return { mensagem: 'Se este e-mail estiver cadastrado, você receberá um link em instantes.' };
  }
}
