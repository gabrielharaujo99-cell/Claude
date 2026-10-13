/**
 * Apontamento de horas por pessoa e cliente.
 * Cada um vê e lança as próprias horas; gestor e admin veem e corrigem as de todos.
 */
function lancarHoras(d) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    d = d || {};
    let email = eu.email;
    if (d.email && email_(d.email) !== eu.email) {
      if (!pode_(eu, 'gestor')) throw new Error('Você só pode lançar as suas horas.');
      if (!membroAtivo_(email_(d.email))) throw new Error('Pessoa fora da equipe.');
      email = email_(d.email);
    }
    const h = {
      email: email,
      data: dataIso_(d.data) || hoje_(),
      clienteId: texto_(d.clienteId, 40),
      oportunidadeId: texto_(d.oportunidadeId, 40),
      horas: Math.round(numero_(d.horas, 0, 24) * 100) / 100,
      descricao: texto_(d.descricao, 500),
    };
    if (h.horas <= 0) throw new Error('Informe as horas (ex.: 1,5).');
    const op = h.oportunidadeId ? achar_('oportunidades', h.oportunidadeId) : null;
    if (!op) h.oportunidadeId = '';
    if (op && !h.clienteId) h.clienteId = op.clienteId;
    if (h.clienteId && !achar_('clientes', h.clienteId)) h.clienteId = '';
    if (!h.clienteId) throw new Error('Escolha o cliente.');
    if (d.id) {
      const antes = achar_('horas', d.id);
      if (!antes) throw new Error('Lançamento não encontrado.');
      if (antes.email !== eu.email && !pode_(eu, 'gestor')) throw new Error('Você só pode editar as suas horas.');
      return atualizar_('horas', d.id, h).depois;
    }
    h.id = novoId_('hr');
    h.criadoEm = agora_();
    return inserir_('horas', h);
  });
}

function removerHoras(id) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    const h = achar_('horas', id);
    if (!h) return true;
    if (h.email !== eu.email && !pode_(eu, 'gestor')) throw new Error('Você só pode apagar as suas horas.');
    return remover_('horas', id);
  });
}

function listarHoras(filtro) {
  const eu = exigir_('leitor');
  filtro = filtro || {};
  const de = dataIso_(filtro.de) || '0000-00-00', ate = dataIso_(filtro.ate) || '9999-12-31';
  let email = email_(filtro.email);
  if (!pode_(eu, 'gestor')) email = eu.email;
  return ler_('horas').filter(function (h) {
    return h.data >= de && h.data <= ate && (!email || h.email === email);
  }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : (a.criadoEm < b.criadoEm ? 1 : -1); });
}
