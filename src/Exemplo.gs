/**
 * Dados de demonstração para apresentar o CRM numa prova de conceito.
 * Só roda com o CRM vazio (sem clientes nem oportunidades). Empresas e pessoas fictícias.
 */
function popularExemplo() {
  const eu = exigir_('admin');
  return comTrava_(function () {
    if (ler_('clientes').length || ler_('oportunidades').length) throw new Error('O exemplo só pode ser carregado com o CRM vazio.');
    const cfg = config_();
    const dia = function (n) { return new Date(Date.now() - n * 864e5).toISOString(); };
    const data = function (n) { return dia(n).slice(0, 10); };
    const clientes = [
      ['Studio Lótus Yoga', 'Wellness', 'Ana Ribeiro', '@studiolotus'],
      ['Clínica Respira', 'Saúde', 'Dr. Paulo Mendes', '@clinicarespira'],
      ['Café Aurora', 'Alimentação', 'Juliana Prado', '@cafeaurora'],
      ['Atelier Nômade', 'Moda', 'Rafael Costa', '@ateliernomade'],
      ['Spa Raízes', 'Wellness', 'Carla Nunes', '@sparaizes'],
      ['Academia Pulso', 'Wellness', 'Bruno Lima', '@academiapulso'],
      ['Instituto Equilíbrio', 'Saúde', 'Marta Siqueira', '@institutoequilibrio'],
      ['Ventana Casa', 'Varejo', 'Lucas Ferraz', '@ventanacasa'],
    ].map(function (c, i) {
      return inserir_('clientes', {
        id: novoId_('cl'), nome: c[0], segmento: c[1], contato: c[2], instagram: c[3],
        email: 'contato@' + slug_(c[0]).replace(/-/g, '') + '.exemplo', criadoEm: dia(60 - i * 5), atualizadoEm: dia(10), arquivado: false,
      });
    });
    const etapa = function (tipo, n) { return cfg.etapas.filter(function (e) { return e.tipo === tipo; })[n || 0] || cfg.etapas[0]; };
    const abertas = cfg.etapas.filter(function (e) { return e.tipo === 'aberta'; });
    const ab = function (i) { return abertas[Math.min(i, abertas.length - 1)].id; };
    // [cliente, título, serviço, contrato, valor, meses, etapa, dias na etapa, prioridade, origem]
    const ops = [
      [0, 'Gestão de redes sociais', 'Social media', 'fee', 4500, 12, ab(3), 3, 'alta', 'Indicação'],
      [0, 'Ensaio e campanha de inverno', 'Campanha', 'projeto', 9800, 0, ab(1), 8, 'media', 'Instagram'],
      [1, 'Rebranding completo', 'Branding', 'projeto', 28000, 0, ab(2), 6, 'alta', 'Site'],
      [2, 'Identidade visual e cardápio', 'Identidade visual', 'projeto', 12500, 0, ab(0), 1, 'media', 'Instagram'],
      [3, 'Lançamento de coleção', 'Campanha', 'projeto', 18000, 0, etapa('ganho').id, 12, 'alta', 'Indicação'],
      [3, 'Conteúdo mensal', 'Conteúdo', 'fee', 3800, 6, etapa('ganho').id, 30, 'media', 'Indicação'],
      [4, 'Site com agendamento', 'Site / Landing page', 'projeto', 15000, 0, ab(3), 9, 'alta', 'LinkedIn'],
      [4, 'Tráfego pago', 'Tráfego pago', 'fee', 2500, 12, ab(1), 2, 'baixa', 'Indicação'],
      [5, 'Social media + tráfego', 'Social media', 'fee', 6200, 12, ab(2), 4, 'alta', 'Prospecção ativa'],
      [6, 'Consultoria de posicionamento', 'Consultoria', 'projeto', 8000, 0, etapa('perdido').id, 20, 'media', 'Evento'],
      [6, 'Landing page de evento', 'Site / Landing page', 'projeto', 6500, 0, ab(0), 0, 'baixa', 'Site'],
      [7, 'Branding de loja nova', 'Branding', 'projeto', 22000, 0, ab(1), 11, 'media', 'LinkedIn'],
      [7, 'Social media', 'Social media', 'fee', 4200, 12, etapa('ganho').id, 50, 'media', 'Indicação'],
      [2, 'Fotos de produto', 'Conteúdo', 'projeto', 4800, 0, etapa('perdido').id, 35, 'baixa', 'Instagram'],
    ];
    const criadas = ops.map(function (o, i) {
      const e = etapaPorId_(cfg, o[6]);
      return inserir_('oportunidades', {
        id: novoId_('op'), titulo: o[1], clienteId: clientes[o[0]].id, servico: o[2], contrato: o[3], valor: o[4], meses: o[5],
        etapa: o[6], ordem: i, responsavel: eu.email, prioridade: o[8], origem: o[9], previsao: data(-20 - i * 3),
        motivoPerda: e.tipo === 'perdido' ? cfg.motivosPerda[0] || '' : '', obs: '', tags: [],
        criadoEm: dia(o[7] + 15), criadoPor: eu.email, etapaDesde: dia(o[7]), fechadoEm: e.tipo === 'aberta' ? '' : dia(o[7]),
        atualizadoEm: dia(o[7]), atualizadoPor: eu.email, arquivado: false,
      });
    });
    [
      [0, 'Enviar calendário editorial de novembro', 'afazer', -2],
      [2, 'Revisar moodboard com o cliente', 'fazendo', 1],
      [6, 'Mandar proposta revisada', 'afazer', 2],
      [11, 'Agendar reunião de briefing', 'afazer', -1],
      [4, 'Entregar peças finais', 'feito', 5],
    ].forEach(function (t, i) {
      const op = criadas[t[0]];
      inserir_('tarefas', {
        id: novoId_('t'), titulo: t[1], oportunidadeId: op.id, clienteId: op.clienteId, responsavel: eu.email,
        prazo: data(t[3]), status: t[2], ordem: i, criadoPor: eu.email, criadoEm: dia(7), concluidoEm: t[2] === 'feito' ? dia(1) : '', atualizadoEm: dia(1),
      });
    });
    [[2, 'Proposta de rebranding v2', 28000, 'enviada'], [6, 'Site com agendamento', 15000, 'enviada'], [4, 'Lançamento de coleção', 18000, 'aprovada']]
      .forEach(function (p) {
        const op = criadas[p[0]];
        inserir_('propostas', {
          id: novoId_('p'), oportunidadeId: op.id, titulo: p[1], url: '', valor: p[2], status: p[3], enviadaEm: data(6),
          validade: data(-24), obs: '', criadoPor: eu.email, criadoEm: dia(6), atualizadoEm: dia(6),
        });
      });
    [[4, 3, 'Direção de arte da campanha'], [4, 2.5, 'Ajustes finais'], [12, 4, 'Produção de posts da semana'], [5, 1.5, 'Reunião de pauta']]
      .forEach(function (h, i) {
        const op = criadas[h[0]];
        inserir_('horas', { id: novoId_('hr'), email: eu.email, data: data(i), clienteId: op.clienteId, oportunidadeId: op.id, horas: h[1], descricao: h[2], criadoEm: dia(i) });
      });
    registrar_(eu, 'config', 'exemplo', 'carregou', 'dados de exemplo', '', '');
    return { clientes: clientes.length, oportunidades: criadas.length };
  });
}
