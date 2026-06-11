import { useEffect, useState } from 'react';
import api from '../api/client';

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

  const rels = [
    { titulo: 'Posição atual do estoque', desc: 'Saldo de todos os itens por setor/categoria', icon: '📦',
      acoes: [{ label: '⬇️ Excel', click: () => baixar('/relatorios/estoque/excel', setorId ? { setorId } : {}, 'estoque.xlsx') }] },
    { titulo: 'Movimentações por período', desc: 'Entradas e saídas filtradas por data, item e setor', icon: '📊',
      acoes: [{ label: '⬇️ Excel', click: () => baixar('/relatorios/movimentacoes/excel', { dataInicio, dataFim, ...(setorId && { setorId }) }, 'movimentacoes.xlsx') }] },
    { titulo: 'Doações por doador', desc: 'Histórico de doações agrupado por doador', icon: '❤️',
      acoes: [{ label: '👁️ Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/doacoes', { params: { dataInicio, dataFim } });
        console.log(data); alert(`${data.length} doadores no período. Detalhes no console (F12).`);
      }}] },
    { titulo: 'Distribuição por beneficiário', desc: 'Itens recebidos por beneficiário', icon: '👥',
      acoes: [{ label: '👁️ Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/distribuicao', { params: { dataInicio, dataFim } });
        console.log(data); alert(`${data.length} beneficiários no período. Detalhes no console (F12).`);
      }}] },
    { titulo: 'Log de auditoria', desc: 'Todas as operações por usuário, data e hora', icon: '🔒',
      acoes: [{ label: '👁️ Visualizar', click: async () => {
        const { data } = await api.get('/relatorios/auditoria', { params: { dataInicio, dataFim } });
        console.log(data); alert(`${data.length} operações no período. Detalhes no console (F12).`);
      }}] },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Relatórios</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
            <select className="input" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Todos</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid2">
        {rels.map((r) => (
          <div key={r.titulo} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, background: 'var(--g100)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{r.icon}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{r.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.desc}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {r.acoes.map((a, i) => (
                <button key={i} className="btn sm" onClick={a.click}>{a.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
