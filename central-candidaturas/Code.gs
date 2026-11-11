/**
 * Central de Candidaturas — Gabriel Araujo
 * Web app (Apps Script) com os dados numa planilha do Google.
 * Na primeira execução cria a planilha "Central de Candidaturas" e preenche com os dados iniciais.
 */
const COLS = ["id", "empresa", "vaga", "etapa", "proxima_acao", "prazo", "data", "modelo", "canal", "contato", "notas", "fonte"];
const ETAPAS = ['Ação sua', 'Em processo', 'Aguardando', 'Encerrada'];
// Dados iniciais ficam só no projeto do Apps Script (repositório público).
// Formato: uma lista por candidatura, na ordem de COLS.
const SEED = [];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Central de Candidaturas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SHEET_ID');
  let ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('Central de Candidaturas');
    props.setProperty('SHEET_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName('Candidaturas');
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold');
    if (SEED.length) sh.getRange(2, 1, SEED.length, COLS.length).setValues(SEED);
    sh.setFrozenRows(1);
    sh.getRange(2, COLS.indexOf('etapa') + 1, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(ETAPAS, true).build());
  }
  return ss.getSheetByName('Candidaturas');
}

function getData() {
  const sh = sheet_();
  const v = sh.getDataRange().getDisplayValues();
  const head = v.shift();
  return {
    rows: v.filter(r => r[0]).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]]))),
    sheetUrl: sh.getParent().getUrl()
  };
}

function updateRow(id, patch) {
  const sh = sheet_();
  const v = sh.getDataRange().getValues();
  const head = v[0];
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      Object.keys(patch).forEach(k => {
        const c = head.indexOf(k);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(patch[k]);
      });
      return getData();
    }
  }
  throw new Error('Candidatura não encontrada: ' + id);
}

function addRow(rec) {
  const sh = sheet_();
  const n = sh.getLastRow();
  rec.id = 'c' + Date.now();
  sh.appendRow(COLS.map(c => rec[c] || ''));
  return getData();
}
