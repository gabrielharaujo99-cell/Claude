/**
 * Camada de dados: cada tabela é uma aba da planilha, com o cabeçalho na linha 1.
 * As colunas são achadas pelo nome do cabeçalho, então dá para reordenar colunas ou criar colunas extras
 * na planilha: o CRM preserva o que não conhece. Abas e colunas que faltam são criadas sozinhas.
 */
const SCHEMA = {
  oportunidades: {
    colunas: ['id', 'titulo', 'clienteId', 'servico', 'contrato', 'valor', 'meses', 'etapa', 'ordem', 'responsavel',
      'prioridade', 'origem', 'previsao', 'motivoPerda', 'obs', 'tags', 'criadoEm', 'criadoPor', 'etapaDesde',
      'fechadoEm', 'atualizadoEm', 'atualizadoPor', 'arquivado'],
    num: ['valor', 'meses', 'ordem'], json: ['tags'], bool: ['arquivado'],
  },
  clientes: {
    colunas: ['id', 'nome', 'segmento', 'contato', 'email', 'telefone', 'instagram', 'site', 'obs', 'criadoEm',
      'atualizadoEm', 'arquivado'],
    bool: ['arquivado'],
  },
  tarefas: {
    colunas: ['id', 'titulo', 'descricao', 'oportunidadeId', 'clienteId', 'responsavel', 'prazo', 'status', 'ordem',
      'criadoPor', 'criadoEm', 'concluidoEm', 'atualizadoEm'],
    num: ['ordem'],
  },
  comentarios: { colunas: ['id', 'oportunidadeId', 'autor', 'texto', 'mencoes', 'criadoEm'], json: ['mencoes'] },
  propostas: {
    colunas: ['id', 'oportunidadeId', 'titulo', 'url', 'valor', 'status', 'enviadaEm', 'validade', 'obs', 'criadoPor',
      'criadoEm', 'atualizadoEm'],
    num: ['valor'],
  },
  horas: { colunas: ['id', 'email', 'data', 'clienteId', 'oportunidadeId', 'horas', 'descricao', 'criadoEm'], num: ['horas'] },
  historico: { colunas: ['id', 'ts', 'email', 'entidade', 'entidadeId', 'acao', 'campo', 'de', 'para'] },
  equipe: { colunas: ['email', 'nome', 'papel', 'ativo', 'criadoEm'], chave: 'email', bool: ['ativo'] },
  config: { colunas: ['chave', 'valor'], chave: 'chave' },
};

// Leituras ficam em memória durante uma execução; comTrava_ zera para gravar sobre dados frescos.
let MEMO_ = {};

function esquema_(nome) {
  const s = SCHEMA[nome];
  if (!s) throw new Error('Tabela desconhecida: ' + nome);
  return s;
}

function aba_(nome) {
  const s = esquema_(nome), ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, s.colunas.length).setValues([s.colunas]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  const cab = cabecalho_(sh);
  const faltam = s.colunas.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltam.length) sh.getRange(1, cab.length + 1, 1, faltam.length).setValues([faltam]).setFontWeight('bold');
  return sh;
}

function cabecalho_(sh) {
  const n = sh.getLastColumn();
  return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(function (v) { return String(v).trim(); }) : [];
}

function tabela_(nome) {
  if (!MEMO_[nome]) {
    const sh = aba_(nome), cab = cabecalho_(sh), n = sh.getLastRow();
    const vals = n > 1 ? sh.getRange(2, 1, n - 1, cab.length).getValues() : [];
    MEMO_[nome] = { sh: sh, cab: cab, vals: vals };
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
    else if (s.bool && s.bool.indexOf(c) >= 0) v = v === true || v === 1 || /^(1|true|sim)$/i.test(String(v));
    else if (s.json && s.json.indexOf(c) >= 0) {
      try { v = v === '' || v == null ? [] : JSON.parse(v); } catch (e) { v = []; }
    } else v = v == null ? '' : String(v);
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
    // Texto que começa com = + - @ viraria fórmula na planilha: o apóstrofo força texto puro.
    if (/^[=+\-@]/.test(v) && !(s.num && s.num.indexOf(c) >= 0)) v = "'" + v;
    return v;
  });
}

// O apóstrofo só existe na gravação; ao ler, a planilha devolve o texto sem ele.
function comoLido_(linha) {
  return linha.map(function (v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v; });
}

function vazia_(r) { return !r.some(function (v) { return v !== '' && v !== null; }); }

function ler_(nome) {
  const t = tabela_(nome), s = esquema_(nome);
  return t.vals.filter(function (r) { return !vazia_(r); }).map(function (r) { return decodificar_(s, t.cab, r); });
}

function achar_(nome, chave) {
  const t = tabela_(nome), s = esquema_(nome), col = t.cab.indexOf(s.chave || 'id');
  for (let i = 0; i < t.vals.length; i++) {
    if (String(t.vals[i][col]).toLowerCase() === String(chave).toLowerCase()) return decodificar_(s, t.cab, t.vals[i]);
  }
  return null;
}

function linhaDe_(t, s, chave) {
  const col = t.cab.indexOf(s.chave || 'id');
  for (let i = 0; i < t.vals.length; i++) {
    if (String(t.vals[i][col]).toLowerCase() === String(chave).toLowerCase()) return i;
  }
  return -1;
}

function inserir_(nome, obj) {
  const t = tabela_(nome), s = esquema_(nome);
  const linha = codificar_(s, t.cab, obj, null);
  t.sh.getRange(t.vals.length + 2, 1, 1, t.cab.length).setNumberFormat('@').setValues([linha]);
  t.vals.push(comoLido_(linha));
  return decodificar_(s, t.cab, t.vals[t.vals.length - 1]);
}

function atualizar_(nome, chave, patch) {
  const t = tabela_(nome), s = esquema_(nome), i = linhaDe_(t, s, chave);
  if (i < 0) throw new Error('Registro não encontrado. Recarregue a página.');
  const antes = decodificar_(s, t.cab, t.vals[i]);
  const linha = codificar_(s, t.cab, Object.assign({}, antes, patch), t.vals[i]);
  t.sh.getRange(i + 2, 1, 1, t.cab.length).setNumberFormat('@').setValues([linha]);
  t.vals[i] = comoLido_(linha);
  return { antes: antes, depois: decodificar_(s, t.cab, t.vals[i]) };
}

function remover_(nome, chave) {
  const t = tabela_(nome), s = esquema_(nome), i = linhaDe_(t, s, chave);
  if (i < 0) return false;
  t.sh.deleteRow(i + 2);
  t.vals.splice(i, 1);
  return true;
}

// Trilha de auditoria: quem mudou o quê, quando.
function registrar_(eu, entidade, entidadeId, acao, campo, de, para) {
  inserir_('historico', {
    id: novoId_('h'), ts: agora_(), email: eu ? eu.email : '', entidade: entidade, entidadeId: entidadeId,
    acao: acao, campo: campo || '', de: texto_(de, 300), para: texto_(para, 300),
  });
}

function registrarDiferencas_(eu, entidade, antes, depois, campos) {
  campos.forEach(function (c) {
    const a = JSON.stringify(antes[c]), d = JSON.stringify(depois[c]);
    if (a !== d) registrar_(eu, entidade, depois.id, 'alterou', c, textoCampo_(antes[c]), textoCampo_(depois[c]));
  });
}

function textoCampo_(v) { return Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v); }
