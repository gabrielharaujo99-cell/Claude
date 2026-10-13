/** Propostas ligadas a uma oportunidade: link do documento (Drive, Canva, PDF...), valor e status. */
const STATUS_PROPOSTA = ['rascunho', 'enviada', 'aprovada', 'recusada'];

function salvarProposta(d) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    d = d || {};
    const op = achar_('oportunidades', texto_(d.oportunidadeId, 40));
    if (!op) throw new Error('Escolha a oportunidade da proposta.');
    const p = {
      oportunidadeId: op.id,
      titulo: texto_(d.titulo, 140),
      url: url_(d.url),
      valor: numero_(d.valor, 0, 1e12),
      status: umDe_(d.status, STATUS_PROPOSTA, 'rascunho'),
      enviadaEm: dataIso_(d.enviadaEm),
      validade: dataIso_(d.validade),
      obs: texto_(d.obs, 2000),
      atualizadoEm: agora_(),
    };
    if (!p.titulo) throw new Error('Dê um título para a proposta.');
    if (texto_(d.url, 1000) && !p.url) throw new Error('O link precisa começar com http:// ou https://');
    if (p.status !== 'rascunho' && !p.enviadaEm) p.enviadaEm = hoje_();
    if (!d.id) {
      Object.assign(p, { id: novoId_('p'), criadoPor: eu.email, criadoEm: p.atualizadoEm });
      const nova = inserir_('propostas', p);
      registrar_(eu, 'oportunidade', op.id, 'criou proposta', '', '', nova.titulo);
      return nova;
    }
    const r = atualizar_('propostas', d.id, p);
    if (r.antes.status !== r.depois.status) {
      registrar_(eu, 'oportunidade', op.id, 'proposta ' + r.depois.status, 'proposta', r.antes.titulo, r.depois.titulo);
    }
    return r.depois;
  });
}

function removerProposta(id) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    const p = achar_('propostas', id);
    if (!p) return true;
    if (p.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar a proposta.');
    registrar_(eu, 'oportunidade', p.oportunidadeId, 'apagou proposta', '', p.titulo, '');
    return remover_('propostas', id);
  });
}
