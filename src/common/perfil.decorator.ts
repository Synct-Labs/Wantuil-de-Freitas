import { SetMetadata } from '@nestjs/common';

export const PERFIS_KEY = 'perfis';
export const Perfis = (...perfis: string[]) => SetMetadata(PERFIS_KEY, perfis);

// Marca rota como "qualquer usuario logado pode acessar"
export const QUALQUER_LOGADO_KEY = 'qualquerLogado';
export const QualquerLogado = () => SetMetadata(QUALQUER_LOGADO_KEY, true);
