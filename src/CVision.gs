/**
 * C-Vision: a visão do CEO sobre tudo o que acontece na empresa (comercial, financeiro, as quatro forças,
 * equipe, rentabilidade, alertas e atividade recente). Acesso por pessoa (coluna "cvision" da equipe).
 * Tudo vem calculado daqui: quem não tem acesso não recebe nem os números agregados.
 */
function exigirCVision_() {
  const eu = exigir_('leitor');
  if (!eu.cvision) throw new Error('O C-Vision é exclusivo. Fale com o administrador.');
  return eu;
}

function totalOpServ_(o) { return o.contrato === 'fee' ? (o.valor || 0) * (o.meses || 0) : (o.valor || 0); }

function diasEntre_(a, b) {
  const ta = Date.parse(a), tb = Date.parse(b);
  return isFinite(ta) && isFinite(tb) ? Math.round((tb - ta) / 864e5) : 0;
}

function soma_(lista, fn) { return lista.reduce(function (s, x) { return s + (fn(x) || 0); }, 0); }

function cvision() {
  const eu = exigirCVision_();
  const cfg = config_(), hoje = hoje_(), mes = hoje.slice(0, 7), ano = hoje.slice(0, 4);
  const agoraIso = new Date(hoje + 'T23:59:59').toISOString();
  const tipo = {};
  cfg.etapas.forEach(function (e) { tipo[e.id] = e.tipo; });
  const clientes = ler_('clientes'), cliNome = {}, cliSeg = {};
  clientes.forEach(function (c) { cliNome[c.id] = c.nome; cliSeg[c.id] = c.segmento || 'Sem segmento'; });
  const ops = ler_('oportunidades').filter(function (o) { return !o.arquivado; });
  const tarefas = ler_('tarefas'), horas = ler_('horas'), propostas = ler_('propostas');
  const equipe = ler_('equipe').filter(function (m) { return m.ativo; });
  const fin = dadosFinanceiro_();
  const contratos = fin.contratos;
  const meses12 = [];
  for (let i = 11; i >= 0; i--) meses12.push(somaMes_(mes, -i));

  // ---------- comercial ----------
  const abertas = ops.filter(function (o) { return tipo[o.etapa] === 'aberta'; });
  const ganhas = ops.filter(function (o) { return tipo[o.etapa] === 'ganho'; });
  const perdidas = ops.filter(function (o) { return tipo[o.etapa] === 'perdido'; });
  const desde = function (dias) { return new Date(Date.parse(hoje) - dias * 864e5).toISOString(); };
  const fechadasEm = function (lista, dias) { return lista.filter(function (o) { return o.fechadoEm && o.fechadoEm >= desde(dias); }); };
  const g90 = fechadasEm(ganhas, 90).length, p90 = fechadasEm(perdidas, 90).length;
  const ciclos = fechadasEm(ganhas, 180).map(function (o) { return diasEntre_(o.criadoEm, o.fechadoEm); }).filter(function (d) { return d >= 0; });
  const ganhasAno = ganhas.filter(function (o) { return String(o.fechadoEm).slice(0, 4) === ano; });
  const paradas = abertas.filter(function (o) { return diasDesde_(o.etapaDesde) >= cfg.diasParado; })
    .sort(function (a, b) { return a.etapaDesde < b.etapaDesde ? -1 : 1; });
  const etapaNome = {};
  cfg.etapas.forEach(function (e) { etapaNome[e.id] = e.nome; });

  const origens = {};
  ops.forEach(function (o) {
    const k = o.origem || 'Sem origem';
    const x = origens[k] = origens[k] || { origem: k, total: 0, ganhos: 0, perdidos: 0, valorGanho: 0 };
    x.total++;
    if (tipo[o.etapa] === 'ganho') { x.ganhos++; x.valorGanho += totalOpServ_(o); }
    if (tipo[o.etapa] === 'perdido') x.perdidos++;
  });

  const comercial = {
    abertoTotal: soma_(abertas, totalOpServ_),
    abertoN: abertas.length,
    ponderado: soma_(abertas, function (o) { const e = etapaPorId_(cfg, o.etapa); return totalOpServ_(o) * (e ? e.prob : 0) / 100; }),
    ganhoMes: soma_(ganhas.filter(function (o) { return String(o.fechadoEm).slice(0, 7) === mes; }), totalOpServ_),
    ganhoAno: soma_(ganhasAno, totalOpServ_),
    ganhosAno: ganhasAno.length,
    ticketMedio: ganhasAno.length ? soma_(ganhasAno, totalOpServ_) / ganhasAno.length : 0,
    conversao90: g90 + p90 ? Math.round(100 * g90 / (g90 + p90)) : null,
    cicloMedio: ciclos.length ? Math.round(soma_(ciclos, function (d) { return d; }) / ciclos.length) : null,
    novas30: ops.filter(function (o) { return o.criadoEm >= desde(30); }).length,
    funil: cfg.etapas.filter(function (e) { return e.tipo === 'aberta'; }).map(function (e) {
      const l = abertas.filter(function (o) { return o.etapa === e.id; });
      return { etapa: e.nome, cor: e.cor, prob: e.prob, n: l.length, valor: soma_(l, totalOpServ_), paradas: l.filter(function (o) { return paradas.indexOf(o) >= 0; }).length };
    }),
    serieGanhos: meses12.map(function (m) {
      const l = ganhas.filter(function (o) { return String(o.fechadoEm).slice(0, 7) === m; });
      return { mes: m, valor: soma_(l, totalOpServ_), n: l.length };
    }),
    origens: Object.keys(origens).map(function (k) { return origens[k]; }).sort(function (a, b) { return b.valorGanho - a.valorGanho || b.total - a.total; }),
    paradas: paradas.slice(0, 6).map(function (o) {
      return { id: o.id, titulo: o.titulo, cliente: cliNome[o.clienteId] || '', etapa: etapaNome[o.etapa] || '', dias: diasDesde_(o.etapaDesde), valor: totalOpServ_(o), responsavel: o.responsavel };
    }),
  };

  // ---------- financeiro ----------
  const ativos = contratos.filter(function (c) { return c.status === 'ativo'; });
  const feeAtivos = ativos.filter(function (c) { return c.tipo === 'fee'; });
  const mrr = soma_(feeAtivos, function (c) { return c.valorAtual; });
  const recorrenteEm = function (m) {
    return soma_(contratos, function (c) {
      if (c.tipo !== 'fee') return 0;
      const s = c.serie.filter(function (x) { return x.mes === m; })[0];
      return s ? s.base + s.adicionais : 0;
    });
  };
  const mrr3 = recorrenteEm(somaMes_(mes, -3));
  const porCliente = {};
  feeAtivos.forEach(function (c) { porCliente[c.clienteId] = (porCliente[c.clienteId] || 0) + c.valorAtual; });
  const topClientes = Object.keys(porCliente).map(function (id) { return { cliente: cliNome[id] || '—', mensal: porCliente[id], share: mrr ? porCliente[id] / mrr : 0 }; })
    .sort(function (a, b) { return b.mensal - a.mensal; });
  const reajustados = feeAtivos.filter(function (c) { return c.reajustePct > 0; });
  const financeiro = {
    mrr: mrr,
    mrr3: mrr3,
    crescimento: mrr3 ? Math.round((mrr / mrr3 - 1) * 1000) / 10 : null,
    contratosAtivos: ativos.length,
    faturado12: meses12.map(function (m) { return { mes: m, valor: soma_(contratos, function (c) { const s = c.serie.filter(function (x) { return x.mes === m; })[0]; return s ? s.total : 0; }) }; }),
    faturadoAno: soma_(contratos, function (c) { return soma_(c.serie.filter(function (x) { return x.mes.slice(0, 4) === ano && x.mes <= mes; }), function (x) { return x.total; }); }),
    reajusteMedio: reajustados.length ? Math.round(soma_(reajustados, function (c) { return c.reajustePct; }) / reajustados.length * 10) / 10 : 0,
    renovacoes: ativos.filter(function (c) { return c.diasParaFim != null && c.diasParaFim >= 0 && c.diasParaFim <= 90; })
      .sort(function (a, b) { return a.diasParaFim - b.diasParaFim; })
      .map(function (c) { return { cliente: cliNome[c.clienteId] || '—', titulo: c.titulo, dias: c.diasParaFim, mensal: c.valorAtual }; }),
    topClientes: topClientes.slice(0, 6),
    concentracaoTop1: topClientes.length ? topClientes[0].share : 0,
    semContrato: ganhas.filter(function (o) { return !contratos.some(function (c) { return c.oportunidadeId === o.id; }); }).length,
  };

  // ---------- as quatro forças (segmentos) ----------
  const segs = {};
  cfg.segmentos.forEach(function (s) { segs[s] = { segmento: s, clientes: 0, mrr: 0, pipeline: 0, ganhoAno: 0 }; });
  const seg = function (k) { return segs[k] = segs[k] || { segmento: k, clientes: 0, mrr: 0, pipeline: 0, ganhoAno: 0 }; };
  clientes.filter(function (c) { return !c.arquivado; }).forEach(function (c) { seg(c.segmento || 'Sem segmento').clientes++; });
  feeAtivos.forEach(function (c) { seg(cliSeg[c.clienteId] || 'Sem segmento').mrr += c.valorAtual; });
  abertas.forEach(function (o) { seg(cliSeg[o.clienteId] || 'Sem segmento').pipeline += totalOpServ_(o); });
  ganhasAno.forEach(function (o) { seg(cliSeg[o.clienteId] || 'Sem segmento').ganhoAno += totalOpServ_(o); });
  const segmentos = Object.keys(segs).map(function (k) { return segs[k]; })
    .filter(function (s) { return s.segmento !== 'Sem segmento' || s.clientes || s.mrr || s.pipeline; });

  // ---------- equipe ----------
  const atrasada = function (t) { return t.status !== 'feito' && t.prazo && t.prazo < hoje; };
  const pessoas = equipe.map(function (m) {
    const minhas = tarefas.filter(function (t) { return t.responsavel === m.email; });
    return {
      email: m.email, nome: m.nome, cargo: m.cargo,
      abertas: minhas.filter(function (t) { return t.status !== 'feito'; }).length,
      atrasadas: minhas.filter(atrasada).length,
      feitas30: minhas.filter(function (t) { return t.status === 'feito' && t.concluidoEm >= desde(30); }).length,
      horasMes: soma_(horas.filter(function (h) { return h.email === m.email && h.data.slice(0, 7) === mes; }), function (h) { return h.horas; }),
      ops: abertas.filter(function (o) { return o.responsavel === m.email; }).length,
    };
  }).sort(function (a, b) { return b.abertas - a.abertas || a.nome.localeCompare(b.nome); });

  // ---------- rentabilidade: receita mensal x horas dos últimos 30 dias ----------
  const h30 = horas.filter(function (h) { return h.data >= desde(30).slice(0, 10); });
  const horasCli = {};
  h30.forEach(function (h) { horasCli[h.clienteId] = (horasCli[h.clienteId] || 0) + h.horas; });
  const rentabilidade = Object.keys(Object.assign({}, horasCli, porCliente)).map(function (id) {
    const hr = horasCli[id] || 0, rec = porCliente[id] || 0;
    return { cliente: cliNome[id] || '—', horas: hr, receita: rec, porHora: hr ? rec / hr : null };
  }).sort(function (a, b) { return (b.porHora || 0) - (a.porHora || 0) || b.receita - a.receita; });

  // ---------- social media ----------
  const posts = ler_('posts');
  const em7 = new Date(Date.parse(hoje) + 7 * 864e5).toISOString().slice(0, 10);
  const postsAtrasados = posts.filter(function (p) { return p.status !== 'publicado' && p.data && p.data < hoje; });
  const social = {
    publicadosMes: posts.filter(function (p) { return p.status === 'publicado' && p.data.slice(0, 7) === mes; }).length,
    agendados7: posts.filter(function (p) { return p.status === 'agendado' && p.data >= hoje && p.data <= em7; }).length,
    aprovacao: posts.filter(function (p) { return p.status === 'aprovacao'; }).length,
    atrasados: postsAtrasados.length,
    porStatus: STATUS_POST.map(function (s) { return { status: s, n: posts.filter(function (p) { return p.status === s; }).length }; }),
    porCliente: clientes.map(function (c) {
      const l = posts.filter(function (p) { return p.clienteId === c.id; });
      return { cliente: c.nome, publicados: l.filter(function (p) { return p.status === 'publicado' && p.data.slice(0, 7) === mes; }).length, fila: l.filter(function (p) { return p.status !== 'publicado'; }).length };
    }).filter(function (x) { return x.publicados || x.fila; }).sort(function (a, b) { return b.publicados + b.fila - a.publicados - a.fila; }).slice(0, 6),
  };

  // ---------- tráfego (últimos 30 dias, comparado aos 30 anteriores) ----------
  const resultados = ler_('resultados'), campanhas = ler_('campanhas');
  const d30 = desde(30).slice(0, 10), d60 = desde(60).slice(0, 10);
  const r30 = resultados.filter(function (r) { return r.data >= d30 && r.data <= hoje; });
  const r60 = resultados.filter(function (r) { return r.data >= d60 && r.data < d30; });
  const somaR = function (l, k) { return soma_(l, function (r) { return r[k]; }); };
  const inv30 = somaR(r30, 'investimento'), leads30 = somaR(r30, 'leads'), rec30 = somaR(r30, 'receita');
  const inv60 = somaR(r60, 'investimento'), leads60 = somaR(r60, 'leads');
  const campNome = {}, campCli = {};
  campanhas.forEach(function (c) { campNome[c.id] = c.nome; campCli[c.id] = cliNome[c.clienteId] || ''; });
  const porCamp = {};
  r30.forEach(function (r) { const x = porCamp[r.campanhaId] = porCamp[r.campanhaId] || { inv: 0, leads: 0, rec: 0 }; x.inv += r.investimento; x.leads += r.leads; x.rec += r.receita; });
  const trafego = {
    investimento30: inv30, leads30: leads30, receita30: rec30,
    cpl30: leads30 ? inv30 / leads30 : null, cpl60: leads60 ? inv60 / leads60 : null,
    roas30: inv30 ? rec30 / inv30 : null,
    variacaoInvest: inv60 ? Math.round((inv30 / inv60 - 1) * 1000) / 10 : null,
    variacaoLeads: leads60 ? Math.round((leads30 / leads60 - 1) * 1000) / 10 : null,
    campanhasAtivas: campanhas.filter(function (c) { return c.status === 'ativa'; }).length,
    campanhas: Object.keys(porCamp).map(function (id) {
      const x = porCamp[id];
      return { nome: campNome[id] || '—', cliente: campCli[id], investimento: x.inv, leads: x.leads, cpl: x.leads ? x.inv / x.leads : null, roas: x.inv ? x.rec / x.inv : null };
    }).sort(function (a, b) { return b.investimento - a.investimento; }).slice(0, 6),
  };

  // ---------- alertas ----------
  const tarefasAbertas = tarefas.filter(function (t) { return t.status !== 'feito'; });
  const atrasadas = tarefas.filter(atrasada);
  const vencidas = propostas.filter(function (p) { return p.status === 'enviada' && p.validade && p.validade < hoje; });
  const renov30 = financeiro.renovacoes.filter(function (r) { return r.dias <= 30; });
  const alertas = [];
  if (paradas.length) alertas.push({ nivel: 'alto', texto: paradas.length + ' oportunidade(s) parada(s) há ' + cfg.diasParado + '+ dias', valor: soma_(paradas, totalOpServ_) });
  if (renov30.length) alertas.push({ nivel: 'alto', texto: renov30.length + ' contrato(s) vencendo em até 30 dias', valor: soma_(renov30, function (r) { return r.mensal; }) });
  if (atrasadas.length) alertas.push({ nivel: 'medio', texto: atrasadas.length + ' tarefa(s) atrasada(s) na equipe' });
  if (financeiro.semContrato) alertas.push({ nivel: 'medio', texto: financeiro.semContrato + ' fechamento(s) sem contrato cadastrado' });
  if (vencidas.length) alertas.push({ nivel: 'medio', texto: vencidas.length + ' proposta(s) enviada(s) com validade vencida' });
  if (postsAtrasados.length) alertas.push({ nivel: 'medio', texto: postsAtrasados.length + ' conteúdo(s) com data vencida e não publicado(s)' });
  if (trafego.cpl30 && trafego.cpl60 && trafego.cpl30 > trafego.cpl60 * 1.2) alertas.push({ nivel: 'medio', texto: 'CPL subiu ' + Math.round((trafego.cpl30 / trafego.cpl60 - 1) * 100) + '% nos últimos 30 dias' });
  if (financeiro.concentracaoTop1 > 0.35) alertas.push({ nivel: 'medio', texto: 'Um cliente concentra ' + Math.round(financeiro.concentracaoTop1 * 100) + '% da receita recorrente' });

  // ---------- nota de saúde (0 a 100) ----------
  const lim = function (x) { return Math.max(0, Math.min(1, x)); };
  const itens = [
    { rotulo: 'Funil andando', peso: 25, v: abertas.length ? lim(1 - paradas.length / abertas.length) : 1, det: paradas.length + ' de ' + abertas.length + ' parada(s)' },
    { rotulo: 'Tarefas em dia', peso: 20, v: tarefasAbertas.length ? lim(1 - atrasadas.length / tarefasAbertas.length) : 1, det: atrasadas.length + ' atrasada(s)' },
    { rotulo: 'Conversão (90 dias)', peso: 20, v: comercial.conversao90 == null ? 0.5 : lim(comercial.conversao90 / 35), det: comercial.conversao90 == null ? 'sem fechamentos' : comercial.conversao90 + '%' },
    { rotulo: 'Receita recorrente', peso: 20, v: financeiro.crescimento == null ? 0.5 : lim(1 + financeiro.crescimento / 20), det: financeiro.crescimento == null ? 'sem histórico' : (financeiro.crescimento >= 0 ? '+' : '') + financeiro.crescimento + '% em 3 meses' },
    { rotulo: 'Receita distribuída', peso: 15, v: lim((0.5 - financeiro.concentracaoTop1) / 0.25), det: 'maior cliente ' + Math.round(financeiro.concentracaoTop1 * 100) + '%' },
  ];
  const nota = Math.round(soma_(itens, function (i) { return i.peso * i.v; }));

  // ---------- atividade recente ----------
  const nomes = {};
  ler_('equipe').forEach(function (m) { nomes[m.email] = m.nome; });
  const opTitulo = {};
  ler_('oportunidades').forEach(function (o) { opTitulo[o.id] = o.titulo + (cliNome[o.clienteId] ? ' · ' + cliNome[o.clienteId] : ''); });
  const ctCliente = {};
  contratos.forEach(function (c) { ctCliente[c.id] = cliNome[c.clienteId] || c.titulo; });
  const feed = ler_('historico').filter(function (h) { return h.entidade !== 'config' && h.ts <= agoraIso; })
    .sort(function (a, b) { return a.ts < b.ts ? 1 : -1; }).slice(0, 30)
    .map(function (h) {
      let alvo = h.entidade === 'oportunidade' ? opTitulo[h.entidadeId] || '' : h.entidade === 'contrato' ? 'contrato de ' + (ctCliente[h.entidadeId] || '') : h.entidade === 'cliente' ? cliNome[h.entidadeId] || '' : nomes[h.entidadeId] || h.entidadeId;
      let texto = h.acao;
      if (h.acao === 'moveu') texto = 'moveu de ' + h.de + ' para ' + h.para;
      else if (h.acao === 'alterou') texto = 'alterou ' + h.campo;
      else if (h.para && h.acao !== 'criou') texto = h.acao + ': ' + h.para;
      return { ts: h.ts, email: h.email, quem: nomes[h.email] || h.email, texto: texto, alvo: alvo, entidade: h.entidade };
    });

  return {
    hoje: hoje, nome: eu.nome, empresa: cfg.empresa,
    saude: { nota: nota, itens: itens.map(function (i) { return { rotulo: i.rotulo, peso: i.peso, pontos: Math.round(i.peso * i.v), det: i.det }; }) },
    comercial: comercial, financeiro: financeiro, social: social, trafego: trafego, segmentos: segmentos, equipe: pessoas,
    rentabilidade: rentabilidade.slice(0, 8), alertas: alertas, feed: feed, online: presenca_(),
    totais: { clientes: clientes.filter(function (c) { return !c.arquivado; }).length, pessoas: equipe.length, tarefasAbertas: tarefasAbertas.length, horasMes: soma_(pessoas, function (p) { return p.horasMes; }) },
  };
}
