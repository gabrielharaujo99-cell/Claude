/**
 * Flow CRM — utilitários compartilhados pelo servidor.
 * Funções terminadas em _ são internas: o Apps Script não deixa a tela chamá-las.
 */
const VERSAO = '0.1.0';

function agora_() { return new Date().toISOString(); }

function hoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function novoId_(prefixo) {
  return prefixo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function texto_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }

function numero_(v, min, max) {
  let n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(',', '.'));
  if (!isFinite(n)) n = 0;
  if (min != null) n = Math.max(min, n);
  if (max != null) n = Math.min(max, n);
  return n;
}

function dataIso_(v) {
  const s = texto_(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function email_(v) {
  const s = texto_(v, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

function url_(v) {
  const s = texto_(v, 1000);
  return /^https?:\/\/\S+$/i.test(s) ? s : '';
}

function umDe_(v, lista, padrao) { return lista.indexOf(v) >= 0 ? v : padrao; }

function nomeDoEmail_(email) {
  return String(email || '').split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(' ');
}

function diasDesde_(iso) {
  const t = Date.parse(iso);
  return isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : 0;
}

// Toda gravação passa por aqui: uma pessoa por vez, sempre lendo a planilha atualizada.
function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    MEMO_ = {};
    const r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally {
    trava.releaseLock();
  }
}

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}
