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
  garantirManutencao_();
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
  const rec = recorte_(eu, cfg);
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
    tarefas: rec.atuais.tarefas,
    oportunidades: rec.atuais.oportunidades,
    propostas: rec.atuais.propostas,
    comentarios: contagem,
    posts: rec.atuais.posts,
    antigos: {
      tarefas: rec.antigos.tarefas.length, oportunidades: rec.antigos.oportunidades.length, posts: rec.antigos.posts.length,
      desde: rec.desde,
    },
    marcas: soc.marcas, pedidos: soc.pedidos, jornada: soc.jornada, reports: soc.reports, igDiario: soc.igDiario, igUltimaRodada: soc.igUltimaRodada,
    campanhas: trafego ? ler_('campanhas') : [],
    resultados: trafego ? ler_('resultados') : [],
    contratos: fin.contratos,
    ajustes: fin.ajustes,
    listas: { formatos: FORMATOS_POST, redes: REDES_POST, statusPost: STATUS_POST, plataformas: PLATAFORMAS, objetivos: OBJETIVOS, areas: AREAS, nomeArea: NOME_AREA, fasesContrato: FASES_CONTRATO, fasesEstrategia: FASES_ESTRATEGIA, tiposJornada: TIPOS_JORNADA },
  };
}

/*
 * Abertura recortada: o que está encerrado há muito tempo fica fora do carregar e vem sob demanda (carregarAntigos).
 * Saem tarefas concluídas há 90+ dias, oportunidades fechadas ou arquivadas há 12+ meses com as suas propostas
 * (menos fee ainda em vigor, que entra no fee mensal da tela inicial, e as ligadas a tarefas que continuam na tela)
 * e posts publicados há 180+ dias. Cada pessoa recebe só o que as áreas dela já recebiam.
 */
const CORTE_DIAS_ = { tarefas: 90, oportunidades: 365, posts: 180 };

function recorte_(eu, cfg) {
  const desde = function (dias) { return new Date(Date.now() - dias * 864e5).toISOString(); };
  const corte = { tarefas: desde(CORTE_DIAS_.tarefas), oportunidades: desde(CORTE_DIAS_.oportunidades), posts: desde(CORTE_DIAS_.posts).slice(0, 10) };
  const comercial = temArea_(eu, 'comercial') || eu.financeiro, social = temArea_(eu, 'social');
  const tipo = {};
  cfg.etapas.forEach(function (e) { tipo[e.id] = e.tipo; });
  const out = { atuais: {}, antigos: {}, desde: { tarefas: corte.tarefas.slice(0, 10), oportunidades: corte.oportunidades.slice(0, 10), posts: corte.posts } };
  const separar = function (nome, lista, antigo) {
    out.atuais[nome] = []; out.antigos[nome] = [];
    lista.forEach(function (x) { out[antigo(x) ? 'antigos' : 'atuais'][nome].push(x); });
  };

  separar('tarefas', ler_('tarefas'), function (t) { return t.status === 'feito' && !!t.concluidoEm && t.concluidoEm < corte.tarefas; });
  const emUso = {};
  out.atuais.tarefas.forEach(function (t) { if (t.oportunidadeId) emUso[t.oportunidadeId] = true; });
  const feeEmVigor = function (o) {
    if (o.contrato !== 'fee' || !o.fechadoEm) return false;
    const fim = new Date(o.fechadoEm);
    fim.setMonth(fim.getMonth() + (o.meses || 0));
    return fim > new Date();
  };
  separar('oportunidades', comercial ? ler_('oportunidades') : [], function (o) {
    const t = tipo[o.etapa], encerrada = o.arquivado || t === 'ganho' || t === 'perdido';
    if (!encerrada || emUso[o.id] || (t === 'ganho' && !o.arquivado && feeEmVigor(o))) return false;
    const ref = o.fechadoEm || o.atualizadoEm || o.criadoEm;
    return !!ref && ref < corte.oportunidades;
  });
  const antigas = {};
  out.antigos.oportunidades.forEach(function (o) { antigas[o.id] = true; });
  separar('propostas', comercial ? ler_('propostas') : [], function (p) { return !!antigas[p.oportunidadeId]; });
  separar('posts', social ? ler_('posts') : [], function (p) { return p.status === 'publicado' && !!p.data && p.data < corte.posts; });
  return out;
}

// O que ficou fora da abertura, para a tela juntar quando a pessoa pedir (ou abrir um cliente).
function carregarAntigos() {
  const eu = exigir_('leitor');
  return recorte_(eu, config_()).antigos;
}
