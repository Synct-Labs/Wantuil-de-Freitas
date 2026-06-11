import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const senha = await bcrypt.hash('admin123', 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@wantuil.org.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@wantuil.org.br',
      senha,
      perfil: 'ADMIN',
    },
  });

  const categorias = ['Alimentos', 'Higiene', 'Limpeza', 'Vestuario', 'Medicamentos', 'Outros'];
  for (const nome of categorias) {
    await prisma.categoria.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  const setores = [
    { nome: 'Estoque Geral', responsavel: '' },
    { nome: 'Cozinha', responsavel: '' },
    { nome: 'Enfermaria', responsavel: '' },
    { nome: 'Abrigo', responsavel: '' },
  ];
  for (const s of setores) {
    await prisma.setor.upsert({ where: { nome: s.nome }, update: {}, create: s });
  }

  console.log('Seed concluido. Login: admin@wantuil.org.br / admin123');
}

main().finally(() => prisma.$disconnect());
