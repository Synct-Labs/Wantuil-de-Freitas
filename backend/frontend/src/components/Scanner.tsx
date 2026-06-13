import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import api from '../api/client';
import Icon from './Icon';

interface Props {
  onClose: () => void;
  onItemEncontrado: (item: any) => void;
  onCadastroManual: (ean: string, nomeSugerido?: string, categoriaSugerida?: string) => void;
}

type Estado = 'idle' | 'buscando' | 'sugestao' | 'nao_encontrado';

export default function Scanner({ onClose, onItemEncontrado, onCadastroManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ean, setEan] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [sugestao, setSugestao] = useState<any>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);

  useEffect(() => {
    if (!cameraAtiva || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    let controls: any;
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) {
        const codigo = result.getText();
        setEan(codigo);
        buscar(codigo);
        controls?.stop();
        setCameraAtiva(false);
      }
    }).then((c) => { controls = c; });
    return () => controls?.stop();
  }, [cameraAtiva]);

  async function buscar(codigo?: string) {
    const eanBusca = (codigo || ean).trim();
    if (!eanBusca) return;
    setEstado('buscando');
    setSugestao(null);

    // 1. Catálogo interno primeiro
    try {
      const { data } = await api.get(`/itens/ean/${eanBusca}`);
      if (data.encontrado) {
        onItemEncontrado(data.item);
        onClose();
        return;
      }
    } catch {/* prossegue */}

    // 2. Busca agregada (Open Food/Beauty/Products Facts em paralelo)
    try {
      const { data } = await api.get(`/produtos-externos/ean/${eanBusca}`);
      if (data && data.nome) {
        setSugestao(data);
        setEstado('sugestao');
        return;
      }
    } catch {/* prossegue */}

    setEstado('nao_encontrado');
  }

  function fonteLabel(fonte: string): string {
    const map: Record<string, string> = {
      'catalogo-local': 'Catálogo da instituição (consulta anterior)',
      'dotcompany': 'DotCompany (base brasileira)',
      'produto-xyz': 'Produto XYZ (base colaborativa brasileira)',
      'cosmos-bluesoft': 'Cosmos Bluesoft (referência brasileira)',
      'open-food-facts': 'Open Food Facts (alimentos)',
      'open-beauty-facts': 'Open Beauty Facts (higiene)',
      'open-products-facts': 'Open Products Facts (limpeza/geral)',
      'upcitemdb': 'UPCitemdb (base internacional)',
    };
    return map[fonte] || fonte;
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="barcode" size={18} color="var(--primary)" />
            <span className="modal-title">Ler código de barras</span>
          </div>
          <button className="btn icon sm ghost" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={16} />
          </button>
        </div>

        {cameraAtiva ? (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 8, background: '#000' }} />
            <div style={{
              position: 'absolute', top: '50%', left: '10%', right: '10%', height: 2,
              background: 'var(--wf-amarelo)', boxShadow: '0 0 12px var(--wf-amarelo)',
            }} />
          </div>
        ) : (
          <div style={{
            background: 'var(--primary-bg)',
            border: `1px dashed var(--primary-lt)`,
            borderRadius: 8,
            padding: '24px 16px',
            textAlign: 'center',
            marginBottom: 14,
          }}>
            <Icon name="barcode" size={36} color="var(--primary)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
              Use o scanner USB, ative a câmera, ou digite o código manualmente
            </div>
            <input className="input" placeholder="000 0000 000 000" autoFocus
              value={ean} onChange={(e) => setEan(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              style={{ textAlign: 'center', fontSize: 16, letterSpacing: 3, fontFamily: 'monospace' }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => buscar()} disabled={estado === 'buscando' || !ean}>
            {estado === 'buscando'
              ? <><span className="spinner" /> Buscando...</>
              : <><Icon name="search" size={14} /> Buscar produto</>}
          </button>
          <button className="btn" onClick={() => setCameraAtiva(!cameraAtiva)}>
            <Icon name="camera" size={14} />
            {cameraAtiva ? 'Parar' : 'Câmera'}
          </button>
        </div>

        {estado === 'sugestao' && sugestao && (
          <div style={{
            background: 'var(--green-bg)',
            border: `1px solid var(--green)`,
            borderRadius: 8, padding: 14,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--green)', fontWeight: 600,
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              <Icon name="check" size={12} />
              Produto encontrado
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{sugestao.nome}</div>
            {sugestao.marca && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                Marca: {sugestao.marca}
              </div>
            )}
            {sugestao.categoria && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                Categoria: {sugestao.categoria}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12 }}>
              Fonte: {fonteLabel(sugestao.fonte)}
            </div>
            <button className="btn primary sm"
              onClick={() => { onCadastroManual(sugestao.ean, sugestao.nome, sugestao.categoriaSugerida); onClose(); }}>
              <Icon name="plus" size={13} />Cadastrar este produto
            </button>
          </div>
        )}

        {estado === 'nao_encontrado' && (
          <div style={{
            background: 'var(--a-50)',
            border: `1px solid var(--a-200)`,
            borderRadius: 8, padding: 14,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--a-600)', fontWeight: 600, marginBottom: 6,
            }}>
              <Icon name="alert-circle" size={14} />
              Produto não encontrado nas bases públicas
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
              Cadastre o produto manualmente. O código de barras será preenchido automaticamente.
            </div>
            <button className="btn primary sm" onClick={() => { onCadastroManual(ean); onClose(); }}>
              <Icon name="plus" size={13} />Cadastrar manualmente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
