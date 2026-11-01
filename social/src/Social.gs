/**
 * Seok Social — social media dos clientes da Seok.
 * Os 6 clientes já nascem configurados, cada um com os blocos que importam para ele:
 *   Metapel       frequência, estoque, tendências de saúde, pedidos
 *   Outbox        frequência, eventos da agenda (treinamentos com PAX) com Story/Feed/LinkedIn, temas para o RH, pedidos
 *   Content Lab   fila de cases em ordem, frequência, tendências da creator economy
 *   Pietro        estoque, frequência, tendências de wellness, pedidos
 *   Seok Wellness igual ao Pietro
 *   Nap Griddle   frequência e pedidos (estratégia em construção)
 */
const BLOCOS = ['frequencia', 'estoque', 'eventos', 'temas', 'cases', 'tendencias', 'pedidos'];
const STATUS_POST = ['ideia', 'producao', 'aprovacao', 'agendado', 'publicado'];
const FORMATOS = ['Reels', 'Carrossel', 'Post', 'Stories', 'Vídeo', 'Artigo'];
const REDES = ['Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Facebook'];
const CLIENTES_INICIAIS_ = [
  { nome: 'Metapel', cor: '#2F6B8F', nicho: 'saúde, medicina e prevenção', frequencia: 3, blocos: ['frequencia', 'estoque', 'tendencias', 'pedidos'] },
  { nome: 'Outbox', cor: '#B5683A', nicho: 'RH, liderança e treinamento corporativo', frequencia: 3, blocos: ['frequencia', 'eventos', 'temas', 'pedidos'], entregasEvento: ['Story', 'Feed Instagram', 'LinkedIn'] },
  { nome: 'Content Lab', cor: '#6B4FA0', nicho: 'creator economy e marketing de criadores', frequencia: 3, blocos: ['cases', 'frequencia', 'tendencias'] },
  { nome: 'Pietro', cor: '#3F7D4E', nicho: 'wellness, bem-estar e longevidade', frequencia: 4, blocos: ['estoque', 'frequencia', 'tendencias', 'pedidos'] },
  { nome: 'Seok Wellness', cor: '#1F3D2B', nicho: 'wellness, bem-estar e longevidade', frequencia: 4, blocos: ['estoque', 'frequencia', 'tendencias', 'pedidos'] },
  { nome: 'Nap Griddle', cor: '#8A7B5C', nicho: '', frequencia: 0, blocos: ['frequencia', 'pedidos'], obs: 'Estratégia em construção.' },
];

function semearClientes_() {
  if (ler_('clientes').length) return;
  const agora = agora_();
  CLIENTES_INICIAIS_.forEach(function (c, i) {
    inserir_('clientes', {
      id: novoId_('cl'), nome: c.nome, cor: c.cor, nicho: c.nicho, objetivo: '', instagram: '', linkedin: '', frequencia: c.frequencia, antecedencia: 7,
      blocos: c.blocos, agendaId: '', agendaFiltro: '', entregasEvento: c.entregasEvento || ['Story', 'Feed Instagram', 'LinkedIn'], status: 'ativo', ordem: i + 1,
      obs: c.obs || '', atualizadoEm: agora,
    });
  });
}

// ---------- página ----------
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').setTitle('Seok Social')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function carregar() {
  const eu = eu_();
  if (eu.papel === 'sem_acesso') return { semAcesso: true, email: eu.email };
  if (!ler_('clientes').length) comTrava_(semearClientes_);
  const p = PropertiesService.getScriptProperties();
  return {
    eu: eu, versao: VERSAO, hoje: hoje_(),
    clientes: ler_('clientes').sort(function (a, b) { return a.ordem - b.ordem; }),
    posts: ler_('posts'), temas: ler_('temas'), eventos: ler_('eventos'), pedidos: ler_('pedidos'), reports: ler_('reports'),
    equipe: eu.papel === 'admin' ? ler_('equipe') : [],
    ajustes: { linkAberto: config_('linkAberto') === '1', temIA: !!p.getProperty('ANTHROPIC_API_KEY') },
    listas: { status: STATUS_POST, formatos: FORMATOS, redes: REDES, blocos: BLOCOS },
  };
}

// ---------- clientes ----------
function salvarCliente(d) {
  exigir_('editor');
  return comTrava_(function () {
    d = d || {};
    const tem = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
    const p = { atualizadoEm: agora_() };
    if (tem('nome')) { p.nome = texto_(d.nome, 80); if (!p.nome) throw new Error('Informe o nome do cliente.'); }
    if (tem('cor')) p.cor = /^#[0-9a-f]{6}$/i.test(texto_(d.cor, 7)) ? texto_(d.cor, 7) : '#1F3D2B';
    ['nicho', 'objetivo', 'agendaFiltro', 'obs'].forEach(function (k) { if (tem(k)) p[k] = texto_(d[k], k === 'obs' ? 1000 : 200); });
    if (tem('agendaId')) p.agendaId = texto_(d.agendaId, 200);
    if (tem('instagram')) p.instagram = texto_(d.instagram, 60).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
    if (tem('linkedin')) p.linkedin = url_(d.linkedin);
    if (tem('frequencia')) p.frequencia = Math.round(numero_(d.frequencia, 0, 30) * 2) / 2;
    if (tem('antecedencia')) p.antecedencia = Math.round(numero_(d.antecedencia, 0, 60));
    if (tem('blocos')) p.blocos = (Array.isArray(d.blocos) ? d.blocos : []).filter(function (b, i, a) { return BLOCOS.indexOf(b) >= 0 && a.indexOf(b) === i; });
    if (tem('entregasEvento')) p.entregasEvento = lista_(d.entregasEvento, 6);
    if (tem('status')) p.status = umDe_(d.status, ['ativo', 'pausa'], 'ativo');
    if (!d.id) {
      if (!p.nome) throw new Error('Informe o nome do cliente.');
      const ordens = ler_('clientes').map(function (c) { return c.ordem; });
      return inserir_('clientes', Object.assign({ id: novoId_('cl'), cor: '#1F3D2B', frequencia: 3, antecedencia: 7, blocos: ['frequencia', 'estoque', 'pedidos'],
        entregasEvento: ['Story', 'Feed Instagram', 'LinkedIn'], status: 'ativo', ordem: (ordens.length ? Math.max.apply(null, ordens) : 0) + 1 }, p));
    }
    return atualizar_('clientes', d.id, p);
  });
}

// ---------- posts ----------
function salvarPost(d) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    d = d || {};
    const p = {
      clienteId: texto_(d.clienteId, 40), titulo: texto_(d.titulo, 160), formato: umDe_(d.formato, FORMATOS, 'Post'), rede: umDe_(d.rede, REDES, 'Instagram'),
      status: umDe_(d.status, STATUS_POST, 'ideia'), data: dataIso_(d.data), hora: /^\d{2}:\d{2}$/.test(texto_(d.hora, 5)) ? texto_(d.hora, 5) : '',
      linkDrive: url_(d.linkDrive), linkPost: url_(d.linkPost), porque: texto_(d.porque, 600), legenda: texto_(d.legenda, 3000), atualizadoEm: agora_(),
    };
    if (!p.titulo) throw new Error('Dê um título para o post.');
    if (!achar_('clientes', p.clienteId)) throw new Error('Escolha o cliente.');
    if ((p.status === 'agendado' || p.status === 'publicado') && !p.data) throw new Error('Informe a data de publicação.');
    if (texto_(d.linkDrive, 1000) && !p.linkDrive) throw new Error('O link do Drive precisa começar com https://');
    if (texto_(d.linkPost, 1000) && !p.linkPost) throw new Error('O link da publicação precisa começar com https://');
    if (!d.id) return inserir_('posts', Object.assign(p, { id: novoId_('po'), eventoId: texto_(d.eventoId, 120), temaId: texto_(d.temaId, 40), pedidoId: texto_(d.pedidoId, 40), criadoPor: eu.email, criadoEm: p.atualizadoEm }));
    if (!achar_('posts', d.id)) throw new Error('Post não encontrado. Recarregue a página.');
    return atualizar_('posts', d.id, p);
  });
}

function moverPost(id, status, data) {
  exigir_('editor');
  return comTrava_(function () {
    const p = achar_('posts', texto_(id, 40));
    if (!p) throw new Error('Post não encontrado. Recarregue a página.');
    const patch = { atualizadoEm: agora_() };
    if (status) patch.status = umDe_(status, STATUS_POST, p.status);
    if (data !== undefined && data !== null) patch.data = dataIso_(data);
    const s = patch.status || p.status, dia = 'data' in patch ? patch.data : p.data;
    if ((s === 'agendado' || s === 'publicado') && !dia) throw new Error('Defina a data antes de agendar.');
    return atualizar_('posts', p.id, patch);
  });
}

function removerPost(id) {
  exigir_('editor');
  return comTrava_(function () {
    const p = achar_('posts', id);
    if (!p) return true;
    // Solta o vínculo de quem apontava para o post (tema, pedido, peça de evento).
    ler_('temas').filter(function (t) { return t.postId === id; }).forEach(function (t) { atualizar_('temas', t.id, { postId: '', status: 'aberto' }); });
    ler_('pedidos').filter(function (x) { return x.postId === id; }).forEach(function (x) { atualizar_('pedidos', x.id, { postId: '', status: 'aberto' }); });
    if (p.eventoId) {
      const e = achar_('eventos', p.eventoId);
      if (e) { const en = Object.assign({}, e.entregas || {}); Object.keys(en).forEach(function (k) { if (en[k] === id) delete en[k]; }); atualizar_('eventos', e.id, { entregas: en }); }
    }
    return remover_('posts', id);
  });
}

function novoPostDe_(eu, clienteId, titulo, extra) {
  const agora = agora_();
  return inserir_('posts', Object.assign({ id: novoId_('po'), clienteId: clienteId, titulo: titulo, formato: 'Post', rede: 'Instagram', status: 'ideia', data: '', hora: '',
    linkDrive: '', linkPost: '', porque: '', legenda: '', eventoId: '', temaId: '', pedidoId: '', criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora }, extra));
}

// ---------- temas, cases e tendências ----------
function salvarTema(d) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    d = d || {};
    const t = { clienteId: texto_(d.clienteId, 40), tipo: umDe_(d.tipo, ['tema', 'case', 'tendencia'], 'tema'), titulo: texto_(d.titulo, 200),
      descricao: texto_(d.descricao, 2000), fonte: texto_(d.fonte, 120), link: url_(d.link) };
    if (!achar_('clientes', t.clienteId)) throw new Error('Escolha o cliente.');
    if (!t.titulo) throw new Error('Dê um título.');
    if (d.status) t.status = umDe_(d.status, ['aberto', 'usado', 'descartado'], 'aberto');
    if (!d.id) {
      const ordens = ler_('temas').filter(function (x) { return x.clienteId === t.clienteId && x.tipo === t.tipo; }).map(function (x) { return x.ordem; });
      return inserir_('temas', Object.assign(t, { id: novoId_('tm'), ordem: (ordens.length ? Math.max.apply(null, ordens) : 0) + 1, status: 'aberto', postId: '', criadoPor: eu.email, criadoEm: agora_() }));
    }
    return atualizar_('temas', d.id, t);
  });
}

function ordenarTemas(ids) {
  exigir_('editor');
  return comTrava_(function () {
    return (Array.isArray(ids) ? ids : []).slice(0, 200).map(function (id, i) { return achar_('temas', id) ? atualizar_('temas', id, { ordem: i + 1 }) : null; }).filter(Boolean);
  });
}

function temaParaPauta(id, data) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    const t = achar_('temas', texto_(id, 40));
    if (!t) throw new Error('Item não encontrado.');
    if (t.postId && achar_('posts', t.postId)) throw new Error('Este item já está na pauta.');
    const post = novoPostDe_(eu, t.clienteId, t.titulo, { formato: t.tipo === 'case' ? 'Carrossel' : 'Post', data: dataIso_(data), temaId: t.id,
      porque: t.tipo === 'case' ? 'Case da fila do cliente.' : t.tipo === 'tendencia' ? 'Tendência do nicho em alta.' : 'Tema mapeado com o cliente.' });
    return { tema: atualizar_('temas', t.id, { status: 'usado', postId: post.id }), post: post };
  });
}

function removerTema(id) { exigir_('editor'); return comTrava_(function () { return remover_('temas', id); }); }

// ---------- pedidos do cliente ----------
function salvarPedido(d) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    d = d || {};
    const p = { clienteId: texto_(d.clienteId, 40), titulo: texto_(d.titulo, 200), descricao: texto_(d.descricao, 2000), prazo: dataIso_(d.prazo),
      prioridade: umDe_(d.prioridade, ['alta', 'normal'], 'normal') };
    if (!achar_('clientes', p.clienteId)) throw new Error('Escolha o cliente.');
    if (!p.titulo) throw new Error('Descreva o pedido.');
    if (d.status) p.status = umDe_(d.status, ['aberto', 'feito'], 'aberto');
    if (!d.id) return inserir_('pedidos', Object.assign(p, { id: novoId_('pe'), status: 'aberto', postId: '', criadoPor: eu.email, criadoEm: agora_() }));
    return atualizar_('pedidos', d.id, p);
  });
}

function pedidoParaPauta(id, data) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    const p = achar_('pedidos', texto_(id, 40));
    if (!p) throw new Error('Pedido não encontrado.');
    if (p.postId && achar_('posts', p.postId)) throw new Error('Este pedido já está na pauta.');
    const post = novoPostDe_(eu, p.clienteId, p.titulo, { data: dataIso_(data), pedidoId: p.id, porque: 'Pedido do cliente.' + (p.descricao ? ' ' + p.descricao : '') });
    return { pedido: atualizar_('pedidos', p.id, { status: 'feito', postId: post.id }), post: post };
  });
}

function removerPedido(id) { exigir_('editor'); return comTrava_(function () { return remover_('pedidos', id); }); }

// ---------- eventos do Google Agenda (treinamentos com PAX) ----------
function paxDe_(t) {
  const s = String(t || ''), m = /(\d{1,5})\s*(?:pax|participantes)\b/i.exec(s) || /\bpax\s*[:=-]?\s*(\d{1,5})/i.exec(s);
  return m ? Number(m[1]) : 0;
}

function sincronizarAgenda(clienteId) {
  exigir_('editor');
  const c = achar_('clientes', texto_(clienteId, 40));
  if (!c) throw new Error('Cliente não encontrado.');
  const cal = c.agendaId ? CalendarApp.getCalendarById(c.agendaId) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('Agenda não encontrada. Confira o ID da agenda nos ajustes do cliente.');
  const filtro = normalizar_(c.agendaFiltro);
  const lidos = cal.getEvents(new Date(Date.now() - 60 * 864e5), new Date(Date.now() + 90 * 864e5)).map(function (ev) {
    const titulo = String(ev.getTitle() || ''), desc = String(ev.getDescription() || '');
    return { id: String(ev.getId()) + '@' + ev.getStartTime().toISOString().slice(0, 10), titulo: titulo, pax: paxDe_(titulo + ' ' + desc), busca: normalizar_(titulo + ' ' + desc),
      inicio: ev.getStartTime().toISOString(), fim: ev.getEndTime().toISOString(), local: String(ev.getLocation() || '') };
  }).filter(function (e) { return e.pax > 0 && (!filtro || e.busca.indexOf(filtro) >= 0); });
  return comTrava_(function () {
    const agora = agora_();
    lidos.forEach(function (e) {
      const dados = { clienteId: c.id, titulo: texto_(e.titulo, 200), inicio: e.inicio, fim: e.fim, pax: e.pax, local: texto_(e.local, 200), sincronizadoEm: agora };
      if (achar_('eventos', e.id)) atualizar_('eventos', e.id, dados); else inserir_('eventos', Object.assign({ id: e.id, entregas: {} }, dados));
    });
    return ler_('eventos').filter(function (e) { return e.clienteId === c.id; });
  });
}

function criarPeca(eventoId, tipo) {
  const eu = exigir_('editor');
  return comTrava_(function () {
    const e = achar_('eventos', texto_(eventoId, 120));
    if (!e) throw new Error('Evento não encontrado. Sincronize a agenda.');
    const t = texto_(tipo, 40), en = Object.assign({}, e.entregas || {});
    if (!t) throw new Error('Escolha a peça.');
    if (en[t] && achar_('posts', en[t])) throw new Error('Esta peça já está na pauta.');
    const li = /linkedin/i.test(t), st = /stor/i.test(t);
    const post = novoPostDe_(eu, e.clienteId, e.titulo + ' · ' + t, { formato: st ? 'Stories' : li ? 'Post' : 'Carrossel', rede: li ? 'LinkedIn' : 'Instagram',
      data: String(e.inicio).slice(0, 10), eventoId: e.id, porque: 'Registro do treinamento ' + e.titulo + ' (' + e.pax + ' participantes).' });
    en[t] = post.id;
    return { evento: atualizar_('eventos', e.id, { entregas: en }), post: post };
  });
}

// ---------- resultados (Reportei) ----------
const CAMPOS_REPORT_ = ['seguidores', 'alcance', 'alcanceOrganico', 'alcancePago', 'visualizacoes', 'interacoes', 'visitasPerfil', 'liSeguidores', 'liImpressoes', 'liAlcance', 'liPosts'];

function salvarReport(d) {
  const eu = exigir_('editor');
  d = d || {};
  let arquivo = '';
  if (d.pdf && d.pdf.base64) {
    try {
      const pastas = DriveApp.getFoldersByName('Seok Social · Relatórios'), pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder('Seok Social · Relatórios');
      arquivo = pasta.createFile(Utilities.newBlob(Utilities.base64Decode(String(d.pdf.base64)), 'application/pdf', texto_(d.pdf.nome, 120) || 'relatorio.pdf')).getUrl();
    } catch (e) { arquivo = ''; }
  }
  return comTrava_(function () {
    const r = { clienteId: texto_(d.clienteId, 40), mes: /^\d{4}-\d{2}$/.test(texto_(d.mes, 7)) ? texto_(d.mes, 7) : '', periodoIni: dataIso_(d.periodoIni), periodoFim: dataIso_(d.periodoFim),
      resumo: texto_(d.resumo, 3000) };
    if (!achar_('clientes', r.clienteId)) throw new Error('Escolha o cliente.');
    if (!r.mes) throw new Error('Informe o mês do relatório.');
    CAMPOS_REPORT_.forEach(function (k) { r[k] = numero_(d[k], 0); });
    if (d.detalhe && typeof d.detalhe === 'object') r.detalhe = limparDetalhe_(d.detalhe);
    if (arquivo) r.arquivoUrl = arquivo;
    // Um relatório por cliente por mês: importar de novo atualiza o mesmo.
    const igual = ler_('reports').filter(function (x) { return x.clienteId === r.clienteId && x.mes === r.mes; })[0];
    if (igual) return atualizar_('reports', igual.id, r);
    return inserir_('reports', Object.assign(r, { id: novoId_('rp'), criadoPor: eu.email, criadoEm: agora_() }));
  });
}

function limparDetalhe_(d) {
  const n = function (o, k) { return numero_(o && o[k], 0); };
  const post = function (p) {
    return { legenda: texto_(p && p.legenda, 160), tipo: texto_(p && p.tipo, 20), data: dataIso_(p && p.data), alcance: n(p, 'alcance'), visualizacoes: n(p, 'visualizacoes'),
      impressoes: n(p, 'impressoes'), interacoes: n(p, 'interacoes'), taxa: n(p, 'taxa'), curtidas: n(p, 'curtidas'), comentarios: n(p, 'comentarios'), salvos: n(p, 'salvos'),
      compartilhamentos: n(p, 'compartilhamentos'), cliques: n(p, 'cliques') };
  };
  const l = function (x, max, f) { return (Array.isArray(x) ? x : []).slice(0, max).map(f); };
  return {
    posts: l(d.posts, 40, post), reels: l(d.reels, 40, post), linkedin: l(d.linkedin, 30, post),
    stories: l(d.stories, 40, function (s) { return { alcance: n(s, 'alcance'), visualizacoes: n(s, 'visualizacoes'), interacoes: n(s, 'interacoes'), retencao: n(s, 'retencao'), data: dataIso_(s && s.data) }; }),
    cidades: l(d.cidades, 8, function (c) { return { cidade: texto_(c && c.cidade, 80), seguidores: n(c, 'seguidores') }; }),
    analise: l(d.analise, 4, function (a) { return { texto: texto_(a && a.texto, 2500), acoes: l(a && a.acoes, 8, function (x) { return texto_(x, 600); }) }; }),
  };
}

function removerReport(id) { exigir_('editor'); return comTrava_(function () { return remover_('reports', id); }); }

// ---------- tendências ----------
// Com a chave da Anthropic, o Claude pesquisa na web (redes, blogs, YouTube, notícias); sem ela, Google Notícias.
function pesquisarTendencias(clienteId) {
  const eu = exigir_('editor');
  const c = achar_('clientes', texto_(clienteId, 40));
  if (!c) throw new Error('Cliente não encontrado.');
  if (!c.nicho) throw new Error('Defina o nicho do cliente nos ajustes.');
  const chave = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  const achados = chave ? tendenciasIA_(c, chave) : tendenciasNoticias_(c.nicho);
  return comTrava_(function () {
    const ja = {};
    ler_('temas').filter(function (t) { return t.clienteId === c.id && t.tipo === 'tendencia'; }).forEach(function (t) { ja[normalizar_(t.titulo)] = 1; });
    let ordem = ler_('temas').filter(function (t) { return t.clienteId === c.id && t.tipo === 'tendencia'; }).reduce(function (m, t) { return Math.max(m, t.ordem); }, 0);
    const novos = achados.filter(function (t) { return texto_(t.titulo, 200) && !ja[normalizar_(t.titulo)]; }).slice(0, 8).map(function (t) {
      ja[normalizar_(t.titulo)] = 1;
      return inserir_('temas', { id: novoId_('tm'), clienteId: c.id, tipo: 'tendencia', titulo: texto_(t.titulo, 200), descricao: texto_(t.descricao, 2000),
        fonte: texto_(t.fonte, 120) || (chave ? 'Pesquisa com IA' : 'Google Notícias'), link: url_(t.link), ordem: ++ordem, status: 'aberto', postId: '', criadoPor: eu.email, criadoEm: agora_() });
    });
    return { novos: novos, fonte: chave ? 'ia' : 'noticias' };
  });
}

function tendenciasIA_(c, chave) {
  let msgs = [{ role: 'user', content: 'Você ajuda uma agência de social media a planejar posts para o cliente "' + c.nome + '", nicho: ' + c.nicho + '.\n' +
    'Pesquise na web o que está em alta AGORA nesse nicho no Brasil (últimas 2 a 4 semanas): Instagram, TikTok, LinkedIn, blogs e portais do setor, YouTube e notícias. ' +
    'Escolha de 5 a 8 assuntos com potencial real de post. Responda só com JSON: {"tendencias":[{"titulo":"...","porque":"por que está em alta, com fato ou dado","ideia":"ideia de post (formato + gancho)","fonte":"site ou rede","link":"https://..."}]}' }];
  for (let i = 0; i < 3; i++) {
    const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      payload: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 16000, fallbacks: 'default', output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6, user_location: { type: 'approximate', country: 'BR' } }], messages: msgs }),
    });
    let j;
    try { j = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('Resposta inesperada da IA.'); }
    if (resp.getResponseCode() >= 400) throw new Error('A IA recusou a pesquisa: ' + ((j.error && j.error.message) || resp.getResponseCode()));
    if (j.stop_reason === 'refusal') throw new Error('A IA não quis pesquisar esse tema. Ajuste o nicho.');
    if (j.stop_reason === 'pause_turn') { msgs = msgs.concat([{ role: 'assistant', content: j.content }]); continue; }
    const t = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('A IA não devolveu a lista. Tente de novo.');
    return (JSON.parse(t.slice(a, b + 1)).tendencias || []).map(function (x) {
      return { titulo: x.titulo, descricao: [x.porque, x.ideia ? 'Ideia: ' + x.ideia : ''].filter(Boolean).join(' '), fonte: x.fonte, link: x.link };
    });
  }
  throw new Error('A pesquisa demorou demais. Tente de novo.');
}

function tendenciasNoticias_(nicho) {
  const resp = UrlFetchApp.fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(nicho + ' when:14d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419', { muteHttpExceptions: true });
  if (resp.getResponseCode() >= 400) throw new Error('O Google Notícias não respondeu.');
  const xml = resp.getContentText(), out = [], re = /<item>([\s\S]*?)<\/item>/g;
  const tag = function (b, n) { const x = new RegExp('<' + n + '[^>]*>([\\s\\S]*?)<\\/' + n + '>').exec(b); return x ? x[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''; };
  let m;
  while ((m = re.exec(xml)) && out.length < 8) {
    const fonte = tag(m[1], 'source'), titulo = tag(m[1], 'title');
    out.push({ titulo: fonte && titulo.slice(-fonte.length - 3) === ' - ' + fonte ? titulo.slice(0, -fonte.length - 3) : titulo, descricao: 'Em alta nas notícias.', fonte: fonte || 'Google Notícias', link: tag(m[1], 'link') });
  }
  return out;
}
