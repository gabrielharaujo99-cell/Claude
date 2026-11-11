/**
 * Central de Candidaturas — Gabriel Araujo
 * Web app (Apps Script) com os dados numa planilha do Google.
 * Na primeira execução cria a planilha "Central de Candidaturas" e preenche com os dados iniciais.
 */
const COLS = ["id", "empresa", "vaga", "etapa", "proxima_acao", "prazo", "data", "modelo", "canal", "contato", "notas", "fonte", "salario"];
const ETAPAS = ['Ação sua', 'Em processo', 'Aguardando', 'Encerrada'];
const SALARIOS = {};
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
    if (SEED.length) sh.getRange(2, 1, SEED.length, COLS.length).setValues(SEED.map(r => { const x = r.slice(0, COLS.length); while (x.length < COLS.length) x.push(SALARIOS[r[0]] || ''); return x; }));
    sh.setFrozenRows(1);
    sh.getRange(2, COLS.indexOf('etapa') + 1, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(ETAPAS, true).build());
  }
  const out = ss.getSheetByName('Candidaturas');
  migrar_(out);
  return out;
}

// Acrescenta colunas novas (ex.: salario) numa planilha criada por uma versão anterior.
function migrar_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  COLS.forEach(c => {
    if (head.indexOf(c) >= 0) return;
    const col = head.length + 1;
    sh.getRange(1, col).setValue(c).setFontWeight('bold');
    head.push(c);
    if (c === 'salario' && sh.getLastRow() > 1) {
      const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      sh.getRange(2, col, ids.length, 1).setValues(ids.map(r => [SALARIOS[r[0]] || '']));
    }
  });
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
  rec.id = 'c' + Date.now();
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(head.map(c => rec[c] || ''));
  return getData();
}

/* ===================== Configurações do usuário ===================== */
const VERSAO = '2.0';

function getConfig() {
  const p = PropertiesService.getUserProperties();
  return {
    temChave: !!p.getProperty('GEMINI_KEY'),
    cv: p.getProperty('CV') || '',
    perfil: JSON.parse(p.getProperty('PERFIL') || '{}'),
    versao: VERSAO
  };
}

function salvarConfig(cfg) {
  const p = PropertiesService.getUserProperties();
  if (cfg.key != null && String(cfg.key).trim()) p.setProperty('GEMINI_KEY', String(cfg.key).trim());
  if (cfg.removerChave) p.deleteProperty('GEMINI_KEY');
  if (cfg.cv != null) p.setProperty('CV', String(cfg.cv).slice(0, 8500));
  if (cfg.perfil != null) p.setProperty('PERFIL', JSON.stringify(cfg.perfil));
  return getConfig();
}

/* ===================== Agentes (Gemini) ===================== */
const SISTEMA = 'Você é o Bit, o copiloto de carreira do Órbita, um CRM de candidaturas. ' +
  'Responda em português do Brasil, direto e prático, como um headhunter sênior que conhece o mercado brasileiro e o internacional. ' +
  'Use Markdown simples: títulos com ##, listas com -, negrito com **. Não invente experiências, empresas, números ou certificações que não estejam no CV ou no texto do usuário; ' +
  'quando faltar informação, diga o que falta. Quando sugerir textos para o usuário enviar, escreva prontos para copiar.';

function ctx_() {
  const c = getConfig();
  const pf = c.perfil || {};
  return 'PERFIL DO USUÁRIO\n' +
    '- Cargo-alvo: ' + (pf.cargo || 'não informado') + '\n' +
    '- Senioridade: ' + (pf.senioridade || 'não informada') + '\n' +
    '- Modelo preferido: ' + (pf.modelo || 'não informado') + '\n' +
    '- Piso salarial: ' + (pf.piso || 'não informado') + '\n' +
    '- Idiomas: ' + (pf.idiomas || 'não informado') + '\n\n' +
    'CV DO USUÁRIO\n' + (c.cv || '(o usuário ainda não colou o CV em Ajustes)');
}

function resumoPipeline_() {
  try {
    const d = getData().rows;
    const por = {};
    d.forEach(r => { por[r.etapa] = (por[r.etapa] || 0) + 1; });
    const linhas = d.filter(r => r.etapa !== 'Encerrada').slice(0, 60)
      .map(r => '- ' + r.empresa + ' | ' + r.vaga + ' | ' + r.etapa + ' | aplicou ' + r.data + ' | próxima ação: ' + r.proxima_acao + (r.salario ? ' | salário: ' + r.salario : ''));
    return 'PIPELINE (' + d.length + ' candidaturas; ' + Object.keys(por).map(k => k + ': ' + por[k]).join(', ') + ')\n' + linhas.join('\n');
  } catch (e) { return ''; }
}

const PROMPTS = {
  vagas: e => ctx_() + '\n\nTAREFA: monte uma estratégia de busca de vagas.\nCargo desejado: ' + e.cargo + '\nLocal: ' + (e.local || 'Brasil') + '\nModelo: ' + (e.modelo || 'qualquer') + '\nObservações: ' + (e.extras || '—') +
    '\n\nEntregue: ## Títulos para buscar (10 variações em PT e EN, do mais ao menos óbvio)\n## Buscas booleanas prontas (LinkedIn e Google)\n## Empresas-alvo (15 nomes com 1 linha de por que combinam com o perfil; prefira empresas que contratam nesse modelo)\n## Onde mais procurar (plataformas, comunidades, recrutadores)\n## Rotina semanal de busca (curta).',
  fit: e => ctx_() + '\n\nTAREFA: avalie o encaixe do usuário com esta vaga.\nVAGA:\n' + e.vaga +
    '\n\nEntregue: ## Nota de encaixe (0 a 100) com uma frase de justificativa\n## Onde o perfil bate (com evidências do CV)\n## Lacunas e como contorná-las na entrevista\n## Palavras-chave de ATS que faltam no CV\n## Vale aplicar? (sim/não e por quê)\n## Pretensão sugerida (faixa, deixando claro que é estimativa)\n## Pergunta inteligente para fazer ao recrutador.',
  cv: e => ctx_() + '\n\nTAREFA: faça uma análise de CV nível ATS' + (e.alvo ? ' para o alvo: ' + e.alvo : '') + '.' + (e.cvExtra ? '\nUse este CV em vez do salvo:\n' + e.cvExtra : '') +
    '\n\nEntregue: ## Nota ATS (0 a 100)\n## Pontos fortes\n## Problemas (formato, clareza, métricas, palavras-chave)\n## Bullets reescritos (5 a 8, com verbo de ação e resultado, sem inventar números: use [X] onde faltar o dado)\n## Resumo profissional reescrito (3 linhas)\n## Checklist final.',
  mensagem: e => ctx_() + '\n\nTAREFA: escreva uma mensagem do tipo "' + e.tipo + '".\nPara: ' + (e.para || '—') + '\nEmpresa: ' + (e.empresa || '—') + '\nVaga: ' + (e.vaga || '—') + '\nContexto: ' + (e.contexto || '—') + '\nIdioma: ' + (e.idioma || 'português') +
    '\n\nEntregue duas versões (## Versão direta e ## Versão calorosa), cada uma pronta para copiar, curta (até 120 palavras), sem clichês.',
  entrevista: e => ctx_() + '\n\nTAREFA: prepare o usuário para a entrevista.\nEmpresa: ' + e.empresa + '\nVaga: ' + e.vaga + '\nEtapa: ' + (e.etapa || 'não informada') + (e.descricao ? '\nDescrição da vaga:\n' + e.descricao : '') +
    '\n\nEntregue: ## O que eles vão avaliar\n## 10 perguntas prováveis, cada uma com uma resposta no formato STAR baseada no CV (em tópicos curtos, para falar, não para ler)\n## Pitch de 30 segundos\n## 3 perguntas para fazer ao entrevistador\n## Armadilhas a evitar.',
  salario: e => ctx_() + '\n\nTAREFA: oriente a negociação salarial.\nVaga: ' + e.vaga + '\nEmpresa: ' + (e.empresa || '—') + '\nLocal/modelo: ' + (e.local || '—') + '\nTipo de contrato: ' + (e.contrato || 'CLT') + '\nProposta ou faixa conhecida: ' + (e.proposta || 'nenhuma') +
    '\n\nEntregue: ## Faixa de mercado estimada (deixe claro que é estimativa e de onde vem o raciocínio)\n## Quanto pedir e por quê (respeitando o piso do usuário)\n## Script de resposta para "qual sua pretensão?"\n## Script para contraproposta\n## O que negociar além do salário.',
  followup: e => ctx_() + '\n\n' + resumoPipeline_() + '\n\nTAREFA: escreva mensagens de follow-up para as candidaturas abaixo, que estão sem resposta. Uma por empresa, curta (até 70 palavras), educada e com um gancho de valor. Formato: ## Empresa — Vaga, depois a mensagem.\nCANDIDATURAS:\n' + e.lista,
  montarcv: e => ctx_() + '\n\nTAREFA: monte um CV completo, sob medida para a vaga abaixo, usando SOMENTE fatos do CV do usuário (reordene, reescreva e destaque o que importa para a vaga; use [X] onde faltar um número).' +
    '\nIdioma do CV: ' + (e.idioma || 'português') + '\nVAGA:\n' + (e.vaga || '(sem vaga: faça a melhor versão geral)') +
    '\n\nFormato EXATO em Markdown: primeira linha "# Nome completo", segunda linha com o título profissional em itálico (*...*), terceira linha com contatos separados por " · ". Depois as seções com ##: Resumo, Experiência (cada cargo com ### Cargo — Empresa · período, e bullets), Competências, Formação, Idiomas, Certificações (só se houver). No máximo 2 páginas. Sem comentários antes ou depois do CV.',
  linkedin: e => ctx_() + '\n\nTAREFA: otimize o perfil do LinkedIn para o objetivo: ' + (e.objetivo || 'cargo-alvo do perfil') + '.' + (e.atual ? '\nPerfil atual:\n' + e.atual : '') +
    '\n\nEntregue: ## 3 opções de título (headline, até 220 caracteres)\n## Sobre (texto pronto, até 1.800 caracteres, em primeira pessoa)\n## Experiência mais recente reescrita (bullets)\n## 20 competências para adicionar\n## Ajustes rápidos (banner, URL, Open to Work, recomendações).',
  empresa: e => ctx_() + '\n\nTAREFA: monte um dossiê da empresa ' + e.empresa + (e.vaga ? ' para a vaga ' + e.vaga : '') + '.' +
    '\nAVISO: você não tem acesso à internet; use o que sabe e diga explicitamente que pode estar desatualizado e o que o usuário deve conferir no site e no LinkedIn da empresa.' +
    '\n\nEntregue: ## O que a empresa faz\n## Modelo de negócio e clientes\n## Momento atual (com o aviso de data)\n## Como o perfil do usuário ajuda essa empresa\n## Perguntas para pesquisar antes da entrevista\n## Quem procurar no LinkedIn (cargos, não nomes).',
  plano: e => ctx_() + '\n\n' + resumoPipeline_() + '\n\nTAREFA: monte o plano da semana da busca de emprego, priorizando o que tem prazo e o que está em processo.' + (e.horas ? ' Tempo disponível por dia: ' + e.horas + '.' : '') + (e.foco ? ' Foco: ' + e.foco + '.' : '') +
    '\n\nEntregue: ## Prioridades da semana (top 5)\n## Segunda a sexta (tarefas concretas por dia, com empresa e ação)\n## Meta de candidaturas novas\n## O que parar de fazer.',
  chat: e => ctx_() + '\n\n' + resumoPipeline_() + '\n\nPERGUNTA DO USUÁRIO: ' + e.pergunta
};

function agente(tipo, entrada) {
  const key = PropertiesService.getUserProperties().getProperty('GEMINI_KEY');
  if (!key) throw new Error('Configure sua chave do Gemini em Ajustes para usar os agentes.');
  if (!PROMPTS[tipo]) throw new Error('Agente desconhecido: ' + tipo);
  const body = {
    systemInstruction: { parts: [{ text: SISTEMA }] },
    contents: [{ role: 'user', parts: [{ text: PROMPTS[tipo](entrada || {}) }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 4096 }
  };
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error('Gemini respondeu ' + code + ': ' + ((json.error && json.error.message) || 'erro desconhecido'));
  const c = json.candidates && json.candidates[0];
  const txt = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || '').join('') : '';
  if (!txt) throw new Error('O Gemini não devolveu texto. Tente de novo.');
  return txt;
}
