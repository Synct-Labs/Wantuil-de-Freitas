import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon, { IconName } from '../components/Icon';

interface RelatorioCard {
  id: string;
  titulo: string;
  descricao: string;
  icone: IconName;
  cor: 'petroleo' | 'azul' | 'amarelo' | 'verde' | 'vermelho';
  destaque?: boolean;
  endpointBase: string;
  precisaPeriodo: boolean;
  formatos: ('pdf' | 'excel')[];
}

const RELATORIOS: RelatorioCard[] = [
  {
    id: 'resumo-executivo',
    titulo: 'Resumo executivo',
    descricao: 'Visão geral consolidada do período — entradas, saídas, descartes e atendimentos. Ideal para gestão e prestação de contas.',
    icone: 'chart-bar', cor: 'azul', destaque: true,
    endpointBase: '/relatorios/resumo-executivo',
    precisaPeriodo: true, formatos: ['pdf'],
  },
  {
    id: 'estoque',
    titulo: 'Posição atual do estoque',
    descricao: 'Saldo de cada item com unidade, mínimo e validade. Filtra por setor.',
    icone: 'package', cor: 'petroleo',
    endpointBase: '/relatorios/estoque',
    precisaPeriodo: false, formatos: ['pdf', 'excel'],
  },
  {
    id: 'movimentacoes',
    titulo: 'Movimentações por período',
    descricao: 'Lista detalhada de entradas, saídas e descartes registrados.',
    icone: 'file-text', cor: 'petroleo',
    endpointBase: '/relatorios/movimentacoes',
    precisaPeriodo: true, formatos: ['pdf', 'excel'],
  },
  {
    id: 'doacoes',
    titulo: 'Doações por doador',
    descricao: 'Total recebido agrupado por doador, com volume e última doação.',
    icone: 'heart', cor: 'verde',
    endpointBase: '/relatorios/doacoes',
    precisaPeriodo: true, formatos: ['pdf'],
  },
  {
    id: 'distribuicao',
    titulo: 'Distribuição por beneficiário',
    descricao: 'Itens entregues por beneficiário no período.',
    icone: 'users', cor: 'verde',
    endpointBase: '/relatorios/distribuicao',
    precisaPeriodo: true, formatos: ['pdf'],
  },
  {
    id: 'top-produtos',
    titulo: 'Itens mais movimentados',
    descricao: 'Ranking dos produtos com maior volume de entradas e saídas.',
    icone: 'star', cor: 'amarelo',
    endpointBase: '/relatorios/top-produtos',
    precisaPeriodo: true, formatos: ['pdf'],
  },
  {
    id: 'auditoria',
    titulo: 'Log de auditoria',
    descricao: 'Histórico de todas as operações por usuário, data e hora. Restrito a administradores.',
    icone: 'shield', cor: 'vermelho',
    endpointBase: '/relatorios/auditoria',
    precisaPeriodo: true, formatos: ['pdf'],
  },
];

const CORES_CARD: Record<string, { bg: string; texto: string }> = {
  petroleo: { bg: 'var(--primary-bg)', texto: 'var(--primary-dk)' },
  azul:     { bg: '#E1E8F4', texto: 'var(--wf-azul-dk)' },
  amarelo:  { bg: '#FAF0DC', texto: 'var(--a-600)' },
  verde:    { bg: 'var(--green-bg)', texto: 'var(--green)' },
  vermelho: { bg: 'var(--r-50)', texto: 'var(--r-600)' },
};

export default function Relatorios() {
  const [setores, setSetores] = useState<any[]>([]);
  const hoje = new Date().toISOString().split('T')[0];
  const mesPassado = new Date(); mesPassado.setMonth(mesPassado.getMonth() - 1);
  const [dataInicio, setDataInicio] = useState(mesPassado.toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(hoje);
  const [setorId, setSetorId] = useState('');
  const [baixando, setBaixando] = useState<string | null>(null);

  useEffect(() => { api.get('/setores').then((r) => setSetores(r.data)); }, []);

  async function baixar(rel: RelatorioCard, formato: 'pdf' | 'excel') {
    const chave = `${rel.id}-${formato}`;
    setBaixando(chave);
    try {
      const token = localStorage.getItem('token');
      const params: any = {};
      if (rel.precisaPeriodo) { params.dataInicio = dataInicio; params.dataFim = dataFim; }
      if ((rel.id === 'estoque' || rel.id === 'movimentacoes') && setorId) params.setorId = setorId;

      const qs = new URLSearchParams(params).toString();
      const sufixo = formato === 'pdf' ? '/pdf' : '/excel';
      const url = `${import.meta.env.VITE_API_URL || '/api'}${rel.endpointBase}${sufixo}?${qs}`;

      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        const erro = await resp.json().catch(() => ({ message: 'Erro ao gerar relatório' }));
        throw new Error(erro.message || 'Erro ao gerar relatório');
      }
      const blob = await resp.blob();
      const nomeArquivo = `${rel.id}_${hoje}.${formato === 'pdf' ? 'pdf' : 'xlsx'}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = nomeArquivo; a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      alert(e.message || 'Erro ao baixar relatório');
    } finally {
      setBaixando(null);
    }
  }

  const periodoInvalido = new Date(dataInicio) > new Date(dataFim);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Relatórios</h2>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="settings" size={14} color="var(--text-2)" />
          <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.04em' }}>Filtros do período</span>
        </div>
        <div className="grid-3">
          <div>
            <label className="label">Data inicial</label>
            <input className="input" type="date" value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Data final</label>
            <input className="input" type="date" value={dataFim}
              onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <label className="label">Setor (opcional)</label>
            <select className="select" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Todos os setores</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>
        {periodoInvalido && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--r-600)',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-circle" size={14} /> A data inicial precisa ser anterior à data final.
          </div>
        )}
      </div>

      {/* Cards de relatorios */}
      <div className="grid-2">
        {RELATORIOS.map((rel) => {
          const cores = CORES_CARD[rel.cor];
          const desabilitado = (rel.precisaPeriodo && periodoInvalido) || baixando !== null;
          return (
            <div key={rel.id} className="card"
              style={rel.destaque ? {
                borderColor: 'var(--wf-azul)',
                borderWidth: 1.5,
                background: 'linear-gradient(135deg, var(--surface) 0%, #F5F8FD 100%)',
              } : undefined}>
              {rel.destaque && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, color: 'var(--wf-azul)',
                  background: '#E1E8F4', padding: '3px 8px', borderRadius: 4,
                  marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                }}>
                  <Icon name="star" size={10} />Destaque
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 9,
                  background: cores.bg, color: cores.texto,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={rel.icone} size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{rel.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{rel.descricao}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {rel.formatos.includes('pdf') && (
                  <button className="btn primary sm"
                    onClick={() => baixar(rel, 'pdf')} disabled={desabilitado}
                    style={{ flex: 1, justifyContent: 'center', minWidth: 110 }}>
                    {baixando === `${rel.id}-pdf`
                      ? <><span className="spinner" /> Gerando…</>
                      : <><Icon name="file-text" size={13} /> Baixar PDF</>}
                  </button>
                )}
                {rel.formatos.includes('excel') && (
                  <button className="btn sm"
                    onClick={() => baixar(rel, 'excel')} disabled={desabilitado}
                    style={{ flex: 1, justifyContent: 'center', minWidth: 110 }}>
                    {baixando === `${rel.id}-excel`
                      ? <><span className="spinner" /> Gerando…</>
                      : <><Icon name="download" size={13} /> Excel</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rodape informativo */}
      <div className="card" style={{
        marginTop: 16, background: 'var(--primary-bg)', borderColor: 'var(--primary-lt)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Icon name="info" size={16} color="var(--primary-dk)" style={{ marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Todos os relatórios são gerados em PDF com cabeçalho institucional (logo + identificação da Wantuil de Freitas),
            paginação automática e data/hora de emissão — pronto para impressão, prestação de contas ou envio por e-mail.
          </div>
        </div>
      </div>
    </div>
  );
}
