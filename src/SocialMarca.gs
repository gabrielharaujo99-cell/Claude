/**
 * Social media por cliente: perfil de marca (persona, tom de voz, diretrizes, cultura, fase da estratégia, pilares e metas),
 * pedidos de próximos posts (backlog que vira pauta no calendário), jornada do cliente (feedbacks, ajustes, overdelivering)
 * e reports mensais do Instagram (números do PDF + análise, que alimentam o dashboard e a apresentação da reunião).
 * A verificação diária do Instagram lê a data da última postagem de cada cliente ativo.
 * Só quem tem a área "social" vê e mexe.
 */
const FASES_ESTRATEGIA = ['Criação de base', 'Fortalecimento de marca', 'Autoridade e educação', 'Captação de leads', 'Conversão e vendas', 'Retenção e comunidade'];
const TIPOS_JORNADA = ['feedback', 'ajuste', 'overdelivering', 'reuniao', 'marco', 'alerta'];
const STATUS_PEDIDO = ['pendente', 'alocado', 'descartado'];
// Campos do perfil de marca que, quando mudam, entram sozinhos na jornada do cliente.
const CAMPOS_MARCA_JORNADA = { persona: 'Persona', tomVoz: 'Tom de voz', diretrizes: 'Diretrizes de conteúdo', cultura: 'Cultura de marca', fase: 'Fase da estratégia',
  objetivo: 'Objetivo', publico: 'Público', palavrasUsar: 'Palavras que usamos', palavrasEvitar: 'Palavras que evitamos', frequencia: 'Frequência (posts/semana)',
  pilares: 'Pilares', status: 'Status' };

function textoMarca_(campo, v) {
  if (campo === 'pilares') return (v || []).map(function (p) { return p.nome + (p.meta ? ' ' + p.meta + '%' : ''); }).join(', ');
  return textoCampo_(v);
}

function limparPilares_(lista) {
  return (Array.isArray(lista) ? lista : []).map(function (p) {
    return { nome: texto_(p && p.nome, 40), meta: numero_(p && p.meta, 0, 100) };
  }).filter(function (p) { return p.nome; }).slice(0, 8);
}

function limparFormatosMeta_(o) {
  const out = {};
  FORMATOS_POST.forEach(function (f) { const n = numero_(o && o[f], 0, 100); if (n) out[f] = n; });
  return out;
}

function corHex_(v) { const s = texto_(v, 7); return /^#[0-9a-f]{6}$/i.test(s) ? s : ''; }

// Cria ou edita o perfil de marca. Mudanças nos campos estratégicos viram itens "ajuste" na jornada,
// ligados ao feedback que motivou a mudança (se informado).
function salvarMarca(d) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const clienteId = texto_(d.clienteId, 40);
    if (!clienteId || !achar_('clientes', clienteId)) throw new Error('Escolha o cliente.');
    const atual = achar_('marcas', clienteId);
    const has = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
    const pega = function (k, max) { return has(k) ? texto_(d[k], max) : (atual ? atual[k] : ''); };
    const m = {
      clienteId: clienteId,
      status: has('status') ? umDe_(d.status, ['ativo', 'pausa'], 'ativo') : (atual ? atual.status : 'ativo'),
      fase: has('fase') ? umDe_(d.fase, FASES_ESTRATEGIA, FASES_ESTRATEGIA[0]) : (atual ? atual.fase : FASES_ESTRATEGIA[0]),
      objetivo: pega('objetivo', 600), persona: pega('persona', 3000), tomVoz: pega('tomVoz', 2000), diretrizes: pega('diretrizes', 3000),
      cultura: pega('cultura', 2000), publico: pega('publico', 1000), diferenciais: pega('diferenciais', 1500),
      palavrasUsar: pega('palavrasUsar', 600), palavrasEvitar: pega('palavrasEvitar', 600), referencias: pega('referencias', 1500),
      concorrentes: pega('concorrentes', 600), hashtags: pega('hashtags', 600), aprovador: pega('aprovador', 120), redes: pega('redes', 200),
      linkDrive: has('linkDrive') ? url_(d.linkDrive) : (atual ? atual.linkDrive : ''),
      logoUrl: has('logoUrl') ? url_(d.logoUrl) : (atual ? atual.logoUrl : ''),
      corPrimaria: has('corPrimaria') ? corHex_(d.corPrimaria) : (atual ? atual.corPrimaria : ''),
      corSecundaria: has('corSecundaria') ? corHex_(d.corSecundaria) : (atual ? atual.corSecundaria : ''),
      frequencia: has('frequencia') ? numero_(d.frequencia, 0, 50) : (atual ? atual.frequencia : 0),
      pilares: has('pilares') ? limparPilares_(d.pilares) : (atual ? atual.pilares : []),
      formatosMeta: has('formatosMeta') ? limparFormatosMeta_(d.formatosMeta) : (atual ? atual.formatosMeta : {}),
      inicio: has('inicio') ? dataIso_(d.inicio) : (atual ? atual.inicio : ''),
      atualizadoEm: agora_(), atualizadoPor: eu.email,
    };
    if (!atual) {
      const novo = inserir_('marcas', m);
      registrarJornada_(eu, clienteId, 'marco', 'Início da gestão de social media', 'Perfil de marca criado. Fase: ' + m.fase + '.', '', '', '', '');
      return novo;
    }
    const r = atualizar_('marcas', clienteId, m);
    const feedbackId = texto_(d.feedbackId, 40), motivo = feedbackId ? achar_('jornada', feedbackId) : null;
    Object.keys(CAMPOS_MARCA_JORNADA).forEach(function (c) {
      const a = textoMarca_(c, r.antes[c]), b = textoMarca_(c, r.depois[c]);
      if (a === b) return;
      registrarJornada_(eu, clienteId, 'ajuste', CAMPOS_MARCA_JORNADA[c] + ' atualizado',
        motivo ? 'Depois do feedback: ' + motivo.titulo : texto_(d.motivo, 300), c, a, b, motivo ? motivo.id : '');
    });
    return r.depois;
  });
}

function registrarJornada_(eu, clienteId, tipo, titulo, texto, campo, de, para, refId) {
  return inserir_('jornada', {
    id: novoId_('jo'), clienteId: clienteId, data: hoje_(), tipo: tipo, titulo: texto_(titulo, 160), texto: texto_(texto, 3000),
    campo: campo || '', de: texto_(de, 2000), para: texto_(para, 2000), sentimento: '', refId: refId || '', autor: eu ? eu.email : '', criadoEm: agora_(),
  });
}

function salvarJornada(d) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const j = {
      clienteId: texto_(d.clienteId, 40), data: dataIso_(d.data) || hoje_(), tipo: umDe_(d.tipo, TIPOS_JORNADA, 'feedback'),
      titulo: texto_(d.titulo, 160), texto: texto_(d.texto, 3000), sentimento: umDe_(d.sentimento, ['positivo', 'neutro', 'negativo'], ''),
    };
    if (!j.clienteId || !achar_('clientes', j.clienteId)) throw new Error('Escolha o cliente.');
    if (!j.titulo) throw new Error('Dê um título para o registro.');
    if (!d.id) return inserir_('jornada', Object.assign(j, { id: novoId_('jo'), campo: '', de: '', para: '', refId: '', autor: eu.email, criadoEm: agora_() }));
    const atual = achar_('jornada', d.id);
    if (!atual) throw new Error('Registro não encontrado. Recarregue a página.');
    return atualizar_('jornada', d.id, j).depois;
  });
}

function removerJornada(id) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const j = achar_('jornada', id);
    if (!j) return true;
    if (j.autor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem registrou ou um gestor pode apagar.');
    return remover_('jornada', id);
  });
}

// ---------- pedidos de próximos posts ----------
function salvarPedido(d) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const p = {
      clienteId: texto_(d.clienteId, 40), titulo: texto_(d.titulo, 160), descricao: texto_(d.descricao, 2000),
      origem: umDe_(d.origem, ['cliente', 'ideia'], 'ideia'), formato: umDe_(d.formato, FORMATOS_POST, ''), pilar: texto_(d.pilar, 40),
      prioridade: umDe_(d.prioridade, ['alta', 'normal', 'baixa'], 'normal'), prazo: dataIso_(d.prazo), atualizadoEm: agora_(),
    };
    if (!p.clienteId || !achar_('clientes', p.clienteId)) throw new Error('Escolha o cliente.');
    if (!p.titulo) throw new Error('Descreva o pedido.');
    if (!d.id) return inserir_('pedidos', Object.assign(p, { id: novoId_('pe'), status: 'pendente', postId: '', criadoPor: eu.email, criadoEm: p.atualizadoEm }));
    if (!achar_('pedidos', d.id)) throw new Error('Pedido não encontrado. Recarregue a página.');
    return atualizar_('pedidos', d.id, p).depois;
  });
}

// Coloca o pedido no calendário: vira um conteúdo na pauta com a data escolhida.
function alocarPedido(id, data, responsavel) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const pe = achar_('pedidos', texto_(id, 40));
    if (!pe) throw new Error('Pedido não encontrado. Recarregue a página.');
    if (pe.status === 'alocado') throw new Error('Este pedido já está no calendário.');
    const dia = dataIso_(data);
    if (!dia) throw new Error('Escolha o dia do calendário.');
    const agora = agora_();
    const post = inserir_('posts', {
      id: novoId_('po'), clienteId: pe.clienteId, titulo: pe.titulo, formato: pe.formato || 'Post', rede: 'Instagram', status: 'pauta',
      data: dia, hora: '', responsavel: membroAtivo_(email_(responsavel)) ? email_(responsavel) : eu.email, legenda: '', link: '',
      obs: [pe.origem === 'cliente' ? 'Pedido do cliente.' : 'Ideia da equipe.', pe.descricao].filter(Boolean).join(' '),
      pilar: pe.pilar, criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
    });
    const pedido = atualizar_('pedidos', pe.id, { status: 'alocado', postId: post.id, atualizadoEm: agora }).depois;
    return { pedido: pedido, post: post };
  });
}

function descartarPedido(id, voltar) {
  exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const pe = achar_('pedidos', texto_(id, 40));
    if (!pe) throw new Error('Pedido não encontrado. Recarregue a página.');
    return atualizar_('pedidos', pe.id, { status: voltar ? 'pendente' : 'descartado', postId: voltar ? '' : pe.postId, atualizadoEm: agora_() }).depois;
  });
}

function removerPedido(id) {
  const eu = exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const pe = achar_('pedidos', id);
    if (!pe) return true;
    if (pe.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar.');
    return remover_('pedidos', id);
  });
}

// ---------- reports mensais ----------
const CAMPOS_REPORT_NUM = ['seguidores', 'novosSeguidores', 'alcance', 'impressoes', 'interacoes', 'engajamento', 'visitasPerfil', 'cliquesLink', 'postsPublicados'];

// Salva os números do mês (lidos do PDF e conferidos pela equipe) e a análise. O PDF vai para o Drive, se der.
function salvarReport(d) {
  const eu = exigirArea_('social', 'colaborador');
  d = d || {};
  let arquivo = null;
  if (d.pdf && d.pdf.base64) arquivo = guardarPdf_(d.pdf);
  return comTrava_(function () {
    const r = { clienteId: texto_(d.clienteId, 40), mes: /^\d{4}-\d{2}$/.test(texto_(d.mes, 7)) ? texto_(d.mes, 7) : '' };
    if (!r.clienteId || !achar_('clientes', r.clienteId)) throw new Error('Escolha o cliente.');
    if (!r.mes) throw new Error('Informe o mês do report.');
    CAMPOS_REPORT_NUM.forEach(function (c) { r[c] = numero_(d[c], 0); });
    ['destaques', 'resultados', 'ajustes', 'proximosPassos'].forEach(function (c) { r[c] = texto_(d[c], 3000); });
    r.atualizadoEm = agora_();
    if (arquivo) { r.arquivoUrl = arquivo.url; r.arquivoNome = arquivo.nome; }
    const igual = ler_('reports').filter(function (x) { return x.clienteId === r.clienteId && x.mes === r.mes && x.id !== d.id; })[0];
    if (igual) throw new Error('Já existe um report de ' + r.mes + ' para este cliente. Abra o existente para editar.');
    if (!d.id) return inserir_('reports', Object.assign(r, { id: novoId_('rp'), criadoPor: eu.email, criadoEm: r.atualizadoEm }));
    if (!achar_('reports', d.id)) throw new Error('Report não encontrado. Recarregue a página.');
    return atualizar_('reports', d.id, r).depois;
  });
}

function guardarPdf_(pdf) {
  try {
    const bytes = Utilities.base64Decode(String(pdf.base64));
    if (bytes.length > 15 * 1024 * 1024) throw new Error('grande');
    const nome = texto_(pdf.nome, 120) || 'report.pdf';
    const nomePasta = config_().produto + ' · Reports';
    const pastas = DriveApp.getFoldersByName(nomePasta);
    const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder(nomePasta);
    const f = pasta.createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
    return { url: f.getUrl(), nome: nome };
  } catch (e) {
    return null; // sem permissão do Drive: os números continuam salvos
  }
}

function removerReport(id) {
  exigirArea_('social', 'gestor');
  return comTrava_(function () { return remover_('reports', id); });
}

// ---------- Instagram: data da última postagem ----------
function usuarioInsta_(v) {
  return String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();
}

// Lê o perfil público. O Instagram pode bloquear leituras automáticas: nesse caso fica o erro e a data anterior.
function lerInstagram_(usuario) {
  const resp = UrlFetchApp.fetch('https://i.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(usuario), {
    muteHttpExceptions: true, followRedirects: true,
    headers: { 'x-ig-app-id': '936619743392459', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0', 'Accept': 'application/json' },
  });
  const cod = resp.getResponseCode();
  if (cod === 404) throw new Error('perfil não encontrado');
  if (cod !== 200) throw new Error('o Instagram recusou a leitura (' + cod + ')');
  let j;
  try { j = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('resposta inesperada do Instagram'); }
  const u = j && j.data && j.data.user;
  if (!u) throw new Error('perfil privado ou indisponível');
  const posts = ((u.edge_owner_to_timeline_media || {}).edges || []).map(function (e) { return Number(e.node.taken_at_timestamp) * 1000; })
    .filter(function (t) { return t > 0; }).sort(function (a, b) { return b - a; });
  const tz = Session.getScriptTimeZone(), mes = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  const doMes = posts.filter(function (t) { return Utilities.formatDate(new Date(t), tz, 'yyyy-MM') === mes; }).length;
  return {
    ultimo: posts.length ? Utilities.formatDate(new Date(posts[0]), tz, 'yyyy-MM-dd') : '',
    noMes: doMes, completo: doMes < posts.length || posts.length < 12,
    seguidores: Number((u.edge_followed_by || {}).count) || 0,
  };
}

function verificarInstagramDe_(m, cliente) {
  const usuario = usuarioInsta_(cliente && cliente.instagram);
  const patch = { igVerificadoEm: agora_() };
  if (!usuario) { patch.igErro = 'cadastre o @ do Instagram no cliente'; return atualizar_('marcas', m.clienteId, patch).depois; }
  try {
    const r = lerInstagram_(usuario);
    Object.assign(patch, { igUltimoPost: r.ultimo || m.igUltimoPost, igPostsMes: r.noMes + (r.completo ? '' : '+'), igSeguidores: r.seguidores || m.igSeguidores, igErro: '' });
  } catch (e) {
    patch.igErro = texto_(e.message, 200);
  }
  return atualizar_('marcas', m.clienteId, patch).depois;
}

// Botão "verificar agora" de um cliente, ou de todos os ativos.
function verificarInstagram(clienteId) {
  exigirArea_('social', 'colaborador');
  return comTrava_(function () {
    const marcas = ler_('marcas').filter(function (m) { return clienteId ? m.clienteId === clienteId : m.status !== 'pausa'; });
    return marcas.map(function (m) { return verificarInstagramDe_(m, achar_('clientes', m.clienteId)); });
  });
}

// Rodada pelo gatilho diário (sem usuário na tela).
function verificarInstagramDiario() {
  comTrava_(function () {
    ler_('marcas').filter(function (m) { return m.status !== 'pausa'; }).forEach(function (m) { verificarInstagramDe_(m, achar_('clientes', m.clienteId)); });
    salvarConfigChave_('igUltimaRodada', agora_());
  });
}

function salvarConfigChave_(chave, valor) {
  if (achar_('config', chave)) atualizar_('config', chave, { valor: valor });
  else inserir_('config', { chave: chave, valor: valor });
}

function gatilhoInstagramAtivo_() {
  try { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'verificarInstagramDiario'; }); } catch (e) { return false; }
}

// Liga (ou desliga) a verificação todo dia às 7h.
function ligarVerificacaoInstagram(ligar) {
  exigirArea_('social', 'gestor');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'verificarInstagramDiario') ScriptApp.deleteTrigger(t); });
  if (ligar !== false) ScriptApp.newTrigger('verificarInstagramDiario').timeBased().everyDays(1).atHour(7).create();
  return gatilhoInstagramAtivo_();
}

// O que a tela de social recebe a mais no carregar().
function dadosSocial_() {
  const cfg = achar_('config', 'igUltimaRodada');
  return {
    marcas: ler_('marcas'), pedidos: ler_('pedidos'), jornada: ler_('jornada'), reports: ler_('reports'),
    igDiario: gatilhoInstagramAtivo_(), igUltimaRodada: cfg ? cfg.valor : '',
  };
}
