/**
 * Flow CRM — servidor (Google Apps Script) de um CRM em Kanban para agências.
 *
 * Os dados ficam na planilha onde este script está instalado (uma aba por tabela, ver Db.gs).
 * Arquivos: Utils, Db (planilha como banco), Config (marca, funil, listas), Auth (equipe e papéis)
 * e um arquivo por área: Oportunidades, Clientes, Tarefas, Propostas, Horas, Avisos, Exemplo.
 * A tela fica em ui/ (index + estilos + scripts), montada por doGet.
 */

function doGet() {
  const cfg = config_();
  return HtmlService.createTemplateFromFile('ui/index').evaluate()
    .setTitle(cfg.produto + ' · ' + cfg.empresa)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// Usado pelo template ui/index para juntar os arquivos da tela.
function include(arquivo) { return HtmlService.createHtmlOutputFromFile(arquivo).getContent(); }

// Tudo o que a tela precisa ao abrir. Comentários e histórico vêm sob demanda (detalheOportunidade).
function carregar() {
  const eu = eu_();
  const cfg = config_();
  if (eu.papel === 'sem_acesso') {
    return { semAcesso: true, email: eu.email, empresa: cfg.empresa, produto: cfg.produto, marca: cfg.marca };
  }
  const contagem = {};
  ler_('comentarios').forEach(function (c) { contagem[c.oportunidadeId] = (contagem[c.oportunidadeId] || 0) + 1; });
  const equipe = ler_('equipe').filter(function (m) { return m.ativo || pode_(eu, 'admin'); })
    .map(function (m) { return { email: m.email, nome: m.nome, papel: m.papel, ativo: m.ativo }; });
  return {
    eu: eu,
    config: cfg,
    temChat: !!webhookChat_(),
    versao: VERSAO,
    hoje: hoje_(),
    equipe: equipe,
    clientes: ler_('clientes'),
    oportunidades: ler_('oportunidades'),
    tarefas: ler_('tarefas'),
    propostas: ler_('propostas'),
    comentarios: contagem,
  };
}
