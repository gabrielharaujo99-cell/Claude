/**
 * Revisor de propostas (como o do Be Flow, adaptado para agência).
 * 1) Regras (sempre funciona): seções que toda proposta de agência precisa, marcadores esquecidos,
 *    linguagem que abre escopo, nome de outro cliente, valor diferente do cadastrado e datas vencidas.
 * 2) IA (opcional, com a chave da Anthropic): um parecer redigido com pontos fortes, problemas e sugestões.
 * O texto vem do Google Docs (pelo link da proposta), de um PDF lido no navegador ou colado à mão.
 */
const REV_SECOES_AG_ = [
  { nome: 'Objetivo / contexto', re: /objetivo|contexto|desafio|cen[aá]rio/i, peso: 10 },
  { nome: 'Escopo e entregáveis', re: /escopo|entreg[aá]ve|o que (vamos|faremos|est[aá] inclu)|servi[cç]os inclu/i, peso: 16 },
  { nome: 'Fora do escopo', re: /fora do escopo|n[aã]o (est[aá]|est[aã]o) inclu|n[aã]o inclui|exclus[oõ]es/i, peso: 10 },
  { nome: 'Prazo / cronograma', re: /prazo|cronograma|etapas|semanas|calend[aá]rio de entrega/i, peso: 10 },
  { nome: 'Investimento', re: /investimento|valor|pre[cç]o|R\$\s?\d/i, peso: 14 },
  { nome: 'Forma de pagamento', re: /pagamento|parcel|boleto|pix|faturamento|nota fiscal/i, peso: 8 },
  { nome: 'Rodadas de ajuste / aprovação', re: /rodadas?|revis[oõ]es|ajustes|altera[cç][oõ]es|aprova[cç][aã]o/i, peso: 10 },
  { nome: 'Validade da proposta', re: /validade|v[aá]lida (at[eé]|por)/i, peso: 8 },
  { nome: 'Próximos passos', re: /pr[oó]ximos passos|para come[cç]ar|como seguimos|aceite/i, peso: 8 },
];
const REV_MARCADORES_ = /\b(TBD|XXX+|lorem ipsum|a definir|preencher|\[\s*[^\]]{0,20}\s*\]|\{\{[^}]*\}\})/gi;
const REV_ABRE_ESCOPO_ = [/ilimitad[oa]s?/i, /quantas? (vezes|forem) necess[aá]ri/i, /sempre que necess[aá]rio/i, /entre outros/i, /\betc\.?/i, /o que o cliente precisar/i, /sem limite/i, /todas? as redes/i];

function revisarTexto_(texto, p, op, cfg) {
  const t = String(texto || '');
  const achados = [];
  const secoes = REV_SECOES_AG_.map(function (s) { return { nome: s.nome, ok: s.re.test(t), peso: s.peso }; });
  secoes.filter(function (s) { return !s.ok; }).forEach(function (s) {
    achados.push({ sev: s.peso >= 14 ? 'alto' : 'medio', secao: s.nome, problema: 'Não encontrei a seção "' + s.nome + '".', sugestao: 'Inclua um bloco de ' + s.nome.toLowerCase() + '.' });
  });
  const marc = t.match(REV_MARCADORES_) || [];
  if (marc.length) achados.push({ sev: 'critico', secao: 'Marcadores', problema: marc.length + ' trecho(s) ainda com marcador de preenchimento (ex.: "' + marc[0] + '").', sugestao: 'Troque todos os marcadores antes de enviar.' });
  REV_ABRE_ESCOPO_.forEach(function (re) {
    const m = re.exec(t);
    if (m) achados.push({ sev: 'medio', secao: 'Escopo', problema: 'Linguagem que abre escopo: "' + m[0] + '".', sugestao: 'Troque por quantidades e limites claros (ex.: 12 posts por mês, 2 rodadas de ajuste).' });
  });
  // Nome de outro cliente esquecido (copiar e colar de proposta antiga).
  const meu = op ? normalizar_(nomeCliente_(op.clienteId)) : '';
  const tn = normalizar_(t);
  ler_('clientes').forEach(function (c) {
    const n = normalizar_(c.nome);
    if (n.length >= 4 && n !== meu && tn.indexOf(n) >= 0) achados.push({ sev: 'critico', secao: 'Outro cliente', problema: 'O texto cita "' + c.nome + '", que é outro cliente.', sugestao: 'Confira se é resto de outra proposta.' });
  });
  // Valores: o valor da proposta (ou da oportunidade) precisa aparecer no texto.
  const ref = p && p.valor ? p.valor : op ? (op.contrato === 'fee' ? op.valor : op.valor) : 0;
  const valores = (t.match(/R\$\s?\d[\d.]*(?:,\d{2})?/g) || []).map(function (v) { return numBr_(v.replace(/R\$\s?/, '')); });
  if (ref && valores.length && valores.indexOf(ref) < 0) achados.push({ sev: 'alto', secao: 'Investimento', problema: 'Nenhum valor do texto bate com o cadastrado (R$ ' + ref.toLocaleString('pt-BR') + ').', sugestao: 'Confira se o valor do documento e o do CRM estão iguais.' });
  // Datas vencidas.
  const hoje = hoje_();
  const vencidas = (t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || []).filter(function (d) { return dataBrIso_(d) < hoje; });
  if (vencidas.length) achados.push({ sev: 'baixo', secao: 'Datas', problema: vencidas.length + ' data(s) já passaram (ex.: ' + vencidas[0] + ').', sugestao: 'Atualize prazos e validade.' });
  const pesoTotal = REV_SECOES_AG_.reduce(function (a, s) { return a + s.peso; }, 0);
  let nota = Math.round(secoes.filter(function (s) { return s.ok; }).reduce(function (a, s) { return a + s.peso; }, 0) * 100 / pesoTotal);
  nota -= achados.filter(function (a) { return a.sev === 'critico'; }).length * 15 + achados.filter(function (a) { return a.sev === 'alto' && a.secao !== 'Escopo e entregáveis' && a.secao !== 'Investimento'; }).length * 5;
  nota = Math.max(0, Math.min(100, nota));
  const ordem = { critico: 0, alto: 1, medio: 2, baixo: 3 };
  achados.sort(function (a, b) { return ordem[a.sev] - ordem[b.sev]; });
  return { nota: nota, veredito: nota >= 85 && !achados.some(function (a) { return a.sev === 'critico'; }) ? 'Pronta para enviar' : nota >= 60 ? 'Ajustes antes de enviar' : 'Revisão necessária',
    secoes: secoes, achados: achados, palavras: (t.match(/\S+/g) || []).length };
}

function parecerIA_(texto, chave, cliente) {
  const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify({
      model: 'claude-opus-5-5', max_tokens: 4000, fallbacks: 'default', output_config: { effort: 'low' },
      system: 'Você revisa propostas comerciais de uma agência de marketing e social media antes do envio ao cliente. Seja direto e prático, em português do Brasil.',
      messages: [{ role: 'user', content: 'Revise a proposta abaixo para o cliente "' + cliente + '". Responda em até 12 linhas: 3 pontos fortes, os principais problemas (escopo vago, preço, prazos, clareza) e as mudanças sugeridas.\n\n<proposta>\n' + String(texto).slice(0, 60000) + '\n</proposta>' }],
    }),
  });
  let j;
  try { j = JSON.parse(resp.getContentText()); } catch (e) { return { erro: 'resposta inesperada da IA' }; }
  if (resp.getResponseCode() >= 400) return { erro: (j.error && j.error.message) || 'a IA recusou o pedido' };
  if (j.stop_reason === 'refusal') return { erro: 'a IA não quis revisar este texto' };
  return { texto: (j.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n').trim() };
}

function nomeCliente_(id) { const c = id ? achar_('clientes', id) : null; return c ? c.nome : ''; }

// Texto do Google Docs pelo link da proposta (precisa do escopo de leitura de documentos).
function textoDoDocs_(url) {
  if (!/docs\.google\.com\/document\//.test(url || '')) return '';
  try { return DocumentApp.openByUrl(url).getBody().getText(); } catch (e) { throw new Error('Não consegui abrir o Google Docs (' + e.message + '). Cole o texto ou envie o PDF.'); }
}

function revisarProposta(propostaId, texto, usarIA) {
  const eu = exigirArea_('comercial', 'colaborador');
  const p = achar_('propostas', texto_(propostaId, 40));
  if (!p) throw new Error('Proposta não encontrada. Recarregue a página.');
  const op = achar_('oportunidades', p.oportunidadeId);
  let t = texto_(texto, 200000);
  if (!t) t = textoDoDocs_(p.url);
  if (!t || t.length < 200) throw new Error('Preciso do texto da proposta: cole o texto, envie o PDF ou use um link do Google Docs.');
  const r = revisarTexto_(t, p, op, config_());
  const chave = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  r.ia = usarIA ? (chave ? parecerIA_(t, chave, op ? nomeCliente_(op.clienteId) : '') : { erro: 'configure a chave da IA (Social › Configurar quadro, admin)' }) : null;
  r.quando = agora_();
  r.por = eu.nome;
  return comTrava_(function () { return atualizar_('propostas', p.id, { revisao: r }).depois; });
}
