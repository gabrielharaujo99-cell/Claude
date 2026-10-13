/**
 * Avisos por e-mail e por chat (webhook do Google Chat ou do Slack).
 * O resumo diário de cards parados e tarefas atrasadas roda num gatilho de tempo,
 * então funciona mesmo com ninguém com o CRM aberto. Instale pelo Admin > Avisos.
 */
const PROP_WEBHOOK_ = 'CHAT_WEBHOOK';

function webhookChat_() { return PropertiesService.getScriptProperties().getProperty(PROP_WEBHOOK_) || ''; }

function webhookValido_(url) {
  return /^https:\/\/(chat\.googleapis\.com\/v1\/spaces\/|hooks\.slack\.com\/services\/)\S+$/.test(url);
}

function salvarWebhookChat(url) {
  const eu = exigir_('admin');
  const u = texto_(url, 1000);
  if (u && !webhookValido_(u)) throw new Error('Use um webhook do Google Chat (chat.googleapis.com) ou do Slack (hooks.slack.com).');
  const p = PropertiesService.getScriptProperties();
  if (u) p.setProperty(PROP_WEBHOOK_, u); else p.deleteProperty(PROP_WEBHOOK_);
  comTrava_(function () { registrar_(eu, 'config', 'chat', u ? 'configurou' : 'removeu', 'webhook', '', ''); });
  return !!u;
}

function chat_(texto) {
  const url = webhookChat_();
  if (!url) return false;
  try {
    const r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify({ text: String(texto).slice(0, 3500) }), muteHttpExceptions: true,
    });
    return r.getResponseCode() < 300;
  } catch (e) {
    console.warn('Chat falhou: ' + e);
    return false;
  }
}

function testarChat() {
  const eu = exigir_('admin');
  if (!webhookChat_()) throw new Error('Cole o webhook antes de testar.');
  const ok = chat_('✅ ' + config_().produto + ' conectado. Teste enviado por ' + eu.nome + '.');
  if (!ok) throw new Error('O chat recusou a mensagem. Confira o webhook.');
  return true;
}

function email_aviso_(para, assunto, linhas) {
  const cfg = config_();
  if (!cfg.emailAvisos || !para) return false;
  const url = urlApp_();
  try {
    MailApp.sendEmail({
      to: para, subject: cfg.produto + ': ' + assunto, name: cfg.produto + ' · ' + cfg.empresa,
      body: linhas.join('\n') + (url ? '\n\nAbrir o CRM: ' + url : '') + '\n\n' + cfg.empresa + ' · ' + cfg.produto,
    });
    return true;
  } catch (e) {
    console.warn('E-mail falhou: ' + e);
    return false;
  }
}

function nomeCliente_(id) { const c = id ? achar_('clientes', id) : null; return c ? c.nome : ''; }

function rotuloOp_(op) { const c = nomeCliente_(op.clienteId); return (c ? c + ' · ' : '') + op.titulo; }

function avisarMencao_(eu, emails, texto, op) {
  const linhas = [eu.nome + ' marcou você num comentário em "' + rotuloOp_(op) + '":', '', '"' + texto.slice(0, 800) + '"'];
  emails.forEach(function (e) { email_aviso_(e, eu.nome + ' marcou você', linhas); });
  const nomes = emails.map(function (e) { const m = achar_('equipe', e); return '*' + (m ? m.nome : e) + '*'; }).join(', ');
  chat_('💬 *' + eu.nome + '* marcou ' + nomes + ' em _' + rotuloOp_(op) + '_\n> ' + texto.slice(0, 300));
}

function avisarTarefa_(eu, t, op) {
  const linhas = [eu.nome + ' passou uma tarefa para você:', '', '• ' + t.titulo + (t.prazo ? ' (prazo ' + t.prazo.split('-').reverse().join('/') + ')' : '')];
  if (op) linhas.push('Oportunidade: ' + rotuloOp_(op));
  email_aviso_(t.responsavel, 'nova tarefa de ' + eu.nome, linhas);
}

function avisarGanho_(eu, op, cfg) {
  const total = op.contrato === 'fee' ? op.valor * op.meses : op.valor;
  const valor = total.toLocaleString('pt-BR', { style: 'currency', currency: cfg.moeda });
  chat_('🎉 *Fechado!* ' + rotuloOp_(op) + ' — ' + valor + (op.contrato === 'fee' ? ' (fee de ' + op.meses + ' meses)' : '') + ' · por ' + eu.nome);
}

// Monta e envia o resumo: para cada pessoa, os cards dela parados e as tarefas atrasadas.
function enviarResumoDiario_() {
  const cfg = config_(), hoje = hoje_();
  const abertas = {};
  cfg.etapas.forEach(function (e) { if (e.tipo === 'aberta') abertas[e.id] = e.nome; });
  const paradas = ler_('oportunidades').filter(function (o) {
    return !o.arquivado && abertas[o.etapa] && diasDesde_(o.etapaDesde) >= cfg.diasParado;
  });
  const atrasadas = ler_('tarefas').filter(function (t) { return t.status !== 'feito' && t.prazo && t.prazo < hoje; });
  const porPessoa = {};
  const de = function (e) { return porPessoa[e] = porPessoa[e] || { ops: [], tarefas: [] }; };
  paradas.forEach(function (o) { if (o.responsavel) de(o.responsavel).ops.push(o); });
  atrasadas.forEach(function (t) { if (t.responsavel) de(t.responsavel).tarefas.push(t); });
  let enviados = 0;
  Object.keys(porPessoa).forEach(function (email) {
    const m = membroAtivo_(email);
    if (!m) return;
    const p = porPessoa[email], linhas = ['Olá, ' + m.nome.split(' ')[0] + '! Seu resumo de hoje:'];
    if (p.ops.length) {
      linhas.push('', 'Oportunidades paradas há ' + cfg.diasParado + '+ dias:');
      p.ops.forEach(function (o) { linhas.push('• ' + rotuloOp_(o) + ' — ' + abertas[o.etapa] + ', ' + diasDesde_(o.etapaDesde) + ' dias'); });
    }
    if (p.tarefas.length) {
      linhas.push('', 'Tarefas atrasadas:');
      p.tarefas.forEach(function (t) { linhas.push('• ' + t.titulo + ' (prazo ' + t.prazo.split('-').reverse().join('/') + ')'); });
    }
    if (email_aviso_(email, 'seu resumo do dia', linhas)) enviados++;
  });
  if (paradas.length) {
    chat_('⏰ *' + paradas.length + ' oportunidade(s) parada(s) há ' + cfg.diasParado + '+ dias*\n' +
      paradas.slice(0, 10).map(function (o) {
        const m = membroAtivo_(o.responsavel);
        return '• ' + rotuloOp_(o) + ' — ' + diasDesde_(o.etapaDesde) + 'd' + (m ? ' (' + m.nome + ')' : '');
      }).join('\n'));
  }
  return { paradas: paradas.length, atrasadas: atrasadas.length, emails: enviados };
}

// "Enviar resumo agora" no Admin.
function enviarResumoAgora() {
  exigir_('admin');
  return enviarResumoDiario_();
}

// Função chamada pelo gatilho diário. Só roda se a chamada vier de um gatilho real deste projeto.
function gatilhoDiario(e) {
  const uid = e && e.triggerUid ? String(e.triggerUid) : '';
  const real = uid && ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === uid; });
  if (!real) throw new Error('Esta função só roda pelo gatilho diário.');
  return enviarResumoDiario_();
}

function instalarResumoDiario(hora) {
  const eu = exigir_('admin');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'gatilhoDiario') ScriptApp.deleteTrigger(t);
  });
  const h = Math.round(numero_(hora == null ? 8 : hora, 0, 23));
  ScriptApp.newTrigger('gatilhoDiario').timeBased().everyDays(1).atHour(h).create();
  comTrava_(function () { registrar_(eu, 'config', 'resumo', 'instalou', 'hora', '', String(h)); });
  return { hora: h };
}

function statusAvisos() {
  exigir_('admin');
  const g = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'gatilhoDiario'; });
  let cota = null;
  try { cota = MailApp.getRemainingDailyQuota(); } catch (e) { cota = null; }
  return { resumoInstalado: g.length > 0, temChat: !!webhookChat_(), cotaEmail: cota };
}
