import { useEffect, useState } from 'react';
import api from '../api/client';
import Icon, { IconName } from '../components/Icon';
import { fmtData, STATUS_VALIDADE } from '../utils/format';

export default function Validade() {
  const [dados, setDados] = useState<any>(null);

  useEffect(() => { carregar(); }, []);
  function carregar() { api.get('/itens/alertas').then((r) => setDados(r.data)); }

  async function registrarDescarte(itemId: string, nome: string, saldo: number) {
    const motivo = prompt(`Registrar descarte de "${nome}". Informe o motivo:`);
    if (!motivo) return;
    try {
      await api.post('/movimentacoes/descarte', { itemId, quantidade: saldo, motivo });
      alert('Descarte registrado.');
      carregar();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao registrar descarte');
    }
  }

  if (!dados) {
    return <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>;
  }

  const cards = [
    { label: 'Para descarte', val: dados.descarte.length, cor: 'var(--r-600)', bg: 'var(--r-50)', icon: 'trash' as IconName },
    { label: 'Período adicional', val: dados.adicional.length, cor: 'var(--or)', bg: 'var(--or-bg)', icon: 'clock' as IconName },
    { label: 'Próximos 30 dias', val: dados.proximoVencimento.length, cor: 'var(--a-600)', bg: 'var(--a-50)', icon: 'alert-triangle' as IconName },
    { label: 'Abaixo do mínimo', val: dados.abaixoMinimo.length, cor: 'var(--r-600)', bg: 'var(--r-50)', icon: 'archive' as IconName },
  ];

  const grupos: { titulo: string; items: any[]; key: string; icon: IconName; cor: string }[] = [
    { titulo: 'Descarte obrigatório', icon: 'trash', cor: 'var(--r-600)', items: dados.descarte, key: 'descarte' },
    { titulo: 'Período adicional (vencidos há até 6 meses)', icon: 'clock', cor: 'var(--or)', items: dados.adicional, key: 'adicional' },
    { titulo: 'Próximos ao vencimento (≤ 30 dias)', icon: 'alert-triangle', cor: 'var(--a-600)', items: dados.proximoVencimento, key: 'proximo' },
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
              <div style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.cor }}>{c.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--primary-bg)', border: '1px solid var(--primary-lt)',
        borderRadius: 8, padding: 14, marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Icon name="bell" size={20} color="var(--primary-dk)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Resumo semanal automático</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            Enviado todo sábado às 08h00 (Brasília) para os usuários autorizados
          </div>
        </div>
      </div>

      {grupos.filter((g) => g.items.length > 0).map((g) => (
        <div className="card" key={g.key} style={{ marginBottom: 14, padding: 0 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={g.icon} size={16} color={g.cor} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{g.titulo}</span>
            <span className="pill neutral" style={{ marginLeft: 'auto' }}>{g.items.length}</span>
          </div>
          <table className="table table-responsive">
            <thead>
              <tr><th>Item</th><th>Setor</th><th>Saldo</th><th>Validade</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {g.items.map((i: any) => (
                <tr key={i.id}>
                  <td data-label="Item" style={{ fontWeight: 600 }}>{i.nome}</td>
                  <td data-label="Setor">{i.setor?.nome || '—'}</td>
                  <td data-label="Saldo">{i.saldoAtual} {i.unidadeMedida}</td>
                  <td data-label="Validade">{fmtData(i.dataValidade)}</td>
                  <td data-label="Status">
                    <span className={`pill ${STATUS_VALIDADE[i.statusValidade]?.cor}`}>
                      {STATUS_VALIDADE[i.statusValidade]?.label}
                    </span>
                  </td>
                  <td data-actions style={{ textAlign: 'right' }}>
                    {g.key === 'descarte' && (
                      <button className="btn sm danger" onClick={() => registrarDescarte(i.id, i.nome, Number(i.saldoAtual))}>
                        <Icon name="trash" size={12} /> Descartar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {grupos.every(g => g.items.length === 0) && (
        <div className="card">
          <div className="empty-state">
            <Icon name="check" size={40} color="var(--green)" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Tudo em ordem</div>
            <div style={{ fontSize: 12 }}>Nenhum item próximo ao vencimento.</div>
          </div>
        </div>
      )}
    </div>
  );
}
