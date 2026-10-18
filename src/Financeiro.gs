/**
 * Financeiro: contratos com clientes, reajustes e serviços adicionais.
 * Acesso por pessoa (coluna "financeiro" da equipe), não por papel. Quem não tem acesso nem recebe os dados.
 * O servidor calcula o valor de cada mês do contrato (resumoContrato_), então a tela e os testes usam a mesma conta.
 */
const STATUS_CONTRATO = ['ativo', 'pausado', 'encerrado', 'cancelado'];
const TIPOS_AJUSTE = ['reajuste', 'adicional'];
// Pipeline de clientes do financeiro (como o do Be Flow): em que pé está cada contrato.
const FASES_CONTRATO = ['onboarding', 'em_dia', 'cobranca', 'atraso', 'renovacao', 'encerrado'];

// Fase de quem ainda não foi posto em nenhuma: encerrado, onboarding (ainda não começou) ou em dia.
function faseContrato_(c, hoje) {
  if (c.status === 'encerrado' || c.status === 'cancelado') return 'encerrado';
  if (FASES_CONTRATO.indexOf(c.fase) >= 0 && c.fase !== 'encerrado') return c.fase;
  return c.inicio > hoje ? 'onboarding' : 'em_dia';
}

function exigirFinanceiro_(papel) {
  const eu = exigir_(papel || 'leitor');
  if (!eu.financeiro) throw new Error('A tela Financeiro é restrita. Fale com o administrador.');
  return eu;
}

// ---------- contas com meses ("aaaa-mm") ----------
function mes_(iso) { return String(iso || '').slice(0, 7); }

function somaMes_(mes, n) {
  const a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1 + n;
  const y = a + Math.floor(m / 12), mm = ((m % 12) + 12) % 12 + 1;
  return y + '-' + (mm < 10 ? '0' : '') + mm;
}

function difMeses_(de, ate) {
  return (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + Number(ate.slice(5, 7)) - Number(de.slice(5, 7));
}

function ultimoDia_(mes) {
  const d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  return d.toISOString().slice(0, 10);
}

// Valor de cada mês, o que já foi faturado, o valor atual e quanto foi reajustado.
function resumoContrato_(c, todosAjustes, hoje) {
  const aj = todosAjustes.filter(function (a) { return a.contratoId === c.id; })
    .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : (a.criadoEm < b.criadoEm ? -1 : 1); });
  const reajustes = aj.filter(function (a) { return a.tipo === 'reajuste'; });
  const adicionais = aj.filter(function (a) { return a.tipo === 'adicional'; });
  const fee = c.tipo === 'fee';
  const ini = mes_(c.inicio), mesHoje = mes_(hoje);
  const encerrado = c.status === 'encerrado' || c.status === 'cancelado';
  const semPrazo = fee && !(c.meses > 0);

  let ultimo = !fee ? ini : semPrazo ? (mesHoje > ini ? mesHoje : ini) : somaMes_(ini, c.meses - 1);
  if (encerrado && c.encerradoEm && mes_(c.encerradoEm) < ultimo) ultimo = mes_(c.encerradoEm) < ini ? ini : mes_(c.encerradoEm);
  if (!fee) adicionais.forEach(function (a) { if (mes_(a.data) > ultimo) ultimo = mes_(a.data); });

  const baseEm = function (m) {
    let v = c.valor;
    reajustes.forEach(function (r) { if (mes_(r.data) <= m) v = r.valor; });
    return v;
  };
  const recorrentesEm = function (m) {
    return fee ? adicionais.reduce(function (s, a) { return s + (a.recorrente && mes_(a.data) <= m ? a.valor : 0); }, 0) : 0;
  };
  const serie = [];
  const n = Math.min(difMeses_(ini, ultimo), 239);
  for (let i = 0; i <= n; i++) {
    const m = somaMes_(ini, i);
    const base = fee ? baseEm(m) : (i === 0 ? c.valor : 0);
    const rec = recorrentesEm(m);
    const avulsos = adicionais.reduce(function (s, a) { return s + ((!a.recorrente || !fee) && mes_(a.data) === m ? a.valor : 0); }, 0);
    serie.push({ mes: m, base: base, adicionais: rec, avulsos: avulsos, total: base + rec + avulsos });
  }

  const ref = mesHoje < ini ? ini : mesHoje > ultimo ? ultimo : mesHoje;
  const baseAtual = fee ? baseEm(ref) : c.valor;
  const adicionaisAtuais = recorrentesEm(ref);
  const decorridos = serie.filter(function (s) { return s.mes <= mesHoje; });
  const fim = encerrado && c.encerradoEm ? c.encerradoEm : fee && !semPrazo ? ultimoDia_(somaMes_(ini, c.meses - 1)) : '';
  return Object.assign({}, c, {
    fase: faseContrato_(c, hoje),
    valorAtual: baseAtual + adicionaisAtuais,
    baseAtual: baseAtual,
    adicionaisAtuais: adicionaisAtuais,
    reajustePct: c.valor > 0 && fee ? Math.round((baseAtual / c.valor - 1) * 1000) / 10 : 0,
    faturado: decorridos.reduce(function (s, x) { return s + x.total; }, 0),
    totalPrevisto: serie.reduce(function (s, x) { return s + x.total; }, 0),
    mesesAtivo: decorridos.length,
    fim: fim,
    diasParaFim: fim && !encerrado ? Math.ceil((Date.parse(fim + 'T12:00:00Z') - Date.parse(hoje + 'T12:00:00Z')) / 864e5) : null,
    semPrazo: semPrazo,
    nReajustes: reajustes.length,
    nAdicionais: adicionais.length,
    serie: serie,
  });
}

function dadosFinanceiro_() {
  const hoje = hoje_(), ajustes = ler_('ajustes');
  return {
    contratos: ler_('contratos').map(function (c) { return resumoContrato_(c, ajustes, hoje); }),
    ajustes: ajustes,
  };
}

function retornoContrato_(id) {
  const c = achar_('contratos', id);
  const ajustes = ler_('ajustes');
  return { contrato: resumoContrato_(c, ajustes, hoje_()), ajustes: ajustes.filter(function (a) { return a.contratoId === id; }) };
}

// ---------- chamadas da tela ----------
function listarFinanceiro() {
  exigirFinanceiro_('leitor');
  return dadosFinanceiro_();
}

function salvarContrato(d) {
  const eu = exigirFinanceiro_('colaborador');
  return comTrava_(function () {
    d = d || {};
    const tipo = d.tipo === 'projeto' ? 'projeto' : 'fee';
    const c = {
      clienteId: texto_(d.clienteId, 40),
      oportunidadeId: texto_(d.oportunidadeId, 40),
      titulo: texto_(d.titulo, 140),
      servico: texto_(d.servico, 80),
      tipo: tipo,
      valor: Math.round(numero_(d.valor, 0, 1e12) * 100) / 100,
      inicio: dataIso_(d.inicio),
      meses: tipo === 'fee' ? Math.round(numero_(d.meses, 0, 120)) : 0,
      status: umDe_(d.status, STATUS_CONTRATO, 'ativo'),
      encerradoEm: dataIso_(d.encerradoEm),
      obs: texto_(d.obs, 3000),
      atualizadoEm: agora_(),
    };
    if (!c.clienteId || !achar_('clientes', c.clienteId)) throw new Error('Escolha o cliente do contrato.');
    if (c.oportunidadeId && !achar_('oportunidades', c.oportunidadeId)) c.oportunidadeId = '';
    if (!c.inicio) throw new Error('Informe a data de início.');
    if (!(c.valor > 0)) throw new Error('Informe o valor do contrato.');
    if (!c.titulo) c.titulo = c.servico || 'Contrato';
    if (c.status === 'encerrado' || c.status === 'cancelado') { if (!c.encerradoEm) c.encerradoEm = hoje_(); } else c.encerradoEm = '';
    if (c.encerradoEm && c.encerradoEm < c.inicio) throw new Error('O encerramento não pode ser antes do início.');
    if (!d.id) {
      Object.assign(c, { id: novoId_('ct'), criadoPor: eu.email, criadoEm: c.atualizadoEm });
      inserir_('contratos', c);
      registrar_(eu, 'contrato', c.id, 'criou', '', '', c.titulo);
      return retornoContrato_(c.id);
    }
    const r = atualizar_('contratos', d.id, c);
    registrarDiferencas_(eu, 'contrato', r.antes, r.depois, ['titulo', 'servico', 'tipo', 'valor', 'inicio', 'meses', 'status', 'encerradoEm']);
    return retornoContrato_(d.id);
  });
}

// Arrastar no pipeline. Ir para "Encerrados" encerra o contrato; sair de lá reativa.
function moverContratoFase(id, fase) {
  const eu = exigirFinanceiro_('colaborador');
  return comTrava_(function () {
    const c = achar_('contratos', texto_(id, 40));
    if (!c) throw new Error('Contrato não encontrado. Recarregue a página.');
    const f = umDe_(fase, FASES_CONTRATO, '');
    if (!f) throw new Error('Fase inválida.');
    const patch = { fase: f, atualizadoEm: agora_() };
    if (f === 'encerrado' && c.status !== 'encerrado' && c.status !== 'cancelado') { patch.status = 'encerrado'; patch.encerradoEm = hoje_() < c.inicio ? c.inicio : hoje_(); }
    if (f !== 'encerrado' && (c.status === 'encerrado' || c.status === 'cancelado')) { patch.status = 'ativo'; patch.encerradoEm = ''; }
    const de = faseContrato_(c, hoje_());
    atualizar_('contratos', c.id, patch);
    if (de !== f) registrar_(eu, 'contrato', c.id, 'moveu', 'fase', de, f);
    return retornoContrato_(c.id);
  });
}

function registrarAjuste(d) {
  const eu = exigirFinanceiro_('colaborador');
  return comTrava_(function () {
    d = d || {};
    const c = achar_('contratos', texto_(d.contratoId, 40));
    if (!c) throw new Error('Contrato não encontrado. Recarregue a página.');
    const a = {
      contratoId: c.id,
      tipo: umDe_(d.tipo, TIPOS_AJUSTE, ''),
      data: dataIso_(d.data) || hoje_(),
      valor: Math.round(numero_(d.valor, 0, 1e12) * 100) / 100,
      recorrente: d.tipo === 'adicional' && c.tipo === 'fee' && d.recorrente !== false,
      descricao: texto_(d.descricao, 300),
    };
    if (!a.tipo) throw new Error('Tipo de ajuste inválido.');
    if (!(a.valor > 0)) throw new Error(a.tipo === 'reajuste' ? 'Informe o novo valor mensal.' : 'Informe o valor do serviço.');
    if (a.tipo === 'reajuste' && c.tipo !== 'fee') throw new Error('Reajuste só vale para contratos de fee mensal.');
    if (a.tipo === 'adicional' && !a.descricao) throw new Error('Descreva o serviço adicional.');
    if (a.data < c.inicio) throw new Error('A data não pode ser antes do início do contrato.');
    Object.assign(a, { id: novoId_('aj'), criadoPor: eu.email, criadoEm: agora_() });
    inserir_('ajustes', a);
    registrar_(eu, 'contrato', c.id, a.tipo === 'reajuste' ? 'reajustou' : 'adicionou serviço', 'valor', '', String(a.valor));
    return retornoContrato_(c.id);
  });
}

function removerAjuste(id) {
  const eu = exigirFinanceiro_('colaborador');
  return comTrava_(function () {
    const a = achar_('ajustes', id);
    if (!a) throw new Error('Ajuste não encontrado.');
    remover_('ajustes', id);
    registrar_(eu, 'contrato', a.contratoId, 'removeu ' + a.tipo, 'valor', String(a.valor), '');
    return retornoContrato_(a.contratoId);
  });
}
