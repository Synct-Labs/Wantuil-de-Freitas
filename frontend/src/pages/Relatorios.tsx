import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon, { IconName } from '../components/Icon';

export default function Relatorios() {
  const [setores, setSetores] = useState<any[]>([]);
  const hoje = new Date().toISOString().split('T')[0];
  const mesPassado = new Date(); mesPassado.setMonth(mesPassado.getMonth() - 1);
  const [dataInicio, setDataInicio] = useState(mesPassado.toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(hoje);
  const [setorId, setSetorId] = useState('');

  useEffect(() => { api.get('/setores').then((r) => setSetores(r.data)); }, []);

  function baixar(endpoint: string, params: any, nomeArquivo: string) {
    const token = localStorage.getItem('token');
    const qs = new URLSearchParams(params).toString();
    fetch(`${import.meta.env.VITE_API_URL || '/api'}${endpoint}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.blob()).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nomeArquivo; a.click();
      URL.revokeObjectURL(url);
    });
  }

  const rels: { titulo: string; desc: string; icon: IconName; acoes: { label: string; click: () => void }[] }[] = [
    {
      titulo: 'Posição atual do estoque', desc: 'Saldo de todos os itens por setor e categoria', icon: 'package',
      acoes: [{ label: 'Baixar Excel', click: () => baixar('/relatorios/estoque/excel', setorId ? { setorId } : {}, 'estoque.xlsx') }],
    },
    {
      titulo: 'Movimentações por período', desc: 'Entradas e saídas filtradas por data, item e setor', icon: 'chart-bar',
      acoes: [{ label: 'Baixar Excel', click: () => baixar('/relatorios/movimentacoes/excel', { dataInicio, dataFim, ...(setorId && { setorId }) }, 'movimentacoes.xlsx') }],
    },
    {
      titulo: 'Doações por doador', desc: 'Histórico de doações agrupado por doador', icon: 'heart',
      acoes: [{ label: 'Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/doacoes', { params: { dataInicio, dataFim } });
        alert(`${data.length} doadores no período.\n\nDetalhes completos disponíveis no console (F12).`);
        console.log(data);
      }}],
    },
    {
      titulo: 'Distribuição por beneficiário', desc: 'Itens recebidos por beneficiário no período', icon: 'users',
      acoes: [{ label: 'Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/distribuicao', { params: { dataInicio, dataFim } });
        alert(`${data.length} beneficiários atendidos no período.\n\nDetalhes no console (F12).`);
        console.log(data);
      }}],
    },
    {
      titulo: 'Log de auditoria', desc: 'Todas as operações por usuário, data e hora', icon: 'shield',
      acoes: [{ label: 'Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/auditoria', { params: { dataInicio, dataFim } });
        alert(`${data.length} operações no período.\n\nDetalhes no console (F12).`);
        console.log(data);
      }}],
    },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Relatórios</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 12,
          textTransform: 'uppercase', letterSpacing: '.04em' }}>Filtros</div>
        <div className="grid-3">
          <div>
            <label className="label">Data inicial</label>
            <input className="input" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="label">Data final</label>
            <input className="input" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <label className="label">Setor</label>
            <select className="select" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Todos os setores</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {rels.map((r) => (
          <div key={r.titulo} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: 'var(--primary-bg)', color: 'var(--primary-dk)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={r.icon} size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{r.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {r.acoes.map((a, i) => (
                <button key={i} className="btn sm" onClick={a.click}>
                  <Icon name="download" size={13} />{a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
