/** Clientes (contas) da agência. Uma oportunidade pertence a um cliente. */
const CAMPOS_CLIENTE = ['nome', 'segmento', 'contato', 'email', 'telefone', 'instagram', 'site', 'obs'];

function normalizar_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function limparCliente_(d) {
  const c = {
    nome: texto_(d.nome, 100),
    segmento: texto_(d.segmento, 60),
    contato: texto_(d.contato, 100),
    email: email_(d.email),
    telefone: texto_(d.telefone, 30),
    instagram: texto_(d.instagram, 60).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, ''),
    site: url_(d.site) || (texto_(d.site, 200) && !/\s/.test(texto_(d.site, 200)) ? 'https://' + texto_(d.site, 200).replace(/^\/+/, '') : ''),
    obs: texto_(d.obs, 3000),
  };
  if (!c.nome) throw new Error('Informe o nome do cliente.');
  return c;
}

function clientePorNome_(nome, eu) {
  const alvo = normalizar_(nome);
  const achado = ler_('clientes').filter(function (c) { return normalizar_(c.nome) === alvo; })[0];
  if (achado) return achado;
  const agora = agora_();
  const novo = inserir_('clientes', { id: novoId_('cl'), nome: texto_(nome, 100), criadoEm: agora, atualizadoEm: agora, arquivado: false });
  registrar_(eu, 'cliente', novo.id, 'criou', '', '', novo.nome);
  return novo;
}

function salvarCliente(d) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    d = d || {};
    const c = limparCliente_(d);
    const alvo = normalizar_(c.nome);
    const dup = ler_('clientes').filter(function (x) { return x.id !== d.id && normalizar_(x.nome) === alvo; })[0];
    if (dup) throw new Error('Já existe um cliente chamado "' + dup.nome + '".');
    c.atualizadoEm = agora_();
    if (!d.id) {
      Object.assign(c, { id: novoId_('cl'), criadoEm: c.atualizadoEm, arquivado: false });
      const novo = inserir_('clientes', c);
      registrar_(eu, 'cliente', novo.id, 'criou', '', '', novo.nome);
      return novo;
    }
    const r = atualizar_('clientes', d.id, c);
    registrarDiferencas_(eu, 'cliente', r.antes, r.depois, CAMPOS_CLIENTE);
    return r.depois;
  });
}

function arquivarCliente(id, arquivar) {
  const eu = exigir_('gestor');
  return comTrava_(function () {
    const r = atualizar_('clientes', id, { arquivado: arquivar !== false, atualizadoEm: agora_() });
    registrar_(eu, 'cliente', id, arquivar !== false ? 'arquivou' : 'desarquivou', '', '', '');
    return r.depois;
  });
}
