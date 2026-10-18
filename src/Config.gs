/**
 * Configuração da agência: marca (cores, fontes, logo), funil, listas e avisos.
 * Fica numa linha da aba "config" (chave "app") como JSON. O webhook de chat fica nas
 * propriedades do script, porque a configuração vai para a tela de todo mundo.
 */
// Padrão neutro do Flowloop, para qualquer agência. Tudo é editável no Admin.
// O perfil de uma agência específica (nome, logo, listas) pode vir em CONFIG_AGENCIA, num arquivo fora do Git
// privado da instalação: vale como padrão daquela instalação, e o que for salvo no Admin continua por cima.
const PRODUTO = 'Flowloop';
const CONFIG_PADRAO = {
  empresa: 'Sua agência',
  produto: PRODUTO,
  marca: {
    logoUrl: '',
    logoParticulas: '', // logo embutido (data:image/...) que as partículas desenham; vazio = iniciais da agência
    primaria: '#141A0F',
    destaque: '#A9511F',
    fundo: '#F7F3EC',
    superficie: '#FCFAF6',
    texto: '#20211C',
    fonteTitulos: 'Fraunces',
    fonteTexto: 'Manrope',
    raio: 14,
  },
  moeda: 'BRL',
  diasParado: 5,
  emailAvisos: true,
  dominio: '',
  entradaAutomatica: false,
  etapas: [
    { id: 'lead', nome: 'Lead', tipo: 'aberta', prob: 10, cor: '#A39E8F' },
    { id: 'diagnostico', nome: 'Diagnóstico', tipo: 'aberta', prob: 25, cor: '#8C9A7E' },
    { id: 'proposta', nome: 'Proposta enviada', tipo: 'aberta', prob: 50, cor: '#C9A27A' },
    { id: 'negociacao', nome: 'Negociação', tipo: 'aberta', prob: 75, cor: '#D08A4E' },
    { id: 'ganho', nome: 'Fechado', tipo: 'ganho', prob: 100, cor: '#5E7A4A' },
    { id: 'perdido', nome: 'Perdido', tipo: 'perdido', prob: 0, cor: '#B5654A' },
  ],
  servicos: ['Assessoria completa', 'Social media', 'Tráfego pago', 'Branding', 'Site / Landing page', 'Produção de vídeo', 'Consultoria'],
  origens: ['Indicação', 'Instagram', 'Site', 'Tráfego pago', 'Prospecção ativa', 'Evento', 'LinkedIn'],
  motivosPerda: ['Preço', 'Escolheu concorrente', 'Fora do perfil', 'Sem resposta', 'Momento errado'],
  segmentos: ['Saúde', 'Varejo', 'Serviços', 'Alimentação', 'Educação', 'Imobiliário', 'Indústria'],
};

// Padrão desta instalação: o neutro, com o perfil da agência (CONFIG_AGENCIA) por cima, se existir.
function padraoConfig_() {
  const c = copia_(CONFIG_PADRAO);
  const ag = typeof CONFIG_AGENCIA !== 'undefined' && CONFIG_AGENCIA ? CONFIG_AGENCIA : {};
  Object.keys(ag).forEach(function (k) { if (k !== 'marca' && k in c) c[k] = copia_(ag[k]); });
  c.marca = Object.assign(c.marca, ag.marca || {});
  return c;
}

const TIPOS_ETAPA = ['aberta', 'ganho', 'perdido'];

function copia_(o) { return JSON.parse(JSON.stringify(o)); }

function config_() {
  if (MEMO_.__config) return MEMO_.__config;
  const r = ler_('config').filter(function (x) { return x.chave === 'app'; })[0];
  let salvo = {};
  try { salvo = r ? JSON.parse(r.valor) : {}; } catch (e) { salvo = {}; }
  const c = padraoConfig_();
  Object.keys(salvo || {}).forEach(function (k) { if (k in c && k !== 'marca') c[k] = salvo[k]; });
  c.marca = Object.assign(c.marca, salvo && salvo.marca || {});
  // Archivo nos dois era o padrão antigo: vira a dupla nova (Fraunces nos títulos, Manrope no texto).
  if (c.marca.fonteTitulos === 'Archivo' && c.marca.fonteTexto === 'Archivo') { c.marca.fonteTitulos = 'Fraunces'; c.marca.fonteTexto = 'Manrope'; }
  MEMO_.__config = c;
  return c;
}

function cor_(v, padrao) { const s = texto_(v, 7); return /^#[0-9a-f]{6}$/i.test(s) ? s : padrao; }

function fonte_(v, padrao) { const s = texto_(v, 60); return /^[A-Za-z0-9 ]+$/.test(s) ? s : padrao; }

function lista_(v, max) {
  const vistos = {};
  return (Array.isArray(v) ? v : []).map(function (x) { return texto_(x, 60); })
    .filter(function (x) { const k = x.toLowerCase(); if (!x || vistos[k]) return false; vistos[k] = 1; return true; })
    .slice(0, max || 40);
}

function slug_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

function validarConfig_(d, atual) {
  const p = padraoConfig_().marca, m = d.marca || {};
  const c = {
    empresa: texto_(d.empresa, 60) || atual.empresa,
    produto: texto_(d.produto, 40) || atual.produto,
    marca: {
      logoUrl: url_(m.logoUrl) || (/^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(String(m.logoUrl || '')) && String(m.logoUrl).length < 300000 ? String(m.logoUrl) : ''),
      logoParticulas: /^data:image\/(png|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(String(m.logoParticulas || '')) && String(m.logoParticulas).length < 20000 ? String(m.logoParticulas) : (atual.marca.logoParticulas || ''),
      primaria: cor_(m.primaria, p.primaria),
      destaque: cor_(m.destaque, p.destaque),
      fundo: cor_(m.fundo, p.fundo),
      superficie: cor_(m.superficie, p.superficie),
      texto: cor_(m.texto, p.texto),
      fonteTitulos: fonte_(m.fonteTitulos, p.fonteTitulos),
      fonteTexto: fonte_(m.fonteTexto, p.fonteTexto),
      raio: Math.round(numero_(m.raio == null ? p.raio : m.raio, 0, 28)),
    },
    moeda: umDe_(d.moeda, ['BRL', 'USD', 'EUR'], 'BRL'),
    diasParado: Math.round(numero_(d.diasParado || atual.diasParado, 1, 90)),
    emailAvisos: d.emailAvisos !== false,
    dominio: texto_(d.dominio, 100).toLowerCase().replace(/^@/, ''),
    entradaAutomatica: !!d.entradaAutomatica,
    servicos: lista_(d.servicos),
    origens: lista_(d.origens),
    motivosPerda: lista_(d.motivosPerda),
    segmentos: lista_(d.segmentos),
  };
  if (c.dominio && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(c.dominio)) throw new Error('Domínio inválido.');

  const ids = {};
  c.etapas = (Array.isArray(d.etapas) ? d.etapas : []).slice(0, 15).map(function (e) {
    const nome = texto_(e.nome, 40);
    if (!nome) throw new Error('Toda etapa precisa de nome.');
    let id = texto_(e.id, 30) || slug_(nome) || 'etapa';
    while (ids[id]) id += '-2';
    ids[id] = 1;
    const tipo = umDe_(e.tipo, TIPOS_ETAPA, 'aberta');
    const prob = tipo === 'ganho' ? 100 : tipo === 'perdido' ? 0 : Math.round(numero_(e.prob, 0, 99));
    return { id: id, nome: nome, tipo: tipo, prob: prob, cor: cor_(e.cor, '#A3A89B') };
  });
  ['aberta', 'ganho', 'perdido'].forEach(function (t) {
    if (!c.etapas.some(function (e) { return e.tipo === t; })) {
      throw new Error('O funil precisa de pelo menos uma etapa do tipo "' + t + '".');
    }
  });
  const emUso = {};
  ler_('oportunidades').forEach(function (o) { emUso[o.etapa] = (emUso[o.etapa] || 0) + 1; });
  atual.etapas.forEach(function (e) {
    if (!ids[e.id] && emUso[e.id]) {
      throw new Error('A etapa "' + e.nome + '" tem ' + emUso[e.id] + ' oportunidade(s). Mova-as antes de remover a etapa.');
    }
  });
  return c;
}

function salvarConfig(d) {
  const eu = exigir_('admin');
  return comTrava_(function () {
    const atual = config_();
    const c = validarConfig_(d || {}, atual);
    const valor = JSON.stringify(c);
    if (achar_('config', 'app')) atualizar_('config', 'app', { valor: valor });
    else inserir_('config', { chave: 'app', valor: valor });
    registrar_(eu, 'config', 'app', 'alterou', 'configuração', '', '');
    MEMO_.__config = null;
    return config_();
  });
}
