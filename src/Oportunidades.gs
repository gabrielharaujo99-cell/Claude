/**
 * Oportunidades (cards do funil), comentários e histórico.
 * Contrato "projeto" = valor único. Contrato "fee" = valor mensal × meses (receita recorrente).
 * A etapa só muda por moverOportunidade, que registra quando o card entrou na etapa (para o alerta de parado).
 */
const CAMPOS_OP = ['titulo', 'clienteId', 'servico', 'contrato', 'valor', 'meses', 'responsavel', 'prioridade', 'origem', 'previsao', 'obs', 'tags'];

function etapaPorId_(cfg, id) { return cfg.etapas.filter(function (e) { return e.id === id; })[0] || null; }

function limparOp_(d, eu) {
  const contrato = d.contrato === 'fee' ? 'fee' : 'projeto';
  const o = {
    titulo: texto_(d.titulo, 140),
    clienteId: texto_(d.clienteId, 40),
    servico: texto_(d.servico, 80),
    contrato: contrato,
    valor: numero_(d.valor, 0, 1e12),
    meses: contrato === 'fee' ? Math.round(numero_(d.meses || 12, 1, 120)) : 0,
    responsavel: membroAtivo_(email_(d.responsavel)) ? email_(d.responsavel) : '',
    prioridade: umDe_(d.prioridade, ['baixa', 'media', 'alta'], 'media'),
    origem: texto_(d.origem, 80),
    previsao: dataIso_(d.previsao),
    obs: texto_(d.obs, 5000),
    tags: (Array.isArray(d.tags) ? d.tags : []).map(function (t) { return texto_(t, 30); }).filter(Boolean).slice(0, 10),
  };
  if (!o.titulo) throw new Error('Dê um nome para a oportunidade.');
  if (!o.clienteId && texto_(d.clienteNome, 100)) o.clienteId = clientePorNome_(d.clienteNome, eu).id;
  if (o.clienteId && !achar_('clientes', o.clienteId)) o.clienteId = '';
  return o;
}

function salvarOportunidade(d) {
  const eu = exigirArea_('comercial', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const cfg = config_(), agora = agora_();
    const o = limparOp_(d, eu);
    o.atualizadoEm = agora;
    o.atualizadoPor = eu.email;
    if (!d.id) {
      const etapa = etapaPorId_(cfg, d.etapa) || cfg.etapas[0];
      const ordens = ler_('oportunidades').filter(function (x) { return x.etapa === etapa.id; }).map(function (x) { return x.ordem; });
      Object.assign(o, {
        id: novoId_('op'), etapa: etapa.id, ordem: ordens.length ? Math.min.apply(null, ordens) - 1 : 0,
        criadoEm: agora, criadoPor: eu.email, etapaDesde: agora, fechadoEm: etapa.tipo === 'aberta' ? '' : agora,
        motivoPerda: '', arquivado: false,
      });
      if (!o.responsavel) o.responsavel = eu.email;
      const nova = inserir_('oportunidades', o);
      registrar_(eu, 'oportunidade', nova.id, 'criou', '', '', nova.titulo);
      return nova;
    }
    if (!achar_('oportunidades', d.id)) throw new Error('Oportunidade não encontrada. Recarregue a página.');
    const r = atualizar_('oportunidades', d.id, o);
    registrarDiferencas_(eu, 'oportunidade', r.antes, r.depois, CAMPOS_OP);
    return r.depois;
  });
}

function moverOportunidade(id, etapaId, ordem, motivoPerda) {
  const eu = exigirArea_('comercial', 'colaborador');
  return comTrava_(function () {
    const cfg = config_(), e = etapaPorId_(cfg, etapaId);
    if (!e) throw new Error('Etapa inexistente. Recarregue a página.');
    const atual = achar_('oportunidades', id);
    if (!atual) throw new Error('Oportunidade não encontrada. Recarregue a página.');
    const agora = agora_();
    const patch = { atualizadoEm: agora, atualizadoPor: eu.email };
    if (ordem != null && ordem !== '') patch.ordem = numero_(ordem);
    const mudou = atual.etapa !== e.id;
    if (mudou) {
      patch.etapa = e.id;
      patch.etapaDesde = agora;
      patch.fechadoEm = e.tipo === 'aberta' ? '' : agora;
      patch.motivoPerda = e.tipo === 'perdido' ? texto_(motivoPerda, 120) : '';
    }
    const r = atualizar_('oportunidades', id, patch);
    if (mudou) {
      const de = etapaPorId_(cfg, atual.etapa);
      registrar_(eu, 'oportunidade', id, 'moveu', 'etapa', de ? de.nome : atual.etapa, e.nome);
      if (e.tipo === 'perdido' && patch.motivoPerda) registrar_(eu, 'oportunidade', id, 'alterou', 'motivoPerda', '', patch.motivoPerda);
      if (e.tipo === 'ganho') avisarGanho_(eu, r.depois, cfg);
    }
    return r.depois;
  });
}

function arquivarOportunidade(id, arquivar) {
  const eu = exigirArea_('comercial', 'gestor');
  return comTrava_(function () {
    const r = atualizar_('oportunidades', id, { arquivado: arquivar !== false, atualizadoEm: agora_(), atualizadoPor: eu.email });
    registrar_(eu, 'oportunidade', id, arquivar !== false ? 'arquivou' : 'desarquivou', '', '', '');
    return r.depois;
  });
}

function detalheOportunidade(id) {
  exigirArea_(['comercial', 'financeiro'], 'leitor');
  const comentarios = ler_('comentarios').filter(function (c) { return c.oportunidadeId === id; })
    .sort(function (a, b) { return a.criadoEm < b.criadoEm ? -1 : 1; });
  const historico = ler_('historico').filter(function (h) { return h.entidade === 'oportunidade' && h.entidadeId === id; })
    .sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).slice(0, 200);
  return { comentarios: comentarios, historico: historico };
}

function comentar(oportunidadeId, texto, mencoes) {
  const eu = exigirArea_('comercial', 'colaborador');
  const c = comTrava_(function () {
    const op = achar_('oportunidades', oportunidadeId);
    if (!op) throw new Error('Oportunidade não encontrada.');
    const t = texto_(texto, 4000);
    if (!t) throw new Error('Escreva o comentário.');
    const lista = (Array.isArray(mencoes) ? mencoes : []).map(email_)
      .filter(function (e, i, a) { return e && e !== eu.email && a.indexOf(e) === i && membroAtivo_(e); }).slice(0, 10);
    const novo = inserir_('comentarios', { id: novoId_('c'), oportunidadeId: op.id, autor: eu.email, texto: t, mencoes: lista, criadoEm: agora_() });
    return { comentario: novo, op: op };
  });
  if (c.comentario.mencoes.length) avisarMencao_(eu, c.comentario.mencoes, c.comentario.texto, c.op);
  return c.comentario;
}

function removerComentario(id) {
  const eu = exigirArea_('comercial', 'colaborador');
  return comTrava_(function () {
    const c = achar_('comentarios', id);
    if (!c) return true;
    if (c.autor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só o autor ou um gestor pode apagar o comentário.');
    return remover_('comentarios', id);
  });
}
