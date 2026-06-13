import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon from '../components/Icon';
import { fmtData, STATUS_VALIDADE } from '../utils/format';

export default function Dashboard() {
  const [alertas, setAlertas] = useState<any>(null);
  const [movs, setMovs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/itens/alertas').then((r) => setAlertas(r.data));
    api.get('/movimentacoes').then((r) => setMovs(r.data.slice(0, 8)));
  }, []);

  if (!alertas) {
    return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;
  }

  const cards = [
    { label: 'Para descarte', val: alertas.descarte.length, icon: 'trash' as const, cor: 'var(--r-600)', bg: 'var(--r-50)' },
    { label: 'Período adicional', val: alertas.adicional.length, icon: 'clock' as const, cor: 'var(--or)', bg: 'var(--or-bg)' },
    { label: 'Próximo do vencimento', val: alertas.proximoVencimento.length, icon: 'alert-triangle' as const, cor: 'var(--a-600)', bg: 'var(--a-50)' },
    { label: 'Abaixo do mínimo', val: alertas.abaixoMinimo.length, icon: 'archive' as const, cor: 'var(--r-600)', bg: 'var(--r-50)' },
  ];

  const todosAlertas = [
    ...alertas.descarte.map((i: any) => ({ ...i, _t: 'DESCARTE' })),
    ...alertas.adicional.map((i: any) => ({ ...i, _t: 'ADICIONAL' })),
    ...alertas.abaixoMinimo.map((i: any) => ({ ...i, _t: 'MINIMO' })),
    ...alertas.proximoVencimento.map((i: any) => ({ ...i, _t: 'PROXIMO' })),
  ].slice(0, 8);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Painel</h2>

      <div className="grid-4" style={{ marginBottom: 18 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: c.bg, color: c.cor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon name={c.icon} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.cor }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="alert-triangle" size={16} color="var(--a-600)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Alertas ativos</span>
          </div>
          {todosAlertas.length === 0 && (
            <div className="empty-state">
              <Icon name="check" size={32} color="var(--green)" style={{ margin: '0 auto 8px' }} />
              <div className="empty-state-title">Tudo em ordem</div>
              <div style={{ fontSize: 12 }}>Nenhum alerta crítico no momento.</div>
            </div>
          )}
          {todosAlertas.map((i: any, idx: number) => {
            const cores: Record<string, { bg: string; color: string; icon: any }> = {
              DESCARTE: { bg: 'var(--r-50)', color: 'var(--r-600)', icon: 'trash' },
              MINIMO: { bg: 'var(--r-50)', color: 'var(--r-600)', icon: 'archive' },
              ADICIONAL: { bg: 'var(--or-bg)', color: 'var(--or)', icon: 'clock' },
              PROXIMO: { bg: 'var(--a-50)', color: 'var(--a-600)', icon: 'alert-triangle' },
            };
            const c = cores[i._t];
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 6,
                background: c.bg, marginBottom: 6,
              }}>
                <Icon name={c.icon} size={16} color={c.color} style={{ marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{i.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {i._t === 'MINIMO'
                      ? `Saldo ${i.saldoAtual} ${i.unidadeMedida} (mínimo: ${i.estoqueMinimo})`
                      : STATUS_VALIDADE[i.statusValidade]?.label}
                    {i.dataValidade ? ` · Val: ${fmtData(i.dataValidade)}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="file-text" size={16} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Movimentações recentes</span>
          </div>
          {movs.length === 0 ? (
            <div className="empty-state">
              <Icon name="file-text" size={28} color="var(--text-3)" style={{ margin: '0 auto 8px' }} />
              <div className="empty-state-title">Sem movimentações</div>
            </div>
          ) : movs.map((m) => {
            const tipoMap: any = {
              ENTRADA: { icon: 'arrow-down', cor: 'var(--green)', bg: 'var(--green-bg)' },
              SAIDA:   { icon: 'arrow-up', cor: 'var(--r-600)', bg: 'var(--r-50)' },
              DESCARTE:{ icon: 'trash', cor: 'var(--text-2)', bg: 'var(--surface-3)' },
              ESTORNO: { icon: 'refresh', cor: 'var(--a-600)', bg: 'var(--a-50)' },
            };
            const tm = tipoMap[m.tipo] || tipoMap.SAIDA;
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: tm.bg, color: tm.cor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={tm.icon} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.itens.map((mi: any) => mi.item.nome).join(', ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {m.doador?.nome || m.beneficiario?.nome || m.setor?.nome || '—'} · {m.usuario.nome}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{fmtData(m.dataMovimentacao)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
