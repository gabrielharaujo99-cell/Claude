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
  equipe: { colunas: ['email', 'nome', 'papel', 'ativo', 'criadoEm', 'acesso'], chave: 'email', bool: ['ativo'] },
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
  marcos: { colunas: ['id', 'clienteId', 'data', 'tipo', 'titulo', 'descricao', 'link', 'criadoPor', 'criadoEm'] },
};

let MEMO_ = {};

function esquema_(nome) { const s = SCHEMA[nome]; if (!s) throw new Error('Tabela desconhecida: ' + nome); return s; }

function aba_(nome) {
  const s = esquema_(nome), ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    // Duas chamadas ao mesmo tempo podem tentar criar a aba: se outra já criou, usa a dela.
    try { sh = ss.insertSheet(nome); } catch (e) { sh = ss.getSheetByName(nome); if (!sh) throw e; return sh; }
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
let CHAVE_ = '';

// Toda chamada da tela passa por aqui com a chave do link pessoal (?k=...). Contas Gmail de fora do domínio
// não mostram o e-mail para um app que roda como o dono; a chave é o que identifica essas pessoas.
function rodar(chave, fn, args) {
  const f = {
    carregar: carregar, salvarCliente: salvarCliente, salvarPost: salvarPost, moverPost: moverPost, removerPost: removerPost,
    salvarTema: salvarTema, ordenarTemas: ordenarTemas, temaParaPauta: temaParaPauta, removerTema: removerTema,
    salvarPedido: salvarPedido, pedidoParaPauta: pedidoParaPauta, removerPedido: removerPedido, sincronizarAgenda: sincronizarAgenda,
    criarPeca: criarPeca, salvarReport: salvarReport, removerReport: removerReport, lerReportei: lerReportei,
    pesquisarTendencias: pesquisarTendencias, salvarMarco: salvarMarco, removerMarco: removerMarco,
    salvarMembro: salvarMembro, salvarAjustes: salvarAjustes,
  }[fn];
  if (!f) throw new Error('Função desconhecida: ' + fn);
  CHAVE_ = /^[a-f0-9]{32}$/.test(String(chave || '')) ? String(chave) : '';
  EU_ = null;
  return f.apply(null, Array.isArray(args) ? args : []);
}

function novaChave_() { return Utilities.getUuid().replace(/-/g, ''); }
function linkApp_() { try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; } }

function emailDono_() { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); }

function eu_() {
  if (EU_) return EU_;
  if (!ler_('equipe').length) {
    const dono = emailDono_();
    comTrava_(function () {
      if (!ler_('equipe').length && dono) inserir_('equipe', { email: dono, nome: nomeDoEmail_(dono), papel: 'admin', ativo: true, criadoEm: agora_() });
      if (!achar_('config', 'linkAberto')) gravarConfig_('linkAberto', '0');
    });
  }
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const m = email ? achar_('equipe', email) : CHAVE_ ? ler_('equipe').filter(function (x) { return x.acesso === CHAVE_; })[0] || null : null;
  if (m && m.ativo && PAPEIS[m.papel]) EU_ = { email: m.email, nome: m.nome || nomeDoEmail_(m.email), papel: m.papel };
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
    const dados = { nome: texto_(d.nome, 80) || (atual && atual.nome) || nomeDoEmail_(email), papel: papel, ativo: ativo };
    // Link pessoal: nasce com a pessoa; "novoLink" troca a chave (o link antigo para de funcionar).
    if (!atual || !atual.acesso || d.novoLink) dados.acesso = novaChave_();
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
