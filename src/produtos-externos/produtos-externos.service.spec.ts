import { Test } from '@nestjs/testing';
import { ProdutosExternosService } from './produtos-externos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Testes do validador de respostas das APIs externas.
 * Garante que respostas "lixo" das APIs (nome vazio, placeholders, so
 * digitos) sao tratadas como "nao encontrado" e a cascata continua.
 */
describe('ProdutosExternosService — validar()', () => {
  let service: any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProdutosExternosService,
        { provide: PrismaService, useValue: { catalogoProduto: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() } } },
      ],
    }).compile();
    service = moduleRef.get(ProdutosExternosService);
  });

  it('aceita produto valido com nome real', () => {
    const r = service['validar']({
      ean: '7894900011517', nome: 'Coca-Cola Sabor Original 220ml',
      fonte: 'open-food-facts',
    });
    expect(r).not.toBeNull();
  });

  it('rejeita nome muito curto', () => {
    expect(service['validar']({ ean: '1', nome: 'AB', fonte: 'x' })).toBeNull();
  });

  it('rejeita nomes placeholder genericos', () => {
    const placeholders = ['Produto', 'Produto desconhecido', 'Desconhecido', 'Sem nome', 'N/D', 'N/A', '---', 'NULL', 'Teste'];
    for (const p of placeholders) {
      expect(service['validar']({ ean: '1', nome: p, fonte: 'x' })).toBeNull();
    }
  });

  it('rejeita nomes formados so por digitos', () => {
    expect(service['validar']({ ean: '1', nome: '7894900011517', fonte: 'x' })).toBeNull();
    expect(service['validar']({ ean: '1', nome: '12345-67890', fonte: 'x' })).toBeNull();
  });

  it('rejeita nome vazio ou null', () => {
    expect(service['validar']({ ean: '1', nome: '', fonte: 'x' })).toBeNull();
    expect(service['validar']({ ean: '1', nome: '   ', fonte: 'x' })).toBeNull();
  });

  it('rejeita produto null/undefined', () => {
    expect(service['validar'](null)).toBeNull();
    expect(service['validar'](undefined as any)).toBeNull();
  });

  it('aceita nomes com acentos pt-BR', () => {
    const r = service['validar']({ ean: '1', nome: 'Açúcar Refinado União 1kg', fonte: 'x' });
    expect(r).not.toBeNull();
  });
});
