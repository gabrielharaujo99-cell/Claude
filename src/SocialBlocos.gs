/**
 * Quadro de cada cliente na social: blocos que a agência liga por cliente (frequência, estoque de posts,
 * eventos da agenda, temas mapeados, fila de cases, tendências, pedidos), os temas e cases em si e os
 * eventos do Google Agenda (treinamentos com número de PAX) com as peças que cada evento rende.
 * Só quem tem a área "social" vê e mexe.
 */
const BLOCOS = ['frequencia', 'estoque', 'eventos', 'temas', 'cases', 'tendencias', 'pedidos'];
const BLOCOS_PADRAO = ['frequencia', 'estoque', 'pedidos'];
const ENTREGAS_PADRAO = ['Story', 'Feed Instagram', 'LinkedIn'];
const TIPOS_TEMA = ['tema', 'case', 'tendencia'];
const STATUS_TEMA = ['mapeado', 'usado', 'descartado'];

function limparBlocos_(l) { return (Array.isArray(l) ? l : []).filter(function (b, i, a) { return BLOCOS.indexOf(b) >= 0 && a.indexOf(b) === i; }); }

// ---------- temas, cases e tendências ----------
function salvarTema(d) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const t = {
      clienteId: texto_(d.clienteId, 40), tipo: umDe_(d.tipo, TIPOS_TEMA, 'tema'), titulo: texto_(d.titulo, 200), descricao: texto_(d.descricao, 2000),
      fonte: texto_(d.fonte, 120), link: url_(d.link), atualizadoEm: agora_(),
    };
    if (!t.clienteId || !achar_('clientes', t.clienteId)) throw new Error('Escolha o cliente.');
    if (!t.titulo) throw new Error('Dê um título.');
    if (!d.id) {
      // Entra no fim da fila do cliente (a ordem importa nos cases).
      const ordens = ler_('temas').filter(function (x) { return x.clienteId === t.clienteId && x.tipo === t.tipo; }).map(function (x) { return x.ordem; });
      return inserir_('temas', Object.assign(t, { id: novoId_('tm'), ordem: ordens.length ? Math.max.apply(null, ordens) + 1 : 1, status: 'mapeado', postId: '', criadoPor: eu.email, criadoEm: t.atualizadoEm }));
    }
    if (!achar_('temas', d.id)) throw new Error('Item não encontrado. Recarregue a página.');
    if (d.status) t.status = umDe_(d.status, STATUS_TEMA, 'mapeado');
    return atualizar_('temas', d.id, t).depois;
  });
}

// Reordena a fila: recebe os ids na ordem nova.
function ordenarTemas(ids) {
  exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    return (Array.isArray(ids) ? ids : []).slice(0, 200).map(function (id, i) {
      return achar_('temas', texto_(id, 40)) ? atualizar_('temas', texto_(id, 40), { ordem: i + 1, atualizadoEm: agora_() }).depois : null;
    }).filter(Boolean);
  });
}

// Leva o tema/case para a pauta do calendário (vira um conteúdo ligado a ele).
function usarTema(id, data) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const t = achar_('temas', texto_(id, 40));
    if (!t) throw new Error('Item não encontrado. Recarregue a página.');
    if (t.status === 'usado' && t.postId && achar_('posts', t.postId)) throw new Error('Este item já está no calendário.');
    const agora = agora_();
    const post = inserir_('posts', {
      id: novoId_('po'), clienteId: t.clienteId, titulo: t.titulo, formato: t.tipo === 'case' ? 'Carrossel' : 'Post', rede: 'Instagram', status: 'pauta',
      data: dataIso_(data), hora: '', responsavel: eu.email, legenda: '', link: '', obs: t.descricao, pilar: '', linkPost: '',
      porque: t.tipo === 'case' ? 'Case da fila do cliente.' : t.tipo === 'tendencia' ? 'Tendência do nicho: ' + t.titulo : 'Tema mapeado com o cliente.',
      eventoId: '', temaId: t.id, criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
    });
    const tema = atualizar_('temas', t.id, { status: 'usado', postId: post.id, atualizadoEm: agora }).depois;
    return { tema: tema, post: post };
  });
}

function removerTema(id) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const t = achar_('temas', id);
    if (!t) return true;
    if (t.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar.');
    return remover_('temas', id);
  });
}

// ---------- eventos do Google Agenda ----------
// Um evento conta quando traz o número de participantes: "25 PAX", "PAX: 25", "25 participantes".
function paxDe_(texto) {
  const t = String(texto || '');
  const m = /(\d{1,5})\s*(?:pax|participantes)\b/i.exec(t) || /\bpax\s*[:=-]?\s*(\d{1,5})/i.exec(t);
  return m ? Number(m[1]) : 0;
}

function agendaDe_(m) {
  const id = texto_(m.agendaId, 200);
  const cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('Agenda não encontrada: ' + id + '. Confira o ID no quadro do cliente (e se a conta que publicou o CRM tem acesso).');
  return cal;
}

// Lê os eventos com PAX de 60 dias para trás a 90 para frente e guarda (as peças já ligadas continuam).
function sincronizarAgenda(clienteId) {
  exigirArea_('social', 'colaborador');
  const m = achar_('marcas', texto_(clienteId, 40));
  if (!m) throw new Error('Crie o perfil de marca do cliente antes de ligar a agenda.');
  const cal = agendaDe_(m);
  const ini = new Date(Date.now() - 60 * 864e5), fim = new Date(Date.now() + 90 * 864e5);
  const filtro = normalizar_(m.agendaFiltro);
  const lidos = cal.getEvents(ini, fim).map(function (ev) {
    const titulo = String(ev.getTitle() || ''), desc = String(ev.getDescription() || '');
    return { id: String(ev.getId()) + '@' + ev.getStartTime().toISOString().slice(0, 10), titulo: titulo, desc: desc, pax: paxDe_(titulo + ' ' + desc),
      inicio: ev.getStartTime().toISOString(), fim: ev.getEndTime().toISOString(), local: String(ev.getLocation() || '') };
  }).filter(function (e) { return e.pax > 0 && (!filtro || normalizar_(e.titulo + ' ' + e.desc).indexOf(filtro) >= 0); });
  return comTrava_(function () {
    const agora = agora_();
    lidos.forEach(function (e) {
      const dados = { clienteId: m.clienteId, titulo: texto_(e.titulo, 200), inicio: e.inicio, fim: e.fim, pax: e.pax, local: texto_(e.local, 200), descricao: texto_(e.desc, 1500), sincronizadoEm: agora };
      if (achar_('eventos', e.id)) atualizar_('eventos', e.id, dados);
      else inserir_('eventos', Object.assign({ id: e.id, entregas: {} }, dados));
    });
    return ler_('eventos').filter(function (e) { return e.clienteId === m.clienteId; });
  });
}

// Cria o conteúdo de uma peça do evento (Story, Feed Instagram, LinkedIn…) na pauta, ligado ao evento.
function criarEntregaEvento(eventoId, tipo) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const e = achar_('eventos', texto_(eventoId, 120));
    if (!e) throw new Error('Evento não encontrado. Sincronize a agenda.');
    const t = texto_(tipo, 40);
    if (!t) throw new Error('Escolha a peça.');
    const entregas = Object.assign({}, e.entregas || {});
    if (entregas[t] && achar_('posts', entregas[t])) throw new Error('Esta peça já está na pauta.');
    const linkedin = /linkedin/i.test(t), story = /stor/i.test(t);
    const dia = String(e.inicio).slice(0, 10), agora = agora_();
    const post = inserir_('posts', {
      id: novoId_('po'), clienteId: e.clienteId, titulo: e.titulo + ' · ' + t, formato: story ? 'Stories' : linkedin ? 'Post' : 'Carrossel', rede: linkedin ? 'LinkedIn' : 'Instagram',
      status: 'pauta', data: dia, hora: '', responsavel: eu.email, legenda: '', link: '', obs: e.pax + ' PAX' + (e.local ? ' · ' + e.local : ''), pilar: '',
      linkPost: '', porque: 'Registro do evento ' + e.titulo + ' (' + e.pax + ' participantes).', eventoId: e.id, temaId: '', criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
    });
    entregas[t] = post.id;
    const evento = atualizar_('eventos', e.id, { entregas: entregas }).depois;
    return { evento: evento, post: post };
  });
}

// ---------- clientes da Seok já configurados (um clique) ----------
// Cria (ou completa) os clientes de social media com os blocos e nichos combinados. Não apaga nada:
// cliente que já existe (mesmo nome) é reaproveitado e só recebe o que ainda estiver vazio.
const CLIENTES_SEOK_ = [
  { nome: 'Metapel', segmento: 'Saúde', nicho: 'saúde, medicina e prevenção', blocos: ['frequencia', 'estoque', 'tendencias', 'pedidos'], frequencia: 3 },
  { nome: 'Outbox', segmento: 'Treinamento corporativo', nicho: 'RH, liderança e treinamento corporativo', blocos: ['frequencia', 'eventos', 'temas', 'pedidos'], frequencia: 3, entregasEvento: ['Story', 'Feed Instagram', 'LinkedIn'] },
  { nome: 'Content Lab', segmento: 'Creator economy', nicho: 'creator economy e marketing de criadores', blocos: ['cases', 'frequencia', 'tendencias', 'temas'], frequencia: 3 },
  { nome: 'Pietro', segmento: 'Wellness', nicho: 'wellness, bem-estar e longevidade', blocos: ['estoque', 'frequencia', 'tendencias', 'pedidos'], frequencia: 4 },
  { nome: 'Seok Wellness', segmento: 'Wellness', nicho: 'wellness, bem-estar e longevidade', blocos: ['estoque', 'frequencia', 'tendencias', 'pedidos'], frequencia: 4 },
  { nome: 'Nap Griddle', segmento: '', nicho: '', blocos: ['frequencia', 'pedidos'], frequencia: 0 },
];

function prepararClientesSeok() {
  const eu = exigirArea_('social', 'gestor');
  return comTrava_(function () {
    const agora = agora_(), feitos = [];
    CLIENTES_SEOK_.forEach(function (x) {
      let c = ler_('clientes').filter(function (k) { return normalizar_(k.nome) === normalizar_(x.nome); })[0];
      if (!c) c = inserir_('clientes', { id: novoId_('cl'), nome: x.nome, segmento: x.segmento, criadoEm: agora, atualizadoEm: agora, arquivado: false });
      const m = achar_('marcas', c.id);
      const base = { status: 'ativo', blocos: x.blocos, nicho: x.nicho, frequencia: x.frequencia, entregasEvento: x.entregasEvento || ENTREGAS_PADRAO.slice(), antecedencia: 7, atualizadoEm: agora, atualizadoPor: eu.email };
      if (!m) {
        inserir_('marcas', Object.assign({ clienteId: c.id, fase: FASES_ESTRATEGIA[0], pilares: [], formatosMeta: {}, inicio: hoje_() }, base));
        registrarJornada_(eu, c.id, 'marco', 'Início da gestão de social media', 'Quadro configurado com os blocos combinados.', '', '', '', '');
      } else {
        const patch = {};
        if (!m.blocos || !m.blocos.length) patch.blocos = x.blocos;
        if (!m.nicho && x.nicho) patch.nicho = x.nicho;
        if (!m.frequencia && x.frequencia) patch.frequencia = x.frequencia;
        if (!m.entregasEvento || !m.entregasEvento.length) patch.entregasEvento = base.entregasEvento;
        if (Object.keys(patch).length) atualizar_('marcas', c.id, patch);
      }
      feitos.push(c.nome);
    });
    return feitos;
  });
}
