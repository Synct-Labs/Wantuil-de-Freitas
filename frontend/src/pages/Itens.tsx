import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
import { fmtData, STATUS_VALIDADE } from '../utils/format';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Itens() {
  const { podeFazer } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [eanPre, setEanPre] = useState('');
  const [nomePre, setNomePre] = useState('');

  useEffect(() => {
    carregar();
    api.get('/categorias').then((r) => setCategorias(r.data));
    api.get('/setores').then((r) => setSetores(r.data));
  }, []);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [busca, filtroCategoria]);

  function carregar() {
    const params: any = {};
    if (busca) params.busca = busca;
    if (filtroCategoria) params.categoriaId = filtroCategoria;
    api.get('/itens', { params }).then((r) => setItens(r.data));
  }

  function imprimirEtiqueta(item: any) {
    const qtd = prompt('Quantas etiquetas imprimir?', '1');
    if (!qtd) return;
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/etiquetas/${item.id}?qtd=${qtd}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.blob()).then((b) => window.open(URL.createObjectURL(b), '_blank'));
  }

  async function excluir(item: any) {
    const ok = await excluirComConfirmacao({
      url: `/itens/${item.id}`,
      pergunta: `Excluir "${item.nome}"?\n\nObservação: se o item já tiver movimentações, ele será desativado em vez de excluído (para preservar o histórico).`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16 }}>Itens</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {podeFazer('itens.criar') && <button className="btn" onClick={() => setShowScanner(true)}>📷 Ler código de barras</button>}
          {podeFazer('itens.criar') && <button className="btn primary" onClick={() => { setEditando(null); setEanPre(''); setNomePre(''); setShowForm(true); }}>+ Novo item</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="input" placeholder="Buscar por nome, código ou EAN..." value={busca}
          onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 320 }} />
        <select className="input" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Todas categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th><th>EAN</th><th>Item</th><th>Setor</th><th>Saldo</th><th>Mín.</th>
              <th>Validade</th><th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id}>
                <td style={{ fontSize: 11, color: 'var(--text2)' }}>{i.codigoInterno}</td>
                <td style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace' }}>{i.codigoEan || '—'}</td>
                <td style={{ fontWeight: 500 }}>{i.nome}</td>
                <td>{i.setor && <span className="pill blue">{i.setor.nome}</span>}</td>
                <td style={{ fontWeight: 500, color: i.abaixoMinimo ? 'var(--r600)' : 'inherit' }}>
                  {i.saldoAtual} {i.unidadeMedida}
                </td>
                <td style={{ color: 'var(--text2)' }}>{i.estoqueMinimo}</td>
                <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtData(i.dataValidade)}</td>
                <td>
                  <span className={`pill ${STATUS_VALIDADE[i.statusValidade]?.cor || 'green'}`}>
                    {STATUS_VALIDADE[i.statusValidade]?.label}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn sm" onClick={() => imprimirEtiqueta(i)} title="Imprimir etiqueta">🏷️</button>
                    {podeFazer('itens.editar') && (
                      <button className="btn sm" onClick={() => { setEditando(i); setShowForm(true); }} title="Editar">✏️</button>
                    )}
                    {podeFazer('itens.excluir') && (
                      <button className="btn sm" style={{ color: 'var(--r600)' }} onClick={() => excluir(i)} title="Excluir">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text2)' }}>Nenhum item encontrado.</div>}
      </div>

      {showScanner && (
        <Scanner
          onClose={() => setShowScanner(false)}
          onItemEncontrado={(item) => alert(`Item já cadastrado: ${item.nome}`)}
          onCadastroManual={(ean, nome) => { setEanPre(ean); setNomePre(nome || ''); setEditando(null); setShowForm(true); }}
        />
      )}

      {showForm && (
        <FormItem item={editando} eanInicial={eanPre} nomeInicial={nomePre}
          categorias={categorias} setores={setores}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); carregar(); }} />
      )}
    </div>
  );
}

function FormItem({ item, eanInicial, nomeInicial, categorias, setores, onClose, onSave }: any) {
  const [form, setForm] = useState({
    codigoEan: item?.codigoEan || eanInicial || '',
    nome: item?.nome || nomeInicial || '',
    descricao: item?.descricao || '',
    unidadeMedida: item?.unidadeMedida || 'un',
    estoqueMinimo: item?.estoqueMinimo || 0,
    categoriaId: item?.categoriaId || categorias[0]?.id || '',
    setorId: item?.setorId || '',
    localizacao: item?.localizacao || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      if (item) await api.patch(`/itens/${item.id}`, form);
      else await api.post('/itens', form);
      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <strong>{item ? 'Editar item' : 'Novo item'}</strong>
          <button type="button" className="btn sm" onClick={onClose}>✕</button>
        </div>
        <label className="label">EAN (código de barras)</label>
        <input className="input" value={form.codigoEan} onChange={(e) => setForm({ ...form, codigoEan: e.target.value })}
          style={{ marginBottom: 10 }} placeholder="Deixe vazio se item sem código" />
        <label className="label">Nome *</label>
        <input className="input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={{ marginBottom: 10 }} />
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div>
            <label className="label">Categoria *</label>
            <select className="input" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} required>
              {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Setor</label>
            <select className="input" value={form.setorId} onChange={(e) => setForm({ ...form, setorId: e.target.value })}>
              <option value="">—</option>
              {setores.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="grid2" style={{ marginBottom: 10 }}>
          <div>
            <label className="label">Unidade</label>
            <input className="input" value={form.unidadeMedida} onChange={(e) => setForm({ ...form, unidadeMedida: e.target.value })} />
          </div>
          <div>
            <label className="label">Estoque mínimo</label>
            <input className="input" type="number" value={form.estoqueMinimo}
              onChange={(e) => setForm({ ...form, estoqueMinimo: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <label className="label">Localização física</label>
        <input className="input" value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          placeholder="Ex: Prateleira A-3" style={{ marginBottom: 10 }} />
        <label className="label">Descrição</label>
        <textarea className="input" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          style={{ marginBottom: 14 }} />
        {erro && <div style={{ color: 'var(--r600)', fontSize: 12, marginBottom: 10 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn primary" disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
