/**
 * Simulador mínimo do Google Apps Script para rodar o servidor (src/*.gs) no Node.
 * Cada chamada roda num contexto novo, como uma execução real do Apps Script:
 * variáveis globais (cache de leitura, usuário atual) não sobrevivem entre chamadas,
 * só a "planilha" e as propriedades, que ficam no objeto `estado`.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

// ignorar: arquivos .gs a deixar de fora; extra: código a mais (os testes usam para simular EquipeSeok.gs).
function lerFontes(ignorar, extra) {
  return fs.readdirSync(SRC).filter((f) => f.endsWith('.gs') && !(ignorar || []).includes(f)).sort()
    .map((f) => '// ---- ' + f + '\n' + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n') + (extra ? '\n' + extra : '');
}

function novoEstado() {
  return { abas: {}, props: {}, gatilhos: [], emails: [], chats: [], cache: {} };
}

function criarPlanilha(estado) {
  function aba(nome) {
    const linhas = estado.abas[nome];
    const ultimaLinha = () => {
      for (let i = linhas.length - 1; i >= 0; i--) if (linhas[i].some((v) => v !== '' && v != null)) return i + 1;
      return 0;
    };
    const intervalo = (r, c, nr = 1, nc = 1) => ({
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const linha = linhas[r - 1 + i] || [];
          const row = [];
          for (let j = 0; j < nc; j++) row.push(linha[c - 1 + j] === undefined ? '' : linha[c - 1 + j]);
          out.push(row);
        }
        return out;
      },
      setValues(v) {
        for (let i = 0; i < nr; i++) {
          while (linhas.length < r + i) linhas.push([]);
          const linha = linhas[r - 1 + i];
          for (let j = 0; j < nc; j++) {
            let x = v[i][j];
            // Como no Sheets: o apóstrofo inicial só força texto e não fica no valor.
            if (typeof x === 'string' && x.startsWith("'")) x = x.slice(1);
            linha[c - 1 + j] = x;
          }
        }
        return this;
      },
      setNumberFormat() { return this; },
      setFontWeight() { return this; },
    });
    return {
      getName: () => nome,
      getLastRow: ultimaLinha,
      getLastColumn: () => linhas.reduce((m, l) => {
        let n = 0;
        l.forEach((v, i) => { if (v !== '' && v != null) n = i + 1; });
        return Math.max(m, n);
      }, 0),
      getMaxRows: () => Math.max(1000, linhas.length),
      getRange: (...a) => { estado.chamadas = (estado.chamadas || 0) + 1; return intervalo(...a); },
      getDataRange() {
        estado.chamadas = (estado.chamadas || 0) + 1;
        const nc = linhas.reduce((m, l) => { let n = 0; l.forEach((v, i) => { if (v !== '' && v != null) n = i + 1; }); return Math.max(m, n); }, 0);
        return intervalo(1, 1, Math.max(ultimaLinha(), 1), Math.max(nc, 1));
      },
      appendRow(v) { linhas.splice(ultimaLinha(), 0, v.slice()); return this; },
      deleteRow(r) { linhas.splice(r - 1, 1); return this; },
      setFrozenRows() { return this; },
    };
  }
  return {
    getId: () => 'planilha-dev',
    getName: () => 'Seok Flow (dev)',
    getUrl: () => 'http://localhost/planilha',
    getSheetByName: (n) => (estado.abas[n] ? aba(n) : null),
    insertSheet: (n) => { estado.abas[n] = []; return aba(n); },
    getSheets: () => Object.keys(estado.abas).map(aba),
  };
}

function criarGlobais(estado, opcoes) {
  const usuario = (opcoes.usuario || '').toLowerCase();
  const dono = (opcoes.dono || 'dono@agencia.dev').toLowerCase();
  const planilha = criarPlanilha(estado);
  const props = {
    getProperty: (k) => (k in estado.props ? estado.props[k] : null),
    setProperty: (k, v) => { estado.props[k] = String(v); },
    deleteProperty: (k) => { delete estado.props[k]; },
    getProperties: () => Object.assign({}, estado.props),
  };
  const fmtData = (d, tz, fmt) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
  };
  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => planilha, flush() {} },
    Session: {
      getActiveUser: () => ({ getEmail: () => usuario }),
      getEffectiveUser: () => ({ getEmail: () => dono }),
      getScriptTimeZone: () => 'America/Sao_Paulo',
    },
    CacheService: {
      getScriptCache: () => {
        estado.cache = estado.cache || {};
        return { get: (k) => (k in estado.cache ? estado.cache[k] : null), put: (k, v) => { estado.cache[k] = String(v); }, remove: (k) => { delete estado.cache[k]; } };
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => props },
    MailApp: {
      sendEmail(o) { estado.emails.push(o); },
      getRemainingDailyQuota: () => 100,
    },
    UrlFetchApp: {
      fetch(url, o) {
        // Instagram simulado: estado.instagram = { usuario: { codigo, corpo } }.
        const ig = /instagram\.com\/api\/.*username=([^&]+)/.exec(url);
        if (ig) {
          const r = (estado.instagram || {})[decodeURIComponent(ig[1])] || { codigo: 404, corpo: '' };
          return { getResponseCode: () => r.codigo, getContentText: () => (typeof r.corpo === 'string' ? r.corpo : JSON.stringify(r.corpo)) };
        }
        estado.chats.push({ url, corpo: JSON.parse(o.payload) });
        return { getResponseCode: () => 200, getContentText: () => '{}' };
      },
    },
    Utilities: {
      getUuid: () => require('crypto').randomUUID(),
      formatDate: fmtData,
      base64Encode: (s) => Buffer.from(String(s), 'utf8').toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64')),
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'http://localhost:8080/' }),
      getProjectTriggers: () => estado.gatilhos.map((g) => ({
        getHandlerFunction: () => g.fn, getUniqueId: () => g.id,
      })),
      deleteTrigger(t) { estado.gatilhos = estado.gatilhos.filter((g) => g.id !== t.getUniqueId()); },
      newTrigger(fn) {
        const g = { fn, id: 'g' + Math.random().toString(36).slice(2) };
        const b = { timeBased: () => b, everyDays: () => b, atHour: (h) => { g.hora = h; return b; }, create: () => { estado.gatilhos.push(g); return g; } };
        return b;
      },
    },
    HtmlService: {
      createHtmlOutputFromFile: (f) => ({ getContent: () => fs.readFileSync(path.join(SRC, f + '.html'), 'utf8') }),
    },
    Logger: { log: () => {} },
    console: opcoes.console || { log() {}, warn() {}, error() {} },
  };
}

// Roda uma função pública do servidor como se fosse google.script.run, com serialização JSON.
function executar(estado, opcoes, fn, args) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(fn)) throw new Error('Função inválida: ' + fn);
  const ctx = vm.createContext(criarGlobais(estado, opcoes));
  vm.runInContext(lerFontes(opcoes.ignorar, opcoes.extra), ctx, { filename: 'servidor.gs' });
  if (typeof ctx[fn] !== 'function') throw new Error('Função inexistente: ' + fn);
  const r = ctx[fn].apply(null, JSON.parse(JSON.stringify(args || [])));
  return r === undefined ? null : JSON.parse(JSON.stringify(r));
}

module.exports = { novoEstado, executar };
