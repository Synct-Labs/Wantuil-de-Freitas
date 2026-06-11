import { useEffect, useState } from 'react';
import api from '../api/client';
import { fmtData, STATUS_VALIDADE } from '../utils/format';

export default function Dashboard() {
  const [alertas, setAlertas] = useState<any>(null);
  const [movs, setMovs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/itens/alertas').then((r) => setAlertas(r.data));
    api.get('/movimentacoes').then((r) => setMovs(r.data.slice(0, 8)));
  }, []);

  if (!alertas) return <div>Carregando...</div>;

  const cards = [
    { label: 'Para descarte', val: alertas.descarte.length, cor: 'var(--r600)' },
    { label: 'Período adicional', val: alertas.adicional.length, cor: 'var(--or)' },
    { label: 'Próx. vencimento', val: alertas.proximoVencimento.length, cor: 'var(--a600)' },
    { label: 'Abaixo do mínimo', val: alertas.abaixoMinimo.length, cor: 'var(--r600)' },
  ];

  const todosAlertas = [
    ...alertas.descarte.map((i: any) => ({ ...i, _t: 'DESCARTE' })),
    ...alertas.adicional.map((i: any) => ({ ...i, _t: 'ADICIONAL' })),
    ...alertas.abaixoMinimo.map((i: any) => ({ ...i, _t: 'MINIMO' })),
    ...alertas.proximoVencimento.map((i: any) => ({ ...i, _t: 'PROXIMO' })),
  ];

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Dashboard</h2>
      <div className="grid4" style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: c.cor }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>⚠️ Alertas ativos</div>
          {todosAlertas.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2)' }}>Nenhum alerta. Tudo em ordem! ✅</div>}
          {todosAlertas.slice(0, 10).map((i: any, idx: number) => (
            <div key={idx} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6,
              background: i._t === 'DESCARTE' || i._t === 'MINIMO' ? 'var(--r50)' : i._t === 'ADICIONAL' ? 'var(--or-bg)' : 'var(--a50)' }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{i.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {i._t === 'MINIMO' ? `Saldo ${i.saldoAtual} (mín: ${i.estoqueMinimo})` : STATUS_VALIDADE[i.statusValidade]?.label}
                {i.dataValidade ? ` · Val: ${fmtData(i.dataValidade)}` : ''}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 12 }}>📋 Movimentações recentes</div>
          {movs.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
              borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>{m.tipo === 'ENTRADA' ? '⬇️' : m.tipo === 'SAIDA' ? '⬆️' : m.tipo === 'DESCARTE' ? '🗑️' : '↩️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {m.doador?.nome || m.beneficiario?.nome || m.setor?.nome || '—'} · {m.usuario.nome}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtData(m.dataMovimentacao)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
