/**
 * Manutenção diária, por um gatilho que o CRM instala sozinho na primeira abertura.
 * O histórico ganha linhas a cada alteração. A aba principal guarda os últimos 180 dias, até 20 mil linhas;
 * o restante vai para a aba historico_arquivo. Assim abrir um card e o C-Vision não ficam mais lentos com o tempo.
 * As linhas entram em ordem de tempo, então as antigas estão sempre no topo da aba.
 */
const HIST_DIAS_ = 180;
const HIST_MAX_ = 20000;
const HIST_LOTE_ = 5000;
const ABA_ARQUIVO_ = 'historico_arquivo';
const PROP_MANUTENCAO_ = 'manutencao_v1';

function garantirManutencao_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty(PROP_MANUTENCAO_)) return;
  try {
    const existe = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'gatilhoManutencao'; });
    if (!existe) ScriptApp.newTrigger('gatilhoManutencao').timeBased().everyDays(1).atHour(3).create();
    p.setProperty(PROP_MANUTENCAO_, agora_());
  } catch (e) { console.warn('manutenção: ' + e.message); }
}

// Função chamada pelo gatilho. Só roda se a chamada vier de um gatilho real deste projeto.
function gatilhoManutencao(e) {
  const uid = e && e.triggerUid ? String(e.triggerUid) : '';
  const real = uid && ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === uid; });
  if (!real) throw new Error('Esta função só roda pelo gatilho de manutenção.');
  return arquivarHistorico_();
}

// Pelo editor ou pelo Admin: roda a manutenção agora.
function rodarManutencaoAgora() {
  exigir_('admin');
  return arquivarHistorico_();
}

// Em lotes, cada um com a trava, para não segurar as gravações do time por muito tempo.
// Para antes de 4 minutos (o Google corta a execução em 6); o que sobrar vai na noite seguinte.
function arquivarHistorico_() {
  const inicio = Date.now();
  let total = 0, n = HIST_LOTE_;
  while (n === HIST_LOTE_ && Date.now() - inicio < 240000) {
    n = comTrava_(arquivarLote_);
    total += n;
  }
  return { arquivadas: total };
}

function arquivarLote_() {
  const sh = aba_('historico'), cab = cabDe_('historico'), n = sh.getLastRow() - 1, col = cab.indexOf('ts');
  if (n < 1 || col < 0) return 0;
  const limite = new Date(Date.now() - HIST_DIAS_ * 864e5).toISOString();
  const ts = sh.getRange(2, col + 1, Math.min(n, HIST_LOTE_), 1).getValues();
  let k = 0;
  while (k < ts.length) {
    const v = ts[k][0], iso = v instanceof Date ? v.toISOString() : String(v);
    if (!(iso < limite || n - k > HIST_MAX_)) break;
    k++;
  }
  if (!k) return 0;
  const linhas = sh.getRange(2, 1, k, cab.length).getValues();
  const arq = abaArquivo_(cab);
  arq.getRange(arq.getLastRow() + 1, 1, k, cab.length).setNumberFormat('@').setValues(linhas);
  sh.deleteRows(2, k);
  return k;
}

function abaArquivo_(cab) {
  let arq = abas_()[ABA_ARQUIVO_];
  if (!arq) {
    arq = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ABA_ARQUIVO_);
    abas_()[ABA_ARQUIVO_] = arq;
    arq.setFrozenRows(1);
  }
  if (arq.getLastColumn() < cab.length) arq.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
  return arq;
}
