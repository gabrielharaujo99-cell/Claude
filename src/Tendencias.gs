/**
 * Tendências do nicho de cada cliente (bloco "Tendências" do quadro da social).
 * Com a chave da Anthropic (propriedade do script ANTHROPIC_API_KEY), o Claude pesquisa na web — redes sociais,
 * blogs, YouTube e notícias — e devolve assuntos em alta com o porquê e uma ideia de post.
 * Sem a chave, busca as manchetes do Google Notícias sobre o nicho (grátis, só notícias).
 * O que vem entra como itens "tendência" do cliente, sem repetir títulos já guardados.
 */
const TEND_MODELO_ = 'claude-opus-5-5';

function tendenciasClaude_(nicho, chave, cliente) {
  const pedido =
    'Você ajuda uma agência de social media a planejar posts para o cliente "' + cliente + '", do nicho: ' + nicho + '.\n' +
    'Pesquise na web o que está em alta AGORA nesse nicho no Brasil (últimas 2 a 4 semanas): redes sociais (Instagram, TikTok, LinkedIn), ' +
    'blogs e portais do setor, YouTube e notícias. Escolha de 5 a 8 assuntos com potencial real de post.\n' +
    'Responda só com JSON, sem texto antes ou depois, no formato: ' +
    '{"tendencias":[{"titulo":"...","porque":"por que está em alta, com dado ou fato","ideia":"ideia de post concreta (formato + gancho)","fonte":"site ou rede","link":"https://..."}]}';
  let mensagens = [{ role: 'user', content: pedido }];
  // A pesquisa pode pausar no meio (pause_turn): repete com o que já veio, até 3 vezes.
  for (let i = 0; i < 3; i++) {
    const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      payload: JSON.stringify({
        model: TEND_MODELO_, max_tokens: 16000, fallbacks: 'default',
        output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6, user_location: { type: 'approximate', country: 'BR' } }],
        messages: mensagens,
      }),
    });
    const cod = resp.getResponseCode();
    let j;
    try { j = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('Resposta inesperada da IA (' + cod + ').'); }
    if (cod >= 400) throw new Error('A IA recusou a pesquisa (' + cod + '): ' + (j.error && j.error.message || ''));
    if (j.stop_reason === 'refusal') throw new Error('A IA não quis pesquisar esse tema. Ajuste o nicho do cliente.');
    if (j.stop_reason === 'pause_turn') { mensagens = mensagens.concat([{ role: 'assistant', content: j.content }]); continue; }
    const texto = (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
    const ini = texto.indexOf('{'), fim = texto.lastIndexOf('}');
    if (ini < 0 || fim < ini) throw new Error('A IA não devolveu a lista de tendências. Tente de novo.');
    let dados;
    try { dados = JSON.parse(texto.slice(ini, fim + 1)); } catch (e) { throw new Error('A IA devolveu a lista num formato inválido. Tente de novo.'); }
    return (dados.tendencias || []).map(function (t) {
      return { titulo: t.titulo, descricao: [t.porque, t.ideia ? 'Ideia: ' + t.ideia : ''].filter(Boolean).join(' '), fonte: t.fonte, link: t.link };
    });
  }
  throw new Error('A pesquisa demorou demais. Tente de novo.');
}

// Sem chave da IA: manchetes recentes do Google Notícias sobre o nicho.
function tendenciasNoticias_(nicho) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(nicho + ' when:14d') + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() >= 400) throw new Error('O Google Notícias não respondeu (' + resp.getResponseCode() + ').');
  const xml = resp.getContentText(), itens = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  const tag = function (bloco, nome) { const x = new RegExp('<' + nome + '[^>]*>([\\s\\S]*?)<\\/' + nome + '>').exec(bloco); return x ? x[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : ''; };
  while ((m = re.exec(xml)) && itens.length < 8) {
    const titulo = tag(m[1], 'title'), fonte = tag(m[1], 'source');
    itens.push({ titulo: titulo.replace(new RegExp('\\s+-\\s+' + fonte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''), descricao: 'Em alta nas notícias.', fonte: fonte || 'Google Notícias', link: tag(m[1], 'link') });
  }
  return itens;
}

function pesquisarTendencias(clienteId) {
  const eu = exigirArea_('social', 'colaborador');
  const m = achar_('marcas', texto_(clienteId, 40)), c = achar_('clientes', texto_(clienteId, 40));
  if (!m || !c) throw new Error('Crie o perfil de marca do cliente antes.');
  const nicho = texto_(m.nicho, 200) || texto_(c.segmento, 60);
  if (!nicho) throw new Error('Defina o nicho do cliente em Configurar quadro.');
  const chave = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  const achados = chave ? tendenciasClaude_(nicho, chave, c.nome) : tendenciasNoticias_(nicho);
  return comTrava_(function () {
    const ja = {};
    ler_('temas').filter(function (t) { return t.clienteId === c.id && t.tipo === 'tendencia'; }).forEach(function (t) { ja[normalizar_(t.titulo)] = true; });
    const ordens = ler_('temas').filter(function (t) { return t.clienteId === c.id && t.tipo === 'tendencia'; }).map(function (t) { return t.ordem; });
    let ordem = ordens.length ? Math.max.apply(null, ordens) : 0;
    const agora = agora_();
    const novos = achados.filter(function (t) { return texto_(t.titulo, 200) && !ja[normalizar_(t.titulo)]; }).slice(0, 10).map(function (t) {
      ja[normalizar_(t.titulo)] = true;
      return inserir_('temas', {
        id: novoId_('tm'), clienteId: c.id, tipo: 'tendencia', titulo: texto_(t.titulo, 200), descricao: texto_(t.descricao, 2000), ordem: ++ordem,
        status: 'mapeado', fonte: texto_(t.fonte, 120) || (chave ? 'Pesquisa com IA' : 'Google Notícias'), link: url_(t.link), postId: '',
        criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
      });
    });
    return { novos: novos, fonte: chave ? 'ia' : 'noticias' };
  });
}

// Admin: guarda (ou apaga) a chave da Anthropic usada na pesquisa de tendências.
function salvarChaveIA(chave) {
  exigir_('admin');
  const k = texto_(chave, 300), p = PropertiesService.getScriptProperties();
  if (k && !/^sk-ant-/.test(k)) throw new Error('A chave da Anthropic começa com sk-ant-.');
  if (k) p.setProperty('ANTHROPIC_API_KEY', k); else p.deleteProperty('ANTHROPIC_API_KEY');
  return !!k;
}

function temChaveIA() { exigirArea_('social', 'leitor'); return !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY'); }
