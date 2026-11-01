/**
 * Leitura do PDF de relatório da Reportei.
 * O navegador extrai o texto do PDF (pdf.js) e manda para lerReportei(texto); aqui ele vira dados:
 * período, números do Instagram (seguidores, alcance orgânico e pago, visualizações, visitas, interações),
 * posts, reels e stories com as métricas de cada um, cidades, a análise escrita pela Reportei
 * (texto + ações sugeridas) e o bloco do LinkedIn. Nada é gravado: a tela mostra para a equipe conferir e salvar.
 */
const NUM_ = '(\\d[\\d.]*(?:,\\d+)?)';

// "3.617" -> 3617; "13,64" -> 13.64; "7,5%" -> 7.5
function numBr_(s) {
  const t = String(s == null ? '' : s).replace('%', '').trim();
  if (!t) return 0;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function dataBrIso_(s) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ''));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

function pega_(texto, re) { const m = re.exec(texto); return m ? numBr_(m[1]) : null; }

// Mês do relatório: o mês com mais dias dentro do período (09/09 a 09/10 é setembro).
function mesDoPeriodo_(ini, fim) {
  if (!ini || !fim) return '';
  const conta = {};
  for (let d = new Date(ini + 'T12:00:00Z'); d <= new Date(fim + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 7);
    conta[k] = (conta[k] || 0) + 1;
  }
  return Object.keys(conta).sort(function (a, b) { return conta[b] - conta[a] || (a < b ? -1 : 1); })[0] || '';
}

// Separa a análise escrita em texto corrido e ações (os itens com •).
function separarAnalise_(bloco) {
  const partes = String(bloco || '').split('•').map(function (x) { return x.trim(); }).filter(Boolean);
  if (!partes.length) return [];
  const analises = [];
  let atual = { texto: partes[0], acoes: [] };
  analises.push(atual);
  partes.slice(1).forEach(function (p) {
    // Um item termina na primeira frase depois do travessão; o que sobra (texto longo) abre a análise seguinte.
    const m = /^(.*?\s[—–-]\s.*?[.)]\.?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^•]{120,})$/.exec(p);
    if (m) {
      atual.acoes.push(m[1].trim());
      atual = { texto: m[2].trim(), acoes: [] };
      analises.push(atual);
    } else atual.acoes.push(p);
  });
  return analises;
}

function lerPostsIg_(trecho) {
  const re = new RegExp('(.+?)\\s(Carrossel|Imagem|Foto|Vídeo|Video|Reels?|Post)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_, 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      legenda: texto_(m[1].replace(/^.*?Compartilhamentos\s/, ''), 160), tipo: m[2], visualizacoes: numBr_(m[3]), alcance: numBr_(m[4]),
      interacoes: numBr_(m[5]), taxa: numBr_(m[6]), curtidas: numBr_(m[7]), comentarios: numBr_(m[8]), salvos: numBr_(m[9]), compartilhamentos: numBr_(m[10]),
    });
  }
  return out;
}

function lerReelsIg_(trecho) {
  const re = new RegExp('(.+?)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s(\\d{2}\\/\\d{2}\\/\\d{4})', 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      legenda: texto_(m[1].replace(/^.*?Criado em\s/, ''), 160), tipo: 'Reels', visualizacoes: numBr_(m[2]), alcance: numBr_(m[3]), interacoes: numBr_(m[4]),
      taxa: numBr_(m[5]), curtidas: numBr_(m[6]), comentarios: numBr_(m[7]), salvos: numBr_(m[8]), compartilhamentos: numBr_(m[9]), data: dataBrIso_(m[10]),
    });
  }
  return out;
}

function lerStoriesIg_(trecho) {
  const re = new RegExp('Visualizações:\\s' + NUM_ + '\\sAlcance:\\s' + NUM_ + '\\sInterações:\\s' + NUM_ + '\\sVisitas ao Perfil:\\s' + NUM_ +
    '\\sRespostas:\\s' + NUM_ + '\\sCompartilhamentos:\\s' + NUM_ + '\\sRetenção:\\s([\\d.,]+)%.*?Data:\\s(\\d{2}\\/\\d{2}\\/\\d{4})', 'g');
  const out = [];
  let m;
  while ((m = re.exec(trecho))) {
    out.push({
      visualizacoes: numBr_(m[1]), alcance: numBr_(m[2]), interacoes: numBr_(m[3]), visitasPerfil: numBr_(m[4]), respostas: numBr_(m[5]),
      compartilhamentos: numBr_(m[6]), retencao: numBr_(m[7]), data: dataBrIso_(m[8]),
    });
  }
  return out;
}

function lerCidades_(trecho) {
  const m = /Cidade Seguidores (.*?) Alcance das postagens/.exec(trecho);
  if (!m) return [];
  const out = [], re = /(.+?)\s(\d[\d.]*)(?=\s|$)/g;
  let x;
  while ((x = re.exec(m[1]))) out.push({ cidade: texto_(x[1], 80), seguidores: numBr_(x[2]) });
  return out.slice(0, 10);
}

function lerLinkedin_(trecho) {
  if (!trecho) return null;
  const li = {
    seguidores: pega_(trecho, new RegExp('Número atual de seguidores ' + NUM_)),
    posts: pega_(trecho, new RegExp('Número de postagens ' + NUM_)),
    alcance: pega_(trecho, new RegExp('Alcance ' + NUM_)),
    impressoes: pega_(trecho, new RegExp('Impressões ' + NUM_)),
    postagens: [],
  };
  const t = (/Taxa de engajamento (.*)$/.exec(trecho) || [])[1] || '';
  const re = new RegExp('(.+?)\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s' + NUM_ + '\\s([\\d.,]+)%', 'g');
  let m;
  while ((m = re.exec(t))) {
    li.postagens.push({
      legenda: texto_(m[1], 160), impressoes: numBr_(m[2]), alcance: numBr_(m[3]), compartilhamentos: numBr_(m[4]), curtidas: numBr_(m[5]),
      cliques: numBr_(m[6]), comentarios: numBr_(m[7]), taxa: numBr_(m[8]),
    });
  }
  return li;
}

// O pdf.js quebra palavras nas ligaduras da fonte da Reportei ("Int erações", "Dat a", "Compart ilhament os").
const REPAROS_ = [
  [/Compart ilhament os/g, 'Compartilhamentos'], [/Int era(ç(?:ões|ão))/g, 'Intera$1'], [/Visit as/g, 'Visitas'], [/Perf il/g, 'Perfil'],
  [/Respost as/g, 'Respostas'], [/Ret enção/g, 'Retenção'], [/St ory/g, 'Story'], [/Volt ar/g, 'Voltar'], [/Dat a:/g, 'Data:'],
  [/\b([Pp]er)f? ?il\b/g, '$1fil'], [/\b([Pp]er) l\b/g, '$1fil'], [/([A-Za-z]) ([ãõç]) ([a-zãõ])/g, '$1$2$3'], [/([a-zç]) ([ãõ]) ?(os?|es?)\b/g, '$1$2$3'], [/([çãõ]) (o|os|es)\b/g, '$1$2'], [/Curt idas/g, 'Curtidas'], [/Coment ários/g, 'Comentários'], [/Post agem/g, 'Postagem'], [/Número at ual/g, 'Número atual'],
  [/([a-zà-ú])ament (os?|as?)\b/g, '$1ament$2'],
];
function repararTexto_(t) {
  let s = String(t || '').replace(/[\u0000-\u0008\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ');
  REPAROS_.forEach(function (r) { s = s.replace(r[0], r[1]); });
  return s.trim();
}

// Lê o texto de um relatório da Reportei. Devolve null se o texto não for da Reportei.
function extrairReportei_(bruto) {
  const t = repararTexto_(bruto);
  const per = /analisados entre (\d{2}\/\d{2}\/\d{4}) e (\d{2}\/\d{2}\/\d{4})/.exec(t);
  if (!per && !/Reportei/i.test(t)) return null;
  const ini = per ? dataBrIso_(per[1]) : '', fim = per ? dataBrIso_(per[2]) : '';
  const iLi = t.indexOf('Número atual de seguidores');
  const ig = iLi >= 0 ? t.slice(0, iLi) : t, liTxt = iLi >= 0 ? t.slice(iLi) : '';
  const PER = '(?:.{0,60}?\\d{2}\\/\\d{2}\\/\\d{4} a \\d{2}\\/\\d{2}\\/\\d{4})?\\s';
  const r = {
    fonte: 'reportei', periodoIni: ini, periodoFim: fim, mes: mesDoPeriodo_(ini, fim),
    instagram: {
      seguidores: pega_(ig, new RegExp('Número de seguidores ' + NUM_)),
      alcanceOrganico: pega_(ig, new RegExp('Alcance Orgânico' + PER + NUM_)),
      visualizacoes: pega_(ig, new RegExp('Visualizações totais[^\\d]*?' + NUM_)),
      alcance: pega_(ig, new RegExp('Alcance total' + PER + NUM_)),
      alcancePago: pega_(ig, new RegExp('Alcance Pago' + PER + NUM_)),
      visitasPerfil: pega_(ig, new RegExp('Visitas do perfil ' + NUM_)),
      interacoes: pega_(ig, new RegExp('Interações totais ' + NUM_)),
      alcancePosts: pega_(ig, new RegExp('Alcance das postagens' + PER + NUM_)),
      alcanceReels: pega_(ig, new RegExp('Alcance dos reels' + PER + NUM_)),
      alcanceStories: pega_(ig, new RegExp('Alcance dos stories' + PER + NUM_)),
    },
    cidades: lerCidades_(ig),
    posts: [], reels: [], stories: [], analise: [], linkedin: lerLinkedin_(liTxt),
  };
  const iPosts = ig.indexOf('Dados orgânicos de postagens'), iDia = ig.indexOf('Melhor dia para postagens');
  if (iPosts >= 0) r.posts = lerPostsIg_(ig.slice(iPosts, iDia > iPosts ? iDia : undefined));
  const iReels = ig.indexOf('Reels em Destaque'), iSt = ig.indexOf('Alcance dos stories');
  if (iReels >= 0) r.reels = lerReelsIg_(ig.slice(iReels, iSt > iReels ? iSt : undefined));
  r.stories = lerStoriesIg_(ig);
  // A análise escrita vem depois do último story (ou da última tabela) e vai até o bloco do LinkedIn.
  const ultimoData = ig.lastIndexOf('Data: ');
  const iAnalise = ultimoData >= 0 ? ultimoData + 16 : (iDia >= 0 ? iDia : -1);
  if (iAnalise >= 0) r.analise = separarAnalise_(ig.slice(iAnalise).replace(/^\s*\d{4}\s*/, ''));
  return r;
}

// Chamado pela tela com o texto do PDF.
function lerReportei(texto) {
  exigir_('editor');
  const r = extrairReportei_(texto);
  if (!r) throw new Error('Este PDF não parece ser um relatório da Reportei.');
  return r;
}
