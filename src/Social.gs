/**
 * Social media: as peças de conteúdo de cada cliente, da pauta à publicação.
 * Só quem tem a área "social" vê e mexe.
 */
const STATUS_POST = ['pauta', 'producao', 'aprovacao', 'agendado', 'publicado'];
const FORMATOS_POST = ['Reels', 'Carrossel', 'Post', 'Stories', 'Vídeo'];
const REDES_POST = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook'];

function salvarPost(d) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const p = {
      clienteId: texto_(d.clienteId, 40),
      titulo: texto_(d.titulo, 160),
      formato: umDe_(d.formato, FORMATOS_POST, 'Post'),
      rede: umDe_(d.rede, REDES_POST, 'Instagram'),
      status: umDe_(d.status, STATUS_POST, 'pauta'),
      data: dataIso_(d.data),
      hora: /^\d{2}:\d{2}$/.test(texto_(d.hora, 5)) ? texto_(d.hora, 5) : '',
      responsavel: membroAtivo_(email_(d.responsavel)) ? email_(d.responsavel) : '',
      legenda: texto_(d.legenda, 3000),
      link: url_(d.link),
      obs: texto_(d.obs, 1000),
      pilar: texto_(d.pilar, 40),
      atualizadoEm: agora_(),
    };
    if (!p.titulo) throw new Error('Dê um título para o conteúdo.');
    if (!p.clienteId || !achar_('clientes', p.clienteId)) throw new Error('Escolha o cliente.');
    if (texto_(d.link, 1000) && !p.link) throw new Error('O link precisa começar com http:// ou https://');
    if ((p.status === 'agendado' || p.status === 'publicado') && !p.data) throw new Error('Informe a data de publicação.');
    if (!d.id) {
      Object.assign(p, { id: novoId_('po'), criadoPor: eu.email, criadoEm: p.atualizadoEm });
      if (!p.responsavel) p.responsavel = eu.email;
      return inserir_('posts', p);
    }
    if (!achar_('posts', d.id)) throw new Error('Conteúdo não encontrado. Recarregue a página.');
    return atualizar_('posts', d.id, p).depois;
  });
}

function moverPost(id, status) {
  exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const p = achar_('posts', texto_(id, 40));
    if (!p) throw new Error('Conteúdo não encontrado. Recarregue a página.');
    const s = umDe_(status, STATUS_POST, p.status);
    if ((s === 'agendado' || s === 'publicado') && !p.data) throw new Error('Defina a data de publicação antes de agendar.');
    return atualizar_('posts', p.id, { status: s, atualizadoEm: agora_() }).depois;
  });
}

function removerPost(id) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const p = achar_('posts', id);
    if (!p) return true;
    if (p.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar.');
    return remover_('posts', id);
  });
}
