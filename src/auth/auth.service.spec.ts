import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Testes criticos do AuthService. Cobrem os caminhos onde
 * uma falha causaria comprometimento real: login com senha errada,
 * usuario desativado, e geracao correta de token.
 */
describe('AuthService — login', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tokenSenha: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('token-fake') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('rejeita login com email inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(service.login('nao@existe.com', 'qualquer'))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejeita login com senha incorreta', async () => {
    const hash = await bcrypt.hash('senhaCerta', 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: '1', email: 'a@b.com', senha: hash, perfil: 'ADMIN', nome: 'Test', ativo: true,
    });
    await expect(service.login('a@b.com', 'senhaErrada'))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejeita login de usuario desativado mesmo com senha correta', async () => {
    const hash = await bcrypt.hash('senhaCerta', 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: '1', email: 'a@b.com', senha: hash, perfil: 'ADMIN', nome: 'Test', ativo: false,
    });
    await expect(service.login('a@b.com', 'senhaCerta'))
      .rejects.toThrow(ForbiddenException);
  });

  it('aceita login valido e retorna token + dados do usuario', async () => {
    const hash = await bcrypt.hash('senhaCerta', 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: '1', email: 'a@b.com', senha: hash, perfil: 'ADMIN', nome: 'Test', ativo: true,
    });
    const r = await service.login('a@b.com', 'senhaCerta');
    expect(r.token).toBe('token-fake');
    expect(r.usuario).toMatchObject({ email: 'a@b.com', perfil: 'ADMIN' });
    // Nao retorna a senha (mesmo hasheada)
    expect((r.usuario as any).senha).toBeUndefined();
  });

  it('normaliza email (lowercase + trim) antes do lookup', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    try { await service.login('  A@B.COM  ', 'x'); } catch {}
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
    });
  });
});
