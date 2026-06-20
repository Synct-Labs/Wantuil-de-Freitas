import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon, { IconName } from '../components/Icon';
import { useToast } from '../components/Toast';
import { fmtData } from '../utils/format';

export default function Validade() {
  const toast = useToast();
  const [dados, setDados] = useState<any>(null);

  useEffect(() => { carregar(); }, []);
  function carregar() { api.get('/itens/alertas').then((r) => setDados(r.data)); }

  async function registrarDescarte(loteId: string, codigoLote: string, nomeItem: string, qtd: number) {
    const motivo = prompt(`Registrar descarte do lote ${codigoLote} (${nomeItem}, ${qtd} un).\n\nMotivo:`);
    if (!motivo) return;
    try {
      await api.post('/movimentacoes/descarte', { loteId, quantidade: qtd, motivo });
      toast.sucesso('Descarte registrado', `${qtd} un de ${nomeItem} (lote ${codigoLote})`);
      carregar();
    } catch (e: any) {
      toast.erro('Erro ao registrar descarte', e.response?.data?.message || 'Tente novamente');
    }
  }

  if (!dados) return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;

  const cards = [
    { label: 'Para descarte', val: dados.descarte.length, cor: 'var(--r-600)', bg: 'var(--r-50)', icon: 'trash' as IconName },
    { label: 'Período adicional', val: dados.adicional.length, cor: 'var(--or)', bg: 'var(--or-bg)', icon: 'clock' as IconName },
    { label: 'Próximos 30 dias', val: dados.proximoVencimento.length, cor: 'var(--a-600)', bg: 'var(--a-50)', icon: 'alert-triangle' as IconName },
    { label: 'Abaixo do mínimo', val: dados.abaixoMinimo.length, cor: 'var(--r-600)', bg: 'var(--r-50)', icon: 'archive' as IconName },
  ];

  const grupos: { titulo: string; lotes: any[]; icon: IconName; cor: string; permiteDescarte: boolean }[] = [
    { titulo: 'Descarte obrigatório (vencidos há mais de 6 meses)', icon: 'trash', cor: 'var(--r-600)', lotes: dados.descarte, permiteDescarte: true },
    { titulo: 'Período adicional (vencidos há até 6 meses)', icon: 'clock', cor: 'var(--or)', lotes: dados.adicional, permiteDescarte: true },
    { titulo: 'Próximos ao vencimento (≤ 30 dias)', icon: 'alert-triangle', cor: 'var(--a-600)', lotes: dados.proximoVencimento, permiteDescarte: false },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 18 }} className="desktop-only">Controle de Validade</h2>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: c.bg, color: c.cor,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.icon} size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.cor }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      {grupos.map((g) => g.lotes.length > 0 && (
        <div key={g.titulo} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name={g.icon} size={16} color={g.cor} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{g.titulo}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {g.lotes.length} lote(s)</span>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead><tr>
                <th>Lote</th><th>Item</th><th>Saldo</th><th>Validade</th><th></th>
              </tr></thead>
              <tbody>
                {g.lotes.map((l: any) => (
                  <tr key={l.id}>
                    <td data-label="Lote" style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.codigoLote}</td>
                    <td data-label="Item"><strong>{l.item.nome}</strong></td>
                    <td data-label="Saldo">{l.quantidadeAtual} {l.item.unidadeMedida}</td>
                    <td data-label="Validade">{fmtData(l.dataValidade)}</td>
                    <td data-label="Ação">
                      {g.permiteDescarte && (
                        <button className="btn danger sm"
                          onClick={() => registrarDescarte(l.id, l.codigoLote, l.item.nome, Number(l.quantidadeAtual))}>
                          <Icon name="trash" size={12} /> Descartar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {dados.abaixoMinimo.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="archive" size={16} color="var(--r-600)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Itens abaixo do estoque mínimo</span>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Item</th><th>Saldo</th><th>Mínimo</th></tr></thead>
              <tbody>
                {dados.abaixoMinimo.map((i: any) => (
                  <tr key={i.id}>
                    <td data-label="Item"><strong>{i.nome}</strong></td>
                    <td data-label="Saldo">{i.saldoAtual} {i.unidadeMedida}</td>
                    <td data-label="Mínimo">{i.estoqueMinimo} {i.unidadeMedida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {grupos.every(g => g.lotes.length === 0) && dados.abaixoMinimo.length === 0 && (
        <div className="empty-state">
          <Icon name="check-circle" size={36} color="var(--green)" style={{ margin: '0 auto 12px' }} />
          <div className="empty-state-title">Tudo em dia</div>
          <div className="empty-state-desc">Nenhum lote precisa de atenção no momento.</div>
        </div>
      )}
    </div>
  );
}
