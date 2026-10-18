/**
 * Flowloop — servidor (Google Apps Script) de um CRM em Kanban para agências.
 *
 * Os dados ficam na planilha onde este script está instalado (uma aba por tabela, ver Db.gs).
 * Arquivos: Utils, Db (planilha como banco), Config (marca, funil, listas), Auth (equipe, papéis e áreas)
 * e um arquivo por área: Oportunidades, Clientes, Tarefas, Propostas, Horas, Social, Trafego, Financeiro,
 * CVision, Perfil, Avisos, Exemplo. O arquivo privado da agência (fora do Git) traz a equipe inicial e o perfil (CONFIG_AGENCIA).
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

// Tudo o que a tela precisa ao abrir, recortado pelas áreas de cada pessoa.
// Comentários e histórico vêm sob demanda (detalheOportunidade); o C-Vision vem por cvision().
function carregar() {
  const eu = eu_();
  const cfg = config_();
  if (eu.papel === 'sem_acesso') {
    return { semAcesso: true, email: eu.email, empresa: cfg.empresa, produto: cfg.produto, marca: cfg.marca };
  }
  const fotos = fotosDiretorio_();
  const equipe = ler_('equipe').filter(function (m) { return m.ativo || pode_(eu, 'admin'); })
    .map(function (m) { return membroTela_(m, fotos); });
  // O financeiro também recebe o funil, para ver os fechamentos que ainda não viraram contrato.
  const comercial = temArea_(eu, 'comercial') || eu.financeiro;
  const social = temArea_(eu, 'social'), trafego = temArea_(eu, 'trafego');
  const contagem = {};
  if (comercial) ler_('comentarios').forEach(function (c) { contagem[c.oportunidadeId] = (contagem[c.oportunidadeId] || 0) + 1; });
  const soc = social ? dadosSocial_() : { marcas: [], pedidos: [], jornada: [], reports: [], igDiario: false, igUltimaRodada: '' };
  const fin = eu.financeiro ? dadosFinanceiro_() : { contratos: [], ajustes: [] };
  return {
    eu: eu,
    config: cfg,
    temChat: !!webhookChat_(),
    versao: VERSAO,
    hoje: hoje_(),
    urlApp: urlApp_(),
    online: presenca_(),
    equipe: equipe,
    clientes: ler_('clientes'),
    tarefas: ler_('tarefas'),
    oportunidades: comercial ? ler_('oportunidades') : [],
    propostas: comercial ? ler_('propostas') : [],
    comentarios: contagem,
    posts: social ? ler_('posts') : [],
    marcas: soc.marcas, pedidos: soc.pedidos, jornada: soc.jornada, reports: soc.reports, igDiario: soc.igDiario, igUltimaRodada: soc.igUltimaRodada,
    campanhas: trafego ? ler_('campanhas') : [],
    resultados: trafego ? ler_('resultados') : [],
    contratos: fin.contratos,
    ajustes: fin.ajustes,
    listas: { formatos: FORMATOS_POST, redes: REDES_POST, statusPost: STATUS_POST, plataformas: PLATAFORMAS, objetivos: OBJETIVOS, areas: AREAS, nomeArea: NOME_AREA, fasesContrato: FASES_CONTRATO, fasesEstrategia: FASES_ESTRATEGIA, tiposJornada: TIPOS_JORNADA },
  };
}
