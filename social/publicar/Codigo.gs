// Seok Social: gerado por dev/empacotar.js a partir de src/. Edite em src/ e gere de novo.

// ===== Base.gs =====
/**
 * Seok Social — base do servidor: utilitários, a planilha como banco de dados e o acesso da equipe.
 * Cada tabela é uma aba (cabeçalho na linha 1, colunas achadas pelo nome). Abas e colunas que faltam são criadas sozinhas.
 * Funções terminadas em _ são internas: a tela não consegue chamá-las.
 */
const VERSAO = '1.0.0';

function agora_() { return new Date().toISOString(); }
function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function novoId_(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function texto_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
function numero_(v, min, max) {
  let n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(',', '.'));
  if (!isFinite(n)) n = 0;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}
function dataIso_(v) { const s = texto_(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function email_(v) { const s = texto_(v, 200).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''; }
function url_(v) { const s = texto_(v, 1000); return /^https?:\/\/\S+$/i.test(s) ? s : ''; }
function umDe_(v, lista, padrao) { return lista.indexOf(v) >= 0 ? v : padrao; }
function normalizar_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function nomeDoEmail_(e) { return String(e || '').split('@')[0].split(/[._-]+/).filter(Boolean).map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' '); }
function lista_(v, max) {
  const vistos = {};
  return (Array.isArray(v) ? v : []).map(function (x) { return texto_(x, 60); })
    .filter(function (x) { const k = x.toLowerCase(); if (!x || vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, max || 20);
}

// ---------- banco ----------
const SCHEMA = {
  equipe: { colunas: ['email', 'nome', 'papel', 'ativo', 'criadoEm'], chave: 'email', bool: ['ativo'] },
  config: { colunas: ['chave', 'valor'], chave: 'chave' },
  clientes: {
    colunas: ['id', 'nome', 'cor', 'nicho', 'objetivo', 'instagram', 'linkedin', 'frequencia', 'antecedencia', 'blocos', 'agendaId', 'agendaFiltro',
      'entregasEvento', 'status', 'ordem', 'obs', 'atualizadoEm'],
    num: ['frequencia', 'antecedencia', 'ordem'], json: ['blocos', 'entregasEvento'],
  },
  posts: {
    colunas: ['id', 'clienteId', 'titulo', 'formato', 'rede', 'status', 'data', 'hora', 'linkDrive', 'linkPost', 'porque', 'legenda',
      'eventoId', 'temaId', 'pedidoId', 'criadoPor', 'criadoEm', 'atualizadoEm'],
  },
  temas: { colunas: ['id', 'clienteId', 'tipo', 'titulo', 'descricao', 'fonte', 'link', 'ordem', 'status', 'postId', 'criadoPor', 'criadoEm'], num: ['ordem'] },
  eventos: { colunas: ['id', 'clienteId', 'titulo', 'inicio', 'fim', 'pax', 'local', 'entregas', 'sincronizadoEm'], num: ['pax'], json: ['entregas'] },
  pedidos: { colunas: ['id', 'clienteId', 'titulo', 'descricao', 'prazo', 'prioridade', 'status', 'postId', 'criadoPor', 'criadoEm'] },
  reports: {
    colunas: ['id', 'clienteId', 'mes', 'periodoIni', 'periodoFim', 'seguidores', 'alcance', 'alcanceOrganico', 'alcancePago', 'visualizacoes',
      'interacoes', 'visitasPerfil', 'liSeguidores', 'liImpressoes', 'liAlcance', 'liPosts', 'resumo', 'detalhe', 'arquivoUrl', 'criadoPor', 'criadoEm'],
    num: ['seguidores', 'alcance', 'alcanceOrganico', 'alcancePago', 'visualizacoes', 'interacoes', 'visitasPerfil', 'liSeguidores', 'liImpressoes', 'liAlcance', 'liPosts'],
    json: ['detalhe'],
  },
};

let MEMO_ = {};

function esquema_(nome) { const s = SCHEMA[nome]; if (!s) throw new Error('Tabela desconhecida: ' + nome); return s; }

function aba_(nome) {
  const s = esquema_(nome), ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, s.colunas.length).setValues([s.colunas]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  const cab = cabecalho_(sh), faltam = s.colunas.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltam.length) sh.getRange(1, cab.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
  return sh;
}

function cabecalho_(sh) { const n = sh.getLastColumn(); return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(function (v) { return String(v).trim(); }) : []; }

function tabela_(nome) {
  if (!MEMO_[nome]) {
    const sh = aba_(nome), cab = cabecalho_(sh), n = sh.getLastRow();
    MEMO_[nome] = { sh: sh, cab: cab, vals: n > 1 ? sh.getRange(2, 1, n - 1, cab.length).getValues() : [] };
  }
  return MEMO_[nome];
}

function decodificar_(s, cab, r) {
  const o = {};
  s.colunas.forEach(function (c) {
    const i = cab.indexOf(c);
    let v = i >= 0 ? r[i] : '';
    if (v instanceof Date) v = v.toISOString();
    if (s.num && s.num.indexOf(c) >= 0) v = numero_(v);
    else if (s.bool && s.bool.indexOf(c) >= 0) v = v === true || /^(1|true|sim)$/i.test(String(v));
    else if (s.json && s.json.indexOf(c) >= 0) { try { v = v === '' || v == null ? null : JSON.parse(v); } catch (e) { v = null; } }
    else v = v == null ? '' : String(v);
    o[c] = v;
  });
  return o;
}

function codificar_(s, cab, o, base) {
  return cab.map(function (c, i) {
    if (s.colunas.indexOf(c) < 0) return base ? base[i] : '';
    let v = o[c];
    if (v === undefined || v === null) return '';
    if (s.json && s.json.indexOf(c) >= 0) return JSON.stringify(v);
    if (s.bool && s.bool.indexOf(c) >= 0) return v ? '1' : '';
    v = String(v).slice(0, 49000);
    if (/^[=+\-@]/.test(v) && !(s.num && s.num.indexOf(c) >= 0)) v = "'" + v;
    return v;
  });
}

function comoLido_(l) { return l.map(function (v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v; }); }

function ler_(nome) {
  const t = tabela_(nome), s = esquema_(nome);
  return t.vals.filter(function (r) { return r.some(function (v) { return v !== '' && v !== null; }); }).map(function (r) { return decodificar_(s, t.cab, r); });
}

function linha_(t, s, chave) {
  const col = t.cab.indexOf(s.chave || 'id');
  for (let i = 0; i < t.vals.length; i++) if (String(t.vals[i][col]).toLowerCase() === String(chave).toLowerCase()) return i;
  return -1;
}

function achar_(nome, chave) { const t = tabela_(nome), s = esquema_(nome), i = linha_(t, s, chave); return i < 0 ? null : decodificar_(s, t.cab, t.vals[i]); }

function inserir_(nome, obj) {
  const t = tabela_(nome), s = esquema_(nome), l = codificar_(s, t.cab, obj, null);
  t.sh.getRange(t.vals.length + 2, 1, 1, t.cab.length).setNumberFormat('@').setValues([l]);
  t.vals.push(comoLido_(l));
  return decodificar_(s, t.cab, t.vals[t.vals.length - 1]);
}

function atualizar_(nome, chave, patch) {
  const t = tabela_(nome), s = esquema_(nome), i = linha_(t, s, chave);
  if (i < 0) throw new Error('Registro não encontrado. Recarregue a página.');
  const l = codificar_(s, t.cab, Object.assign(decodificar_(s, t.cab, t.vals[i]), patch), t.vals[i]);
  t.sh.getRange(i + 2, 1, 1, t.cab.length).setNumberFormat('@').setValues([l]);
  t.vals[i] = comoLido_(l);
  return decodificar_(s, t.cab, t.vals[i]);
}

function remover_(nome, chave) {
  const t = tabela_(nome), s = esquema_(nome), i = linha_(t, s, chave);
  if (i < 0) return false;
  t.sh.deleteRow(i + 2);
  t.vals.splice(i, 1);
  return true;
}

function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try { MEMO_ = {}; const r = fn(); SpreadsheetApp.flush(); return r; } finally { trava.releaseLock(); }
}

function config_(chave) { const r = achar_('config', chave); return r ? r.valor : ''; }
function gravarConfig_(chave, valor) { if (achar_('config', chave)) atualizar_('config', chave, { valor: valor }); else inserir_('config', { chave: chave, valor: valor }); }

// ---------- acesso ----------
// Papéis: admin (equipe e ajustes), editor (cria e edita tudo), leitor (só vê).
// Quem abre pelo link com uma conta de outro domínio não aparece com e-mail para o Apps Script: com o
// "link aberto" ligado (Ajustes), essa pessoa entra como editora "Equipe"; desligado, fica sem acesso.
const PAPEIS = { leitor: 1, editor: 2, admin: 3 };
let EU_ = null;

function emailDono_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); }

function eu_() {
  if (EU_) return EU_;
  if (!ler_('equipe').length) {
    const dono = emailDono_();
    comTrava_(function () {
      if (!ler_('equipe').length && dono) inserir_('equipe', { email: dono, nome: nomeDoEmail_(dono), papel: 'admin', ativo: true, criadoEm: agora_() });
      if (!achar_('config', 'linkAberto')) gravarConfig_('linkAberto', '1');
    });
  }
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const m = email ? achar_('equipe', email) : null;
  if (m && m.ativo && PAPEIS[m.papel]) EU_ = { email: email, nome: m.nome || nomeDoEmail_(email), papel: m.papel };
  else if (!email && config_('linkAberto') === '1') EU_ = { email: '', nome: 'Equipe', papel: 'editor' };
  else EU_ = { email: email, nome: email ? nomeDoEmail_(email) : '', papel: 'sem_acesso' };
  return EU_;
}

function exigir_(papel) {
  const eu = eu_();
  if (eu.papel === 'sem_acesso') throw new Error('Você não tem acesso. Peça para um admin incluir o seu e-mail na equipe.');
  if ((PAPEIS[eu.papel] || 0) < PAPEIS[papel]) throw new Error('Seu acesso (' + eu.papel + ') não permite esta ação.');
  return eu;
}

function salvarMembro(d) {
  exigir_('admin');
  return comTrava_(function () {
    d = d || {};
    const email = email_(d.email);
    if (!email) throw new Error('E-mail inválido.');
    const papel = PAPEIS[d.papel] ? d.papel : 'editor', ativo = d.ativo !== false, atual = achar_('equipe', email);
    if (atual && atual.papel === 'admin' && (papel !== 'admin' || !ativo) && ler_('equipe').filter(function (m) { return m.papel === 'admin' && m.ativo; }).length <= 1) {
      throw new Error('Este é o único admin. Promova outra pessoa antes.');
    }
    const dados = { nome: texto_(d.nome, 80) || nomeDoEmail_(email), papel: papel, ativo: ativo };
    if (atual) atualizar_('equipe', email, dados); else inserir_('equipe', Object.assign({ email: email, criadoEm: agora_() }, dados));
    return ler_('equipe');
  });
}

function salvarAjustes(d) {
  exigir_('admin');
  return comTrava_(function () {
    d = d || {};
    if ('linkAberto' in d) gravarConfig_('linkAberto', d.linkAberto ? '1' : '0');
    if (d.chaveIA !== undefined && d.chaveIA !== null) {
      const k = texto_(d.chaveIA, 300), p = PropertiesService.getScriptProperties();
      if (k && !/^sk-ant-/.test(k)) throw new Error('A chave da Anthropic começa com sk-ant-.');
      if (k) p.setProperty('ANTHROPIC_API_KEY', k); else if (d.apagarChave) p.deleteProperty('ANTHROPIC_API_KEY');
    }
    return { linkAberto: config_('linkAberto') === '1', temIA: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') };
  });
}

// ===== Social.gs =====
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

// ===== Reportei.gs =====
/**
 * Leitura do PDF de relatório da Reportei.
 * O navegador extrai o texto do PDF (pdf.js) e manda para lerReportei(texto); aqui ele vira dados:
 * período, números do Instagram (seguidores, alcance orgânico e pago, visualizações, visitas, interações),
 * posts, reels e stories com as métricas de cada um, cidades, a análise escrita pela Reportei
 * (texto + ações sugeridas) e o bloco do LinkedIn. Nada é gravado: a tela mostra para a equipe conferir e salvar.
 */
const NUM_ = '(\\d[\\d.]*(?:,\\d+)?)';

// "3.617" -> 3617; "13,64" -> 13.64; "7,5%" -> 7.5
function numBr_(s) {
  const t = String(s == null ? '' : s).replace('%', '').trim();
  if (!t) return 0;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function dataBrIso_(s) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ''));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

function pega_(texto, re) { const m = re.exec(texto); return m ? numBr_(m[1]) : null; }

// Mês do relatório: o mês com mais dias dentro do período (09/09 a 09/10 é setembro).
function mesDoPeriodo_(ini, fim) {
  if (!ini || !fim) return '';
  const conta = {};
  for (let d = new Date(ini + 'T12:00:00Z'); d <= new Date(fim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 7);
    conta[k] = (conta[k] || 0) + 1;
  }
  return Object.keys(conta).sort(function (a, b) { return conta[b] - conta[a] || (a < b ? -1 : 1); })[0] || '';
}

// Separa a análise escrita em texto corrido e ações (os itens com •).
function separarAnalise_(bloco) {
  const partes = String(bloco || '').split('•').map(function (x) { return x.trim(); }).filter(Boolean);
  if (!partes.length) return [];
  const analises = [];
  let atual = { texto: partes[0], acoes: [] };
  analises.push(atual);
  partes.slice(1).forEach(function (p) {
    // Um item termina na primeira frase depois do travessão; o que sobra (texto longo) abre a análise seguinte.
    const m = /^(.*?\s[—–-]\s.*?[.)]\.?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^•]{120,})$/.exec(p);
    if (m) {
      atual.acoes.push(m[1].trim());
      atual = { texto: m[2].trim(), acoes: [] };
      analises.push(atual);
    } else atual.acoes.push(p);
  });
  return analises;
}

function lerPostsIg_(trecho) {
  const re = new RegExp('(.+?)\\s(Carrossel|Imagem|Foto|Vídeo|Video|Reels?|Post)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_, 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      legenda: texto_(m[1].replace(/^.*?Compartilhamentos\s/, ''), 160), tipo: m[2], visualizacoes: numBr_(m[3]), alcance: numBr_(m[4]),
      interacoes: numBr_(m[5]), taxa: numBr_(m[6]), curtidas: numBr_(m[7]), comentarios: numBr_(m[8]), salvos: numBr_(m[9]), compartilhamentos: numBr_(m[10]),
    });
  }
  return out;
}

function lerReelsIg_(trecho) {
  const re = new RegExp('(.+?)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s(\\d{2}\\/\\d{2}\\/\\d{4})', 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      legenda: texto_(m[1].replace(/^.*?Criado em\s/, ''), 160), tipo: 'Reels', visualizacoes: numBr_(m[2]), alcance: numBr_(m[3]), interacoes: numBr_(m[4]),
      taxa: numBr_(m[5]), curtidas: numBr_(m[6]), comentarios: numBr_(m[7]), salvos: numBr_(m[8]), compartilhamentos: numBr_(m[9]), data: dataBrIso_(m[10]),
    });
  }
  return out;
}

function lerStoriesIg_(trecho) {
  const re = new RegExp('Visualizações:\\s' + NUM_ + '\\sAlcance:\\s' + NUM_ + '\\sInterações:\\s' + NUM_ + '\\sVisitas ao Perfil:\\s' + NUM_ +
    '\\sRespostas:\\s' + NUM_ + '\\sCompartilhamentos:\\s' + NUM_ + '\\sRetenção:\\s([\\d.,]+)%.*?Data:\\s(\\d{2}\\/\\d{2}\\/\\d{4})', 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      visualizacoes: numBr_(m[1]), alcance: numBr_(m[2]), interacoes: numBr_(m[3]), visitasPerfil: numBr_(m[4]), respostas: numBr_(m[5]),
      compartilhamentos: numBr_(m[6]), retencao: numBr_(m[7]), data: dataBrIso_(m[8]),
    });
  }
  return out;
}

function lerCidades_(trecho) {
  const m = /Cidade Seguidores (.*?) Alcance das postagens/.exec(trecho);
  if (!m) return [];
  const out = [], re = /(.+?)\s(\d[\d.]*)(?=\s|$)/g;
  let x;
  while ((x = re.exec(m[1]))) out.push({ cidade: texto_(x[1], 80), seguidores: numBr_(x[2]) });
  return out.slice(0, 10);
}

function lerLinkedin_(trecho) {
  if (!trecho) return null;
  const li = {
    seguidores: pega_(trecho, new RegExp('Número atual de seguidores ' + NUM_)),
    posts: pega_(trecho, new RegExp('Número de postagens ' + NUM_)),
    alcance: pega_(trecho, new RegExp('Alcance ' + NUM_)),
    impressoes: pega_(trecho, new RegExp('Impressões ' + NUM_)),
    postagens: [],
  };
  const t = (/Taxa de engajamento (.*)$/.exec(trecho) || [])[1] || '';
  const re = new RegExp('(.+?)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%', 'g');
  let m;
  while ((m = re.exec(t))) {
    li.postagens.push({
      legenda: texto_(m[1], 160), impressoes: numBr_(m[2]), alcance: numBr_(m[3]), compartilhamentos: numBr_(m[4]), curtidas: numBr_(m[5]),
      cliques: numBr_(m[6]), comentarios: numBr_(m[7]), taxa: numBr_(m[8]),
    });
  }
  return li;
}

// O pdf.js quebra palavras nas ligaduras da fonte da Reportei ("Int erações", "Dat a", "Compart ilhament os").
const REPAROS_ = [
  [/Compart ilhament os/g, 'Compartilhamentos'], [/Int era(ç(?:ões|ão))/g, 'Intera$1'], [/Visit as/g, 'Visitas'], [/Perf il/g, 'Perfil'],
  [/Respost as/g, 'Respostas'], [/Ret enção/g, 'Retenção'], [/St ory/g, 'Story'], [/Volt ar/g, 'Voltar'], [/Dat a:/g, 'Data:'],
  [/\b([Pp]er)f? ?il\b/g, '$1fil'], [/\b([Pp]er) l\b/g, '$1fil'], [/([A-Za-z]) ([ãõç]) ([a-zãõ])/g, '$1$2$3'], [/([a-zç]) ([ãõ]) ?(os?|es?)\b/g, '$1$2$3'], [/([çãõ]) (o|os|es)\b/g, '$1$2'], [/Curt idas/g, 'Curtidas'], [/Coment ários/g, 'Comentários'], [/Post agem/g, 'Postagem'], [/Número at ual/g, 'Número atual'],
  [/([a-zà-ú])ament (os?|as?)\b/g, '$1ament$2'],
];
function repararTexto_(t) {
  let s = String(t || '').replace(/[\u0000-\u0008\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ');
  REPAROS_.forEach(function (r) { s = s.replace(r[0], r[1]); });
  return s.trim();
}

// Lê o texto de um relatório da Reportei. Devolve null se o texto não for da Reportei.
function extrairReportei_(bruto) {
  const t = repararTexto_(bruto);
  const per = /analisados entre (\d{2}\/\d{2}\/\d{4}) e (\d{2}\/\d{2}\/\d{4})/.exec(t);
  if (!per && !/Reportei/i.test(t)) return null;
  const ini = per ? dataBrIso_(per[1]) : '', fim = per ? dataBrIso_(per[2]) : '';
  const iLi = t.indexOf('Número atual de seguidores');
  const ig = iLi >= 0 ? t.slice(0, iLi) : t, liTxt = iLi >= 0 ? t.slice(iLi) : '';
  const PER = '(?:.{0,60}?\\d{2}\\/\\d{2}\\/\\d{4} a \\d{2}\\/\\d{2}\\/\\d{4})?\\s';
  const r = {
    fonte: 'reportei', periodoIni: ini, periodoFim: fim, mes: mesDoPeriodo_(ini, fim),
    instagram: {
      seguidores: pega_(ig, new RegExp('Número de seguidores ' + NUM_)),
      alcanceOrganico: pega_(ig, new RegExp('Alcance Orgânico' + PER + NUM_)),
      visualizacoes: pega_(ig, new RegExp('Visualizações totais[^\\d]*?' + NUM_)),
      alcance: pega_(ig, new RegExp('Alcance total' + PER + NUM_)),
      alcancePago: pega_(ig, new RegExp('Alcance Pago' + PER + NUM_)),
      visitasPerfil: pega_(ig, new RegExp('Visitas do perfil ' + NUM_)),
      interacoes: pega_(ig, new RegExp('Interações totais ' + NUM_)),
      alcancePosts: pega_(ig, new RegExp('Alcance das postagens' + PER + NUM_)),
      alcanceReels: pega_(ig, new RegExp('Alcance dos reels' + PER + NUM_)),
      alcanceStories: pega_(ig, new RegExp('Alcance dos stories' + PER + NUM_)),
    },
    cidades: lerCidades_(ig),
    posts: [], reels: [], stories: [], analise: [], linkedin: lerLinkedin_(liTxt),
  };
  const iPosts = ig.indexOf('Dados orgânicos de postagens'), iDia = ig.indexOf('Melhor dia para postagens');
  if (iPosts >= 0) r.posts = lerPostsIg_(ig.slice(iPosts, iDia > iPosts ? iDia : undefined));
  const iReels = ig.indexOf('Reels em Destaque'), iSt = ig.indexOf('Alcance dos stories');
  if (iReels >= 0) r.reels = lerReelsIg_(ig.slice(iReels, iSt > iReels ? iSt : undefined));
  r.stories = lerStoriesIg_(ig);
  // A análise escrita vem depois do último story (ou da última tabela) e vai até o bloco do LinkedIn.
  const ultimoData = ig.lastIndexOf('Data: ');
  const iAnalise = ultimoData >= 0 ? ultimoData + 16 : (iDia >= 0 ? iDia : -1);
  if (iAnalise >= 0) r.analise = separarAnalise_(ig.slice(iAnalise).replace(/^\s*\d{4}\s*/, ''));
  return r;
}

// Chamado pela tela com o texto do PDF.
function lerReportei(texto) {
  exigir_('editor');
  const r = extrairReportei_(texto);
  if (!r) throw new Error('Este PDF não parece ser um relatório da Reportei.');
  return r;
}
