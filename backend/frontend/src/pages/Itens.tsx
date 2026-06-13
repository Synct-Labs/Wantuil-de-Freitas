import { useEffect, useState } from 'react';
import api from '../api/client';
import Scanner from '../components/Scanner';
import Icon from '../components/Icon';
import { fmtData, STATUS_VALIDADE } from '../utils/format';
import { excluirComConfirmacao } from '../utils/confirm';
import { useAuth } from '../context/AuthContext';

export default function Itens() {
  const { podeFazer } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [eanPre, setEanPre] = useState('');
  const [nomePre, setNomePre] = useState('');
  const [categoriaPre, setCategoriaPre] = useState('');

  useEffect(() => {
    carregar();
    api.get('/categorias').then((r) => setCategorias(r.data));
  }, []);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [busca, filtroCategoria]);

  function carregar() {
    const params: any = {};
    if (busca) params.busca = busca;
    if (filtroCategoria) params.categoriaId = filtroCategoria;
    api.get('/itens', { params }).then((r) => setItens(r.data));
  }

  function abrirCadastro(ean = '', nome = '', categoriaSugerida = '') {
    setEditando(null); setEanPre(ean); setNomePre(nome); setCategoriaPre(categoriaSugerida);
    setShowForm(true);
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
      pergunta: `Excluir "${item.nome}"?\n\nObservação: se o item já tiver movimentações, ele será desativado para preservar o histórico.`,
    });
    if (ok) carregar();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600 }} className="desktop-only">Itens</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {podeFazer('itens.criar') && (
            <button className="btn" onClick={() => setShowScanner(true)}>
              <Icon name="barcode" size={14} />Ler código
            </button>
          )}
          {podeFazer('itens.criar') && (
            <button className="btn primary" onClick={() => abrirCadastro()}>
              <Icon name="plus" size={14} />Novo item
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', maxWidth: 320, position: 'relative' }}>
          <Icon name="search" size={14} color="var(--text-3)"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input" placeholder="Buscar por nome, código ou EAN"
            value={busca} onChange={(e) => setBusca(e.target.value)}
            style={{ paddingLeft: 34 }} />
        </div>
        <select className="select" value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)} style={{ flex: '0 1 180px' }}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th>Código</th><th>EAN</th><th>Item</th><th>Setor</th><th>Saldo</th>
              <th>Mín.</th><th>Validade</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id}>
                <td data-label="Código" style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace' }}>{i.codigoInterno}</td>
                <td data-label="EAN" style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'monospace' }}>{i.codigoEan || '—'}</td>
                <td data-label="Item" style={{ fontWeight: 600 }}>{i.nome}</td>
                <td data-label="Setor">{i.setor ? <span className="pill blue">{i.setor.nome}</span> : '—'}</td>
                <td data-label="Saldo" style={{ fontWeight: 600,
                  color: i.abaixoMinimo ? 'var(--r-600)' : 'inherit' }}>
                  {i.saldoAtual} {i.unidadeMedida}
                </td>
                <td data-label="Mínimo" style={{ color: 'var(--text-2)' }}>{i.estoqueMinimo}</td>
                <td data-label="Validade" style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtData(i.dataValidade)}</td>
                <td data-label="Status">
                  <span className={`pill ${STATUS_VALIDADE[i.statusValidade]?.cor || 'green'}`}>
                    {STATUS_VALIDADE[i.statusValidade]?.label}
                  </span>
                </td>
                <td data-actions style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button className="btn icon sm" onClick={() => imprimirEtiqueta(i)} title="Imprimir etiqueta" aria-label="Etiqueta">
                      <Icon name="tag" size={13} />
                    </button>
                    {podeFazer('itens.editar') && (
                      <button className="btn icon sm" onClick={() => { setEditando(i); setShowForm(true); }} title="Editar" aria-label="Editar">
                        <Icon name="pencil" size={13} />
                      </button>
                    )}
                    {podeFazer('itens.excluir') && (
                      <button className="btn icon sm" onClick={() => excluir(i)} title="Excluir" aria-label="Excluir"
                        style={{ color: 'var(--r-600)' }}>
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itens.length === 0 && (
          <div className="empty-state">
            <Icon name="package" size={36} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
            <div className="empty-state-title">Nenhum item encontrado</div>
            <div style={{ fontSize: 12 }}>Cadastre o primeiro item ou ajuste o filtro.</div>
          </div>
        )}
      </div>

      {showScanner && (
        <Scanner
          onClose={() => setShowScanner(false)}
          onItemEncontrado={(item) => alert(`Item já cadastrado: ${item.nome}`)}
          onCadastroManual={(ean, nome, cat) => abrirCadastro(ean, nome || '', cat || '')}
        />
      )}

      {showForm && (
        <FormItem item={editando}
          eanInicial={eanPre} nomeInicial={nomePre} categoriaSugerida={categoriaPre}
          categorias={categorias}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); carregar(); }} />
      )}
    </div>
  );
}

function FormItem({ item, eanInicial, nomeInicial, categoriaSugerida, categorias, onClose, onSave }: any) {
  // Tenta pré-selecionar a categoria sugerida pelo nome
  const categoriaIdInicial = item?.categoriaId
    || categorias.find((c: any) => c.nome.toLowerCase() === (categoriaSugerida || '').toLowerCase())?.id
    || categorias[0]?.id || '';

  const [form, setForm] = useState({
    codigoEan: item?.codigoEan || eanInicial || '',
    nome: item?.nome || nomeInicial || '',
    descricao: item?.descricao || '',
    unidadeMedida: item?.unidadeMedida || '',
    estoqueMinimo: item?.estoqueMinimo || 0,
    categoriaId: categoriaIdInicial,
    setorId: item?.setorId || '',
    localizacao: item?.localizacao || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      // Monta payload limpo: setor preservado se ja existia (edicao), default 'un' para unidade
      const payload = {
        codigoEan: form.codigoEan?.trim() || undefined,
        nome: form.nome.trim(),
        descricao: form.descricao?.trim() || undefined,
        unidadeMedida: form.unidadeMedida?.trim() || 'un',
        estoqueMinimo: Number(form.estoqueMinimo) || 0,
        categoriaId: form.categoriaId,
        setorId: form.setorId || undefined,
        localizacao: form.localizacao?.trim() || undefined,
      };

      if (item) await api.patch(`/itens/${item.id}`, payload);
      else await api.post('/itens', payload);

      // Se o item tem EAN, salvar no catalogo local para acelerar leituras futuras.
      // Falha silenciosa: o item ja foi cadastrado com sucesso, o cache e secundario.
      if (payload.codigoEan && payload.nome) {
        const categoriaNome = categorias.find((c: any) => c.id === form.categoriaId)?.nome;
        api.post('/produtos-externos/salvar-manual', {
          ean: payload.codigoEan,
          nome: payload.nome,
          categoria: categoriaNome,
          categoriaSugerida: categoriaNome,
        }).catch(() => {/* silencioso */});
      }

      onSave();
    } catch (e: any) {
      setErro(e.response?.data?.message || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={salvar}>
        <div className="modal-header">
          <span className="modal-title">{item ? 'Editar item' : 'Novo item'}</span>
          <button type="button" className="btn icon sm ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>

        <label className="label">Código de barras (EAN)</label>
        <input className="input" value={form.codigoEan}
          onChange={(e) => setForm({ ...form, codigoEan: e.target.value })}
          style={{ marginBottom: 12, fontFamily: 'monospace' }}
          placeholder="Vazio para itens sem código de fábrica" />

        <label className="label">Nome do item *</label>
        <input className="input" required value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          style={{ marginBottom: 12 }} />

        <label className="label">Categoria *</label>
        <select className="select" value={form.categoriaId} required
          onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
          style={{ marginBottom: 12 }}>
          {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <div className="grid-2" style={{ marginBottom: 4 }}>
          <div>
            <label className="label">Unidade de medida</label>
            <select className="select" value={form.unidadeMedida || 'un'}
              onChange={(e) => setForm({ ...form, unidadeMedida: e.target.value })}>
              <option value="un">un — unidade (cada item inteiro)</option>
              <option value="kg">kg — quilograma</option>
              <option value="g">g — grama</option>
              <option value="L">L — litro</option>
              <option value="ml">ml — mililitro</option>
              <option value="pct">pct — pacote</option>
              <option value="cx">cx — caixa</option>
              <option value="fd">fd — fardo</option>
              <option value="par">par</option>
              <option value="rolo">rolo</option>
              <option value="dz">dz — dúzia</option>
            </select>
          </div>
          <div>
            <label className="label">Estoque mínimo</label>
            <input className="input" type="number" min="0" value={form.estoqueMinimo}
              onChange={(e) => setForm({ ...form, estoqueMinimo: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14, marginTop: 2, lineHeight: 1.4 }}>
          A unidade define como o saldo será exibido (ex: "12 un" ou "30 kg"). O estoque
          mínimo dispara alerta quando o saldo cai a esse valor — deixe 0 se não quiser alerta.
        </div>

        <label className="label">Localização física</label>
        <input className="input" value={form.localizacao}
          onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
          placeholder="Ex: Prateleira A-3" style={{ marginBottom: 12 }} />

        <label className="label">Descrição</label>
        <textarea className="input" rows={2} value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          style={{ marginBottom: 16, resize: 'vertical' }} />

        {erro && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--r-50)',
            color: 'var(--r-600)', fontSize: 12, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-circle" size={14} />{erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={salvando}>
            {salvando ? <><span className="spinner" /> Salvando</> : <><Icon name="check" size={14} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  );
}
