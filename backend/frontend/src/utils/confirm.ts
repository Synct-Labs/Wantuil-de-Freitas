import api from '../api/client';

/**
 * Excluir generico com confirmacao e tratamento de erro/desativacao.
 * Retorna true se a operacao foi bem-sucedida.
 */
export async function excluirComConfirmacao(opts: {
  url: string;
  pergunta: string;
}): Promise<boolean> {
  if (!confirm(opts.pergunta)) return false;
  try {
    const { data } = await api.delete(opts.url);
    if (data?.mensagem) {
      alert(data.mensagem);
    } else {
      alert('Excluido com sucesso');
    }
    return true;
  } catch (e: any) {
    alert(e.response?.data?.message || 'Erro ao excluir');
    return false;
  }
}
