/**
 * Tráfego pago: campanhas por cliente e os resultados lançados por período (investimento, impressões,
 * cliques, leads, vendas, receita). CPL, CTR e ROAS são calculados na tela a partir desses números.
 * Só quem tem a área "trafego" vê e mexe.
 */
const PLATAFORMAS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads'];
const OBJETIVOS = ['Leads', 'Vendas', 'Agendamentos', 'Tráfego', 'Alcance'];
const STATUS_CAMPANHA = ['ativa', 'pausada', 'encerrada'];

function salvarCampanha(d) {
  const eu = exigirArea_('trafego', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const c = {
      clienteId: texto_(d.clienteId, 40),
      nome: texto_(d.nome, 140),
      plataforma: umDe_(d.plataforma, PLATAFORMAS, 'Meta Ads'),
      objetivo: umDe_(d.objetivo, OBJETIVOS, 'Leads'),
      status: umDe_(d.status, STATUS_CAMPANHA, 'ativa'),
      verba: Math.round(numero_(d.verba, 0, 1e9) * 100) / 100,
      inicio: dataIso_(d.inicio),
      fim: dataIso_(d.fim),
      responsavel: membroAtivo_(email_(d.responsavel)) ? email_(d.responsavel) : '',
      obs: texto_(d.obs, 1000),
      atualizadoEm: agora_(),
    };
    if (!c.nome) throw new Error('Dê um nome para a campanha.');
    if (!c.clienteId || !achar_('clientes', c.clienteId)) throw new Error('Escolha o cliente.');
    if (c.fim && c.inicio && c.fim < c.inicio) throw new Error('O fim não pode ser antes do início.');
    if (!d.id) {
      Object.assign(c, { id: novoId_('cp'), criadoPor: eu.email, criadoEm: c.atualizadoEm });
      if (!c.responsavel) c.responsavel = eu.email;
      return inserir_('campanhas', c);
    }
    if (!achar_('campanhas', d.id)) throw new Error('Campanha não encontrada. Recarregue a página.');
    return atualizar_('campanhas', d.id, c).depois;
  });
}

function lancarResultado(d) {
  const eu = exigirArea_('trafego', 'colaborador');
  return comTrava_(function () {
    d = d || {};
    const camp = achar_('campanhas', texto_(d.campanhaId, 40));
    if (!camp) throw new Error('Escolha a campanha.');
    const r = {
      campanhaId: camp.id,
      data: dataIso_(d.data) || hoje_(),
      investimento: Math.round(numero_(d.investimento, 0, 1e9) * 100) / 100,
      impressoes: Math.round(numero_(d.impressoes, 0, 1e12)),
      cliques: Math.round(numero_(d.cliques, 0, 1e12)),
      leads: Math.round(numero_(d.leads, 0, 1e9)),
      vendas: Math.round(numero_(d.vendas, 0, 1e9)),
      receita: Math.round(numero_(d.receita, 0, 1e12) * 100) / 100,
    };
    if (!(r.investimento > 0) && !r.leads && !r.cliques) throw new Error('Informe ao menos o investimento, os cliques ou os leads.');
    if (r.cliques > r.impressoes && r.impressoes > 0) throw new Error('Cliques não podem passar das impressões.');
    if (d.id) {
      if (!achar_('resultados', d.id)) throw new Error('Lançamento não encontrado.');
      return atualizar_('resultados', d.id, r).depois;
    }
    Object.assign(r, { id: novoId_('rs'), criadoPor: eu.email, criadoEm: agora_() });
    return inserir_('resultados', r);
  });
}

function removerResultado(id) {
  exigirArea_('trafego', 'colaborador');
  return comTrava_(function () { return remover_('resultados', id); });
}
