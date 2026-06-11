import { useEffect, useState } from 'react';
import api from '../api/client';
import { fmtData, STATUS_VALIDADE } from '../utils/format';

export default function Validade() {
  const [dados, setDados] = useState<any>(null);

  useEffect(() => { api.get('/itens/alertas').then((r) => setDados(r.data)); }, []);

  async function registrarDescarte(itemId: string, nome: string, saldo: number) {
    const motivo = prompt(`Registrar descarte de "${nome}". Motivo:`);
    if (!motivo) return;
    await api.post('/movimentacoes/descarte', { itemId, quantidade: saldo, motivo });
    alert('Descarte registrado.');
    api.get('/itens/alertas').then((r) => setDados(r.data));
  }

  if (!dados) return <div>Carregando...</div>;

  const grupos = [
    { titulo: '🗑️ Descarte obrigatório (mais de 6 meses do vencimento)', items: dados.descarte, key: 'descarte' },
    { titulo: '🕐 Período adicional — em uso com ressalva', items: dados.adicional, key: 'adicional' },
    { titulo: '⏰ Próximos ao vencimento (≤ 30 dias)', items: dados.proximoVencimento, key: 'proximo' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Controle de Validade</h2>

      <div className="grid4" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Para descarte</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--r600)' }}>{dados.descarte.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Período adicional</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--or)' }}>{dados.adicional.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Próx. 30 dias</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--a600)' }}>{dados.proximoVencimento.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Abaixo do mínimo</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--r600)' }}>{dados.abaixoMinimo.length}</div>
        </div>
      </div>

      <div style={{ background: 'var(--g50)', border: '0.5px solid var(--border2)', borderRadius: 8,
        padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 500 }}>Resumo semanal automático</span>
          <span style={{ color: 'var(--text2)', fontSize: 12 }}> — todo sábado às 08h00 (Brasília)</span>
        </div>
      </div>

      {grupos.filter((g) => g.items.length > 0).map((g) => (
        <div className="card" key={g.key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{g.titulo}</div>
          <table className="table">
            <thead><tr><th>Item</th><th>Setor</th><th>Saldo</th><th>Validade</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {g.items.map((i: any) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 500 }}>{i.nome}</td>
                  <td>{i.setor?.nome || '—'}</td>
                  <td>{i.saldoAtual} {i.unidadeMedida}</td>
                  <td>{fmtData(i.dataValidade)}</td>
                  <td><span className={`pill ${STATUS_VALIDADE[i.statusValidade]?.cor}`}>{STATUS_VALIDADE[i.statusValidade]?.label}</span></td>
                  <td>
                    {g.key === 'descarte' && (
                      <button className="btn sm danger" onClick={() => registrarDescarte(i.id, i.nome, Number(i.saldoAtual))}>
                        🗑️ Registrar descarte
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
