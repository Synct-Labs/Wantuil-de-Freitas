import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import api from '../api/client';

interface Props {
  onClose: () => void;
  onItemEncontrado: (item: any) => void;
  onCadastroManual: (ean: string, nomeSugerido?: string) => void;
}

export default function Scanner({ onClose, onItemEncontrado, onCadastroManual }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ean, setEan] = useState('');
  const [estado, setEstado] = useState<'idle' | 'buscando' | 'api' | 'nao_encontrado'>('idle');
  const [sugestao, setSugestao] = useState<any>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);

  useEffect(() => {
    if (!cameraAtiva || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    let controls: any;
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) {
        setEan(result.getText());
        buscar(result.getText());
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

    // 1. Busca no catálogo interno
    const { data } = await api.get(`/itens/ean/${eanBusca}`);
    if (data.encontrado) {
      onItemEncontrado(data.item);
      onClose();
      return;
    }

    // 2. Busca na Open Food Facts (gratuita, sem chave)
    try {
      const resp = await fetch(`https://world.openfoodfacts.org/api/v2/product/${eanBusca}?fields=product_name,brands,categories`);
      const off = await resp.json();
      if (off.status === 1 && off.product?.product_name) {
        setSugestao({ ean: eanBusca, nome: off.product.product_name, marca: off.product.brands });
        setEstado('api');
        return;
      }
    } catch { /* API fora do ar: segue para manual */ }

    setEstado('nao_encontrado');
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <strong>📷 Ler Código de Barras</strong>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        {cameraAtiva ? (
          <video ref={videoRef} style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} />
        ) : (
          <div style={{ background: 'var(--g50)', border: '1px dashed var(--border2)', borderRadius: 8,
            padding: '20px 16px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              Use o scanner USB (digita sozinho no campo), a câmera, ou digite o EAN
            </div>
            <input className="input" placeholder="Ex: 7896006716015" autoFocus
              value={ean} onChange={(e) => setEan(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              style={{ textAlign: 'center', fontSize: 15, letterSpacing: 2 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => buscar()} disabled={estado === 'buscando'}>
            {estado === 'buscando' ? '⏳ Buscando...' : '🔎 Buscar'}
          </button>
          <button className="btn" onClick={() => setCameraAtiva(!cameraAtiva)}>
            {cameraAtiva ? 'Parar câmera' : '🎥 Câmera'}
          </button>
        </div>

        {estado === 'api' && sugestao && (
          <div style={{ background: 'var(--g50)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--g600)', fontWeight: 500, marginBottom: 4 }}>
              ✅ Encontrado via Open Food Facts
            </div>
            <div style={{ fontWeight: 600 }}>{sugestao.nome}</div>
            {sugestao.marca && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sugestao.marca}</div>}
            <button className="btn primary sm" style={{ marginTop: 10 }}
              onClick={() => { onCadastroManual(sugestao.ean, sugestao.nome); onClose(); }}>
              Cadastrar este produto
            </button>
          </div>
        )}

        {estado === 'nao_encontrado' && (
          <div style={{ background: 'var(--a50)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--a600)', fontWeight: 500, marginBottom: 8 }}>
              ⚠️ Código não reconhecido — cadastre manualmente
            </div>
            <button className="btn primary sm" onClick={() => { onCadastroManual(ean); onClose(); }}>
              Abrir cadastro com EAN preenchido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
