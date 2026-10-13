/** Tarefas: soltas ou presas a uma oportunidade, num quadro A fazer / Fazendo / Feito. */
const STATUS_TAREFA = ['afazer', 'fazendo', 'feito'];

function salvarTarefa(d) {
  const eu = exigir_('colaborador');
  const r = comTrava_(function () {
    d = d || {};
    const t = {
      titulo: texto_(d.titulo, 200),
      descricao: texto_(d.descricao, 3000),
      oportunidadeId: texto_(d.oportunidadeId, 40),
      clienteId: texto_(d.clienteId, 40),
      responsavel: membroAtivo_(email_(d.responsavel)) ? email_(d.responsavel) : '',
      prazo: dataIso_(d.prazo),
      status: umDe_(d.status, STATUS_TAREFA, 'afazer'),
      atualizadoEm: agora_(),
    };
    if (!t.titulo) throw new Error('Descreva a tarefa.');
    const op = t.oportunidadeId ? achar_('oportunidades', t.oportunidadeId) : null;
    if (!op) t.oportunidadeId = '';
    if (op && !t.clienteId) t.clienteId = op.clienteId;
    if (t.clienteId && !achar_('clientes', t.clienteId)) t.clienteId = '';
    if (!d.id) {
      Object.assign(t, { id: novoId_('t'), ordem: Date.now(), criadoPor: eu.email, criadoEm: t.atualizadoEm, concluidoEm: t.status === 'feito' ? t.atualizadoEm : '' });
      if (!t.responsavel) t.responsavel = eu.email;
      const nova = inserir_('tarefas', t);
      if (nova.oportunidadeId) registrar_(eu, 'oportunidade', nova.oportunidadeId, 'criou tarefa', '', '', nova.titulo);
      return { tarefa: nova, avisar: nova.responsavel !== eu.email, op: op };
    }
    const antes = achar_('tarefas', d.id);
    if (!antes) throw new Error('Tarefa não encontrada. Recarregue a página.');
    if (t.status === 'feito' && antes.status !== 'feito') t.concluidoEm = t.atualizadoEm;
    if (t.status !== 'feito') t.concluidoEm = '';
    const depois = atualizar_('tarefas', d.id, t).depois;
    return { tarefa: depois, avisar: depois.responsavel !== antes.responsavel && depois.responsavel !== eu.email, op: op };
  });
  if (r.avisar) avisarTarefa_(eu, r.tarefa, r.op);
  return r.tarefa;
}

function moverTarefa(id, status, ordem) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    const antes = achar_('tarefas', id);
    if (!antes) throw new Error('Tarefa não encontrada. Recarregue a página.');
    const s = umDe_(status, STATUS_TAREFA, antes.status);
    const patch = { status: s, atualizadoEm: agora_() };
    if (ordem != null && ordem !== '') patch.ordem = numero_(ordem);
    if (s === 'feito' && antes.status !== 'feito') patch.concluidoEm = patch.atualizadoEm;
    if (s !== 'feito') patch.concluidoEm = '';
    const depois = atualizar_('tarefas', id, patch).depois;
    if (s === 'feito' && antes.status !== 'feito' && depois.oportunidadeId) {
      registrar_(eu, 'oportunidade', depois.oportunidadeId, 'concluiu tarefa', '', '', depois.titulo);
    }
    return depois;
  });
}

function removerTarefa(id) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    const t = achar_('tarefas', id);
    if (!t) return true;
    if (t.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar a tarefa.');
    return remover_('tarefas', id);
  });
}
