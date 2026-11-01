/** Contatos da agência: clientes, parceiros, fornecedores, imprensa e equipe (como no Be Flow). */
const TIPOS_CONTATO = ['Cliente', 'Parceiro', 'Fornecedor', 'Influenciador', 'Imprensa', 'Equipe', 'Outro'];

function salvarContato(d) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    d = d || {};
    const c = {
      nome: texto_(d.nome, 100), email: email_(d.email), telefone: texto_(d.telefone, 40), empresa: texto_(d.empresa, 100),
      clienteId: achar_('clientes', texto_(d.clienteId, 40)) ? texto_(d.clienteId, 40) : '', cargo: texto_(d.cargo, 80),
      tipo: umDe_(d.tipo, TIPOS_CONTATO, 'Outro'), contexto: texto_(d.contexto, 1000), atualizadoEm: agora_(),
    };
    if (!c.nome) throw new Error('Informe o nome do contato.');
    if (texto_(d.email, 200) && !c.email) throw new Error('E-mail inválido.');
    if (c.email && ler_('contatos').some(function (x) { return x.email === c.email && x.id !== d.id; })) throw new Error('Já existe um contato com esse e-mail.');
    if (!d.id) return inserir_('contatos', Object.assign(c, { id: novoId_('ct'), criadoPor: eu.email, criadoEm: c.atualizadoEm }));
    if (!achar_('contatos', d.id)) throw new Error('Contato não encontrado. Recarregue a página.');
    return atualizar_('contatos', d.id, c).depois;
  });
}

function removerContato(id) {
  const eu = exigir_('colaborador');
  return comTrava_(function () {
    const c = achar_('contatos', id);
    if (!c) return true;
    if (c.criadoPor !== eu.email && !pode_(eu, 'gestor')) throw new Error('Só quem criou ou um gestor pode apagar.');
    return remover_('contatos', id);
  });
}

function listarContatos() { exigir_('leitor'); return ler_('contatos'); }
