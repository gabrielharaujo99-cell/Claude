/**
 * Dados de demonstração para apresentar o CRM numa prova de conceito.
 * Só roda com o CRM vazio (sem clientes nem oportunidades). Empresas e pessoas fictícias.
 */
// Rode pelo editor do Apps Script (Executar > zerarDados) para apagar as abas do CRM e começar do zero.
function zerarDados() {
  exigir_('admin');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const presentes = ler_('equipe').map(function (m) { return PRESENCA_CHAVE_ + m.email; });
  const abas = ss.getSheets();
  ss.insertSheet('Página1 ' + Date.now());
  abas.forEach(function (sh) { ss.deleteSheet(sh); });
  try { CacheService.getScriptCache().removeAll(presentes); } catch (e) { /* a presença expira sozinha */ }
  return true;
}

function popularExemplo() {
  const eu = exigir_('admin');
  return comTrava_(function () {
    if (ler_('clientes').length || ler_('oportunidades').length) throw new Error('O exemplo só pode ser carregado com o CRM vazio.');
    const cfg = config_();
    const dia = function (n) { return new Date(Date.now() - n * 864e5).toISOString(); };
    const data = function (n) { return dia(n).slice(0, 10); };
    // Clientes do exemplo: a lista do arquivo privado da agência (CLIENTES_EXEMPLO, com logo e fee mensal), se houver;
    // senão, negócios wellness fictícios, um pouco de cada força.
    const reais = typeof CLIENTES_EXEMPLO !== 'undefined' && Array.isArray(CLIENTES_EXEMPLO) && CLIENTES_EXEMPLO.length ? CLIENTES_EXEMPLO : null;
    const clientes = (reais ? reais.map(function (c) { return [c.nome, c.segmento, c.contato || '', c.instagram || '', c.logo || '']; }) : [
      ['Pulso Fit Studio', 'Esporte', 'Ana Ribeiro', '@pulsofitstudio'],
      ['Vitta Longevidade', 'Longevidade', 'Paulo Mendes', '@vittalongevidade'],
      ['Repouso Recovery', 'Recovery', 'Juliana Prado', '@repousorecovery'],
      ['Clínica Equilíbrio', 'Saúde', 'Renata Costa', '@clinicaequilibrio'],
      ['Spa Bambu', 'Recovery', 'Carla Nunes', '@spabambu'],
      ['Box Atlas Cross', 'Esporte', 'Bruno Lima', '@boxatlascross'],
      ['Leveza Nutrição', 'Saúde', 'Marta Siqueira', '@levezanutricao'],
      ['Academia Horizonte', 'Esporte', 'Lucas Ferraz', '@academiahorizonte'],
    ]).map(function (c, i) {
      return inserir_('clientes', {
        id: novoId_('cl'), nome: c[0], segmento: c[1], contato: c[2], instagram: c[3], logo: c[4] || '',
        email: reais ? '' : 'contato@' + slug_(c[0]).replace(/-/g, '') + '.exemplo', criadoEm: dia(60 - i * 5), atualizadoEm: dia(10), arquivado: false,
      });
    });
    const etapa = function (tipo, n) { return cfg.etapas.filter(function (e) { return e.tipo === tipo; })[n || 0] || cfg.etapas[0]; };
    const abertas = cfg.etapas.filter(function (e) { return e.tipo === 'aberta'; });
    const ab = function (i) { return abertas[Math.min(i, abertas.length - 1)].id; };
    // [cliente, título, serviço, contrato, valor, meses, etapa, dias na etapa, prioridade, origem]
    const ops = [
      [0, 'Assessoria completa', 'Assessoria completa', 'fee', 9500, 12, ab(3), 3, 'alta', 'Indicação'],
      [0, 'Campanha de matrículas de verão', 'Tráfego pago', 'projeto', 9800, 0, ab(1), 8, 'media', 'Instagram'],
      [1, 'Reposicionamento da marca', 'Branding', 'projeto', 28000, 0, ab(2), 6, 'alta', 'Site'],
      [2, 'Diagnóstico de crescimento', 'Diagnóstico', 'projeto', 12500, 0, ab(0), 1, 'media', 'Instagram'],
      [3, 'Lançamento do protocolo de eletroestimulação', 'Tráfego pago', 'projeto', 18000, 0, etapa('ganho').id, 12, 'alta', 'Indicação'],
      [3, 'Conteúdo mensal', 'Social media', 'fee', 6800, 6, etapa('ganho').id, 30, 'media', 'Indicação'],
      [4, 'Site com agendamento online', 'Site / Landing page', 'projeto', 15000, 0, ab(3), 9, 'alta', 'Site'],
      [4, 'Tráfego para sauna infravermelho', 'Tráfego pago', 'fee', 4500, 12, ab(1), 2, 'baixa', 'Indicação'],
      [5, 'Conteúdo + tráfego', 'Social media', 'fee', 7200, 12, ab(2), 4, 'alta', 'Prospecção ativa'],
      [6, 'Estruturação comercial', 'Consultoria', 'projeto', 8000, 0, etapa('perdido').id, 20, 'media', 'Evento'],
      [6, 'Landing page de check-up', 'Site / Landing page', 'projeto', 6500, 0, ab(0), 0, 'baixa', 'Tráfego pago'],
      [7, 'Branding da nova unidade', 'Branding', 'projeto', 22000, 0, ab(1), 11, 'media', 'Indicação'],
      [7, 'Assessoria completa', 'Assessoria completa', 'fee', 12000, 12, etapa('ganho').id, 50, 'media', 'Indicação'],
      [2, 'Fotos e vídeos do espaço', 'Social media', 'projeto', 4800, 0, etapa('perdido').id, 35, 'baixa', 'Instagram'],
    ];
    const criadas = ops.map(function (o, i) {
      const e = etapaPorId_(cfg, o[6]);
      return inserir_('oportunidades', {
        id: novoId_('op'), titulo: o[1], clienteId: clientes[o[0]].id, servico: o[2], contrato: o[3], valor: reais ? Math.round(o[4] * 0.4 / 100) * 100 : o[4], meses: o[5],
        etapa: o[6], ordem: i, responsavel: eu.email, prioridade: o[8], origem: o[9], previsao: data(-20 - i * 3),
        motivoPerda: e.tipo === 'perdido' ? cfg.motivosPerda[0] || '' : '', obs: '', tags: [],
        criadoEm: dia(o[7] + 15), criadoPor: eu.email, etapaDesde: dia(o[7]), fechadoEm: e.tipo === 'aberta' ? '' : dia(o[7]),
        atualizadoEm: dia(o[7]), atualizadoPor: eu.email, arquivado: false,
      });
    });
    [
      [0, 'Enviar plano de conteúdo de novembro', 'afazer', -2],
      [2, 'Apresentar diagnóstico de posicionamento', 'fazendo', 1],
      [6, 'Mandar proposta revisada', 'afazer', 2],
      [11, 'Agendar reunião de diagnóstico', 'afazer', -1],
      [4, 'Entregar criativos da campanha', 'feito', 5],
    ].forEach(function (t, i) {
      const op = criadas[t[0]];
      inserir_('tarefas', {
        id: novoId_('t'), titulo: t[1], oportunidadeId: op.id, clienteId: op.clienteId, responsavel: eu.email,
        prazo: data(t[3]), status: t[2], ordem: i, criadoPor: eu.email, criadoEm: dia(7), concluidoEm: t[2] === 'feito' ? dia(1) : '', atualizadoEm: dia(1),
      });
    });
    [[2, 'Proposta de reposicionamento v2', 28000, 'enviada'], [6, 'Site com agendamento online', 15000, 'enviada'], [4, 'Lançamento do protocolo de eletroestimulação', 18000, 'aprovada']]
      .forEach(function (p) {
        const op = criadas[p[0]];
        inserir_('propostas', {
          id: novoId_('p'), oportunidadeId: op.id, titulo: p[1], url: '', valor: p[2], status: p[3], enviadaEm: data(6),
          validade: data(-24), obs: '', criadoPor: eu.email, criadoEm: dia(6), atualizadoEm: dia(6),
        });
      });
    [[4, 3, 'Direção criativa da campanha'], [4, 2.5, 'Otimização dos anúncios'], [12, 4, 'Relatório mensal de resultados'], [5, 1.5, 'Reunião de pauta de conteúdo']]
      .forEach(function (h, i) {
        const op = criadas[h[0]];
        inserir_('horas', { id: novoId_('hr'), email: eu.email, data: data(i), clienteId: op.clienteId, oportunidadeId: op.id, horas: h[1], descricao: h[2], criadoEm: dia(i) });
      });
    // Atividades de cada pessoa da equipe inicial (campo "atividades" da equipe inicial), presas às oportunidades abertas.
    const abertasCriadas = criadas.filter(function (o) { const e = etapaPorId_(cfg, o.etapa); return e && e.tipo === 'aberta'; });
    let k = 0;
    equipeInicial_().forEach(function (m) {
      const email = email_(m.email);
      if (!membroAtivo_(email)) return;
      (m.atividades || []).forEach(function (titulo, j) {
        const op = abertasCriadas[k++ % abertasCriadas.length];
        const status = j === 0 ? 'fazendo' : j === 2 ? 'feito' : 'afazer';
        inserir_('tarefas', {
          id: novoId_('t'), titulo: texto_(titulo, 200), oportunidadeId: op.id, clienteId: op.clienteId, responsavel: email,
          prazo: data(-(k % 6) + 1), status: status, ordem: 100 + k, criadoPor: eu.email, criadoEm: dia(5),
          concluidoEm: status === 'feito' ? dia(1) : '', atualizadoEm: dia(1),
        });
      });
    });

    // Contratos: três fechamentos do funil (um fica sem contrato, para aparecer em "Fechamentos sem contrato")
    // e três contratos antigos com reajuste, serviços adicionais e um encerrado.
    const mesesAtras = function (n) { const d = new Date(); d.setDate(10); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };
    const contrato = function (cl, op, titulo, servico, tipo, valor, inicio, meses, status, encerradoEm) {
      return inserir_('contratos', {
        id: novoId_('ct'), clienteId: clientes[cl].id, oportunidadeId: op == null ? '' : criadas[op].id, titulo: titulo, servico: servico,
        tipo: tipo, valor: valor, inicio: inicio, meses: meses, status: status || 'ativo', encerradoEm: encerradoEm || '', obs: '',
        criadoPor: eu.email, criadoEm: dia(1), atualizadoEm: dia(1),
      });
    };
    const ajuste = function (c, tipo, quando, valor, recorrente, descricao) {
      inserir_('ajustes', { id: novoId_('aj'), contratoId: c.id, tipo: tipo, data: quando, valor: valor, recorrente: recorrente, descricao: descricao, criadoPor: eu.email, criadoEm: dia(1) });
    };
    if (reais) {
      // Um contrato de fee por cliente da lista, começando em meses diferentes (a receita do Financeiro cresce até o total de hoje).
      reais.forEach(function (c, i) {
        if (c.fee) contrato(i, null, c.servico || 'Assessoria completa', c.servico || 'Assessoria completa', 'fee', c.fee, mesesAtras(c.desde || (2 + (i * 3) % 11)), 12);
      });
    } else {
    contrato(3, 5, 'Conteúdo mensal', 'Social media', 'fee', 6800, data(30), 6);
    const apice = contrato(7, 12, 'Assessoria completa', 'Assessoria completa', 'fee', 12000, data(50), 12);
    ajuste(apice, 'adicional', data(10), 5600, false, 'Vídeo institucional da nova unidade');
    const spa = contrato(4, null, 'Assessoria completa', 'Assessoria completa', 'fee', 8500, mesesAtras(20), 24);
    ajuste(spa, 'reajuste', mesesAtras(8), 9180, false, 'Reajuste anual (IPCA + 2%)');
    ajuste(spa, 'adicional', mesesAtras(5), 900, true, 'Gestão do Google Meu Negócio');
    ajuste(spa, 'adicional', mesesAtras(3), 3500, false, 'Ensaio fotográfico do espaço');
    const box = contrato(5, null, 'Tráfego pago', 'Tráfego pago', 'fee', 4200, mesesAtras(9), 0);
    ajuste(box, 'adicional', mesesAtras(4), 1200, true, 'Landing pages mensais');
    contrato(6, null, 'Diagnóstico e posicionamento', 'Diagnóstico', 'fee', 5000, mesesAtras(14), 6, 'encerrado', mesesAtras(9));
    }

    // Quem é de cada área na equipe (para os responsáveis dos conteúdos e campanhas de exemplo).
    const daArea = function (area) {
      const l = equipeInicial_().filter(function (m) { return (m.areas || []).indexOf(area) >= 0 && membroAtivo_(email_(m.email)); }).map(function (m) { return email_(m.email); });
      return l.length ? l : [eu.email];
    };
    const sociais = daArea('social'), trafegos = daArea('trafego');

    // Social media: conteúdos de cada cliente espalhados pela pauta, das últimas duas semanas às próximas duas.
    const pautas = [
      [0, 'Bastidores do treino', 'Reels', 'pauta', 9], [0, '5 benefícios do treino funcional', 'Carrossel', 'agendado', 2],
      [1, 'Longevidade começa no check-up', 'Carrossel', 'aprovacao', 4], [1, 'Depoimento de paciente', 'Reels', 'producao', 6],
      [2, 'Crioterapia: mito ou verdade?', 'Reels', 'publicado', -3], [2, 'Tour pelo Repouso Recovery', 'Vídeo', 'agendado', 1],
      [3, 'Antes e depois do protocolo', 'Carrossel', 'aprovacao', 3], [3, 'Especialista responde', 'Stories', 'pauta', 12],
      [4, 'Ritual de sauna infravermelho', 'Reels', 'publicado', -6], [4, 'Pacote de fim de ano', 'Post', 'producao', 8],
      [5, 'WOD da semana', 'Reels', 'publicado', -1], [5, 'Desafio de 30 dias', 'Carrossel', 'agendado', 5],
      [6, 'Equilíbrio entre corpo e mente', 'Post', 'publicado', -9], [6, 'Agenda de check-ups de novembro', 'Stories', 'aprovacao', 2],
      [7, 'Nova unidade: inauguração', 'Reels', 'producao', 10], [7, 'Treino de força após os 40', 'Carrossel', 'pauta', 14],
      [2, 'Hiperbárica explicada em 60s', 'Reels', 'publicado', -12], [5, 'Atleta do mês', 'Post', 'aprovacao', -1],
    ];
    pautas.forEach(function (p, i) {
      inserir_('posts', {
        id: novoId_('po'), clienteId: clientes[p[0]].id, titulo: p[1], formato: p[2], rede: i % 5 === 4 ? 'TikTok' : 'Instagram', status: p[3],
        data: data(-p[4]), hora: ['09:00', '12:30', '18:00', '19:30'][i % 4], responsavel: sociais[i % sociais.length],
        legenda: '', link: '', obs: '', criadoPor: eu.email, criadoEm: dia(15), atualizadoEm: dia(1),
      });
    });

    // Tráfego: campanhas com resultados semanais das últimas 8 semanas.
    [
      [0, 'Captação de alunos', 'Meta Ads', 'Leads', 3000, 38, 0.06],
      [1, 'Check-up de longevidade', 'Google Ads', 'Agendamentos', 6000, 95, 0.09],
      [2, 'Recovery · primeira sessão', 'Meta Ads', 'Leads', 2500, 30, 0.07],
      [4, 'Sauna infravermelho', 'Meta Ads', 'Vendas', 4500, 55, 0.05],
      [5, 'Matrículas de verão', 'TikTok Ads', 'Leads', 2000, 22, 0.04],
    ].forEach(function (c, i) {
      const camp = inserir_('campanhas', {
        id: novoId_('cp'), clienteId: clientes[c[0]].id, nome: c[1], plataforma: c[2], objetivo: c[3], status: i === 4 ? 'pausada' : 'ativa',
        verba: c[4], inicio: data(70), fim: '', responsavel: trafegos[i % trafegos.length], obs: '', criadoPor: eu.email, criadoEm: dia(70), atualizadoEm: dia(1),
      });
      for (let s = 8; s >= 1; s--) {
        const inv = Math.round(c[4] / 4.3 * (0.8 + ((s * 7 + i * 3) % 5) / 10));
        const imp = Math.round(inv * (90 + (s % 3) * 15));
        const cliques = Math.round(imp * (0.012 + (i % 3) * 0.004));
        const leads = Math.max(1, Math.round(inv / c[5] * (0.85 + (s % 4) / 10)));
        const vendas = Math.round(leads * c[6] * 3);
        inserir_('resultados', {
          id: novoId_('rs'), campanhaId: camp.id, data: data(s * 7), investimento: inv, impressoes: imp, cliques: cliques, leads: leads,
          vendas: vendas, receita: vendas * (c[3] === 'Vendas' ? 690 : 450), criadoPor: eu.email, criadoEm: dia(s * 7),
        });
      }
    });

    socialExemplo_(eu);
    registrar_(eu, 'config', 'exemplo', 'carregou', 'dados de exemplo', '', '');
    return { clientes: clientes.length, oportunidades: criadas.length };
  });
}

// Exemplo da social media por cliente: perfil de marca, pilares, pedidos, jornada e reports dos últimos meses.
// Roda sozinho no popularExemplo; com o CRM já em uso, o admin chama pela tela (só se ainda não houver marcas).
function popularSocialExemplo() {
  const eu = exigir_('admin');
  return comTrava_(function () {
    if (ler_('marcas').length) throw new Error('A social já tem perfis de marca.');
    return socialExemplo_(eu);
  });
}

function socialExemplo_(eu) {
  const clientes = ler_('clientes').filter(function (c) { return !c.arquivado; });
  if (!clientes.length) return { marcas: 0 };
  const agora = agora_(), hoje = new Date();
  const data = function (n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); };
  const mesAtras = function (n) { const d = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1, 12); return d.toISOString().slice(0, 7); };
  const perfis = {
    Esporte: {
      persona: 'Mariana, 28 a 40 anos, profissional ocupada que treina antes do trabalho. Quer resultado visível sem perder tempo e valoriza comunidade.',
      tomVoz: 'Energético, direto e motivador. Fala de igual para igual, sem jargão técnico e sem culpa.',
      cultura: 'Treino é para todo mundo. Constância vale mais que intensidade. Comunidade acima de ego.',
      pilares: [{ nome: 'Treino e técnica', meta: 35 }, { nome: 'Comunidade', meta: 25 }, { nome: 'Resultados', meta: 20 }, { nome: 'Ofertas', meta: 20 }],
    },
    Longevidade: {
      persona: 'Roberto, 45 a 65 anos, executivo que quer viver mais e melhor. Busca autoridade médica e dados confiáveis antes de decidir.',
      tomVoz: 'Sereno, científico e acolhedor. Explica com clareza e cita evidência; nunca promete milagre.',
      cultura: 'Prevenção é o maior investimento. Cuidado personalizado e baseado em ciência.',
      pilares: [{ nome: 'Educação em saúde', meta: 40 }, { nome: 'Autoridade médica', meta: 25 }, { nome: 'Depoimentos', meta: 20 }, { nome: 'Serviços', meta: 15 }],
    },
    Recovery: {
      persona: 'Camila, 30 a 45 anos, atleta amadora ou pessoa estressada que procura recuperação física e mental. Quer experiência premium.',
      tomVoz: 'Calmo, sensorial e sofisticado. Frases curtas, convite ao autocuidado.',
      cultura: 'Recuperar também é treinar. Pausa consciente como parte da performance.',
      pilares: [{ nome: 'Experiência', meta: 30 }, { nome: 'Ciência do recovery', meta: 30 }, { nome: 'Bem-estar', meta: 25 }, { nome: 'Ofertas', meta: 15 }],
    },
    'Saúde': {
      persona: 'Patrícia, 35 a 55 anos, quer emagrecer com acompanhamento e já tentou dietas sozinha. Precisa de confiança e de prova social.',
      tomVoz: 'Empático, encorajador e prático. Mostra o caminho em passos possíveis.',
      cultura: 'Saúde sem radicalismo. Acompanhamento próximo e humano.',
      pilares: [{ nome: 'Dicas práticas', meta: 35 }, { nome: 'Transformações', meta: 25 }, { nome: 'Especialistas', meta: 20 }, { nome: 'Serviços', meta: 20 }],
    },
  };
  const seguidores = [18400, 9200, 6100, 3400, 7700, 12900, 15100, 22800];
  const n = Math.min(clientes.length, 8);
  for (let i = 0; i < n; i++) {
    const c = clientes[i], p = perfis[c.segmento] || perfis.Esporte;
    inserir_('marcas', {
      clienteId: c.id, status: i === 6 ? 'pausa' : 'ativo', fase: FASES_ESTRATEGIA[[3, 1, 2, 0, 4, 3, 5, 1][i] || 0],
      objetivo: ['Gerar 60 leads de matrícula por mês pelo direct', 'Posicionar como referência em longevidade no Brasil', 'Lotar a agenda de sessões de recovery na semana',
        'Construir a base de seguidores qualificados', 'Vender o pacote de fim de ano', 'Aumentar inscrições no desafio de 30 dias', 'Manter a comunidade engajada', 'Divulgar a nova unidade'][i] || '',
      persona: p.persona, tomVoz: p.tomVoz, cultura: p.cultura,
      diretrizes: 'Sempre com legenda que termina em chamada para ação. Rostos reais da equipe e dos clientes. Nada de antes e depois sem autorização por escrito. Paleta da marca em todas as artes.',
      publico: 'Classes A e B, raio de 10 km da unidade, interesse em saúde e performance.',
      diferenciais: 'Equipe especializada, estrutura premium e acompanhamento individual.',
      palavrasUsar: 'constância, cuidado, ciência, comunidade, performance', palavrasEvitar: 'milagre, rápido, sem esforço, dieta da moda',
      referencias: 'Equinox e Hyperice (estética e tom)', concorrentes: 'Duas academias e uma clínica no bairro',
      hashtags: '#wellness #saude #longevidade', aprovador: c.contato || '', redes: 'Instagram, TikTok', linkDrive: '', logoUrl: '',
      corPrimaria: ['#1F4E79', '#2E5E4E', '#5B4A7A', '#B5683A', '#7A5C3E', '#C0392B', '#2A7F62', '#1D3557'][i], corSecundaria: '#F4F1EA',
      frequencia: [4, 3, 3, 5, 3, 4, 2, 4][i], pilares: p.pilares, formatosMeta: { Reels: 40, Carrossel: 35, Post: 15, Stories: 10 },
      inicio: data(240 - i * 20), igUltimoPost: data([1, 2, 4, 9, 3, 1, 21, 6][i]), igPostsMes: String([9, 7, 5, 3, 6, 10, 1, 4][i]),
      igSeguidores: seguidores[i], igVerificadoEm: agora, igErro: '', atualizadoEm: agora, atualizadoPor: eu.email,
    });
    // Conteúdos publicados nos últimos 60 dias, para a frequência e a distribuição por pilar e formato.
    const fmts = ['Reels', 'Carrossel', 'Reels', 'Post', 'Carrossel', 'Stories', 'Reels'];
    const total = i === 6 ? 3 : 6 + (i % 4) * 2;
    for (let k = 0; k < total; k++) {
      const pil = p.pilares[(k + i) % p.pilares.length].nome;
      inserir_('posts', {
        id: novoId_('po'), clienteId: c.id, titulo: pil + ' · peça ' + (k + 1), formato: fmts[(k + i) % fmts.length], rede: 'Instagram', status: 'publicado',
        data: data(3 + Math.round(k * 55 / total)), hora: '18:00', responsavel: eu.email, legenda: '', link: '', obs: '', pilar: pil,
        criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
      });
    }
    // Pedidos esperando ir para o calendário.
    [['Post sobre o novo horário de domingo', 'cliente', 'alta'], ['Série "mitos e verdades"', 'ideia', 'normal'], ['Bastidores com a equipe', 'ideia', 'baixa']]
      .slice(0, 1 + (i % 3)).forEach(function (pe, k) {
        inserir_('pedidos', {
          id: novoId_('pe'), clienteId: c.id, titulo: pe[0], descricao: pe[1] === 'cliente' ? 'Pedido feito pelo WhatsApp do cliente.' : '', origem: pe[1],
          formato: ['Reels', 'Carrossel', 'Stories'][k], pilar: p.pilares[k % p.pilares.length].nome, prioridade: pe[2], prazo: k === 0 ? data(-5) : '',
          status: 'pendente', postId: '', criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
        });
      });
    // Jornada: feedback, ajuste depois do feedback, overdelivering e elogio.
    const j = function (o) { return inserir_('jornada', Object.assign({ id: novoId_('jo'), clienteId: c.id, campo: '', de: '', para: '', sentimento: '', refId: '', autor: eu.email, criadoEm: agora }, o)); };
    j({ data: data(200 - i * 20), tipo: 'marco', titulo: 'Início da gestão de social media', texto: 'Onboarding e diagnóstico do perfil.' });
    const fb = j({ data: data(40 - i), tipo: 'feedback', titulo: 'Cliente pediu linguagem mais leve', texto: 'Na reunião mensal, achou os textos técnicos demais para o público do Instagram.', sentimento: 'neutro' });
    j({ data: data(38 - i), tipo: 'ajuste', titulo: 'Tom de voz atualizado', texto: 'Depois do feedback: ' + fb.titulo, campo: 'tomVoz', de: 'Técnico e formal.', para: p.tomVoz, refId: fb.id });
    j({ data: data(15 - i), tipo: 'overdelivering', titulo: 'Cobertura extra do evento da unidade', texto: 'Stories ao vivo e um reels recap sem custo adicional.', sentimento: 'positivo' });
    j({ data: data(8), tipo: 'feedback', titulo: 'Elogio ao carrossel educativo', texto: 'Recebeu mensagens de clientes comentando o conteúdo.', sentimento: 'positivo' });
    // Reports dos três últimos meses fechados.
    for (let r = 3; r >= 1; r--) {
      const base = seguidores[i] * (1 - r * 0.03);
      inserir_('reports', {
        id: novoId_('rp'), clienteId: c.id, mes: mesAtras(r), seguidores: Math.round(base), novosSeguidores: Math.round(base * 0.03),
        alcance: Math.round(base * (2.2 + (3 - r) * 0.3)), impressoes: Math.round(base * (5 + (3 - r) * 0.6)), interacoes: Math.round(base * 0.18),
        engajamento: Math.round((3.1 + (3 - r) * 0.4 + i * 0.1) * 10) / 10, visitasPerfil: Math.round(base * 0.12), cliquesLink: Math.round(base * 0.02),
        postsPublicados: 10 + (i % 4) * 2, destaques: 'Reels de bastidores foi o conteúdo de maior alcance do mês.',
        resultados: 'Alcance cresceu com a entrada de reels educativos. Directs pedindo informação aumentaram.',
        ajustes: 'Aumentar carrosséis educativos e reduzir posts estáticos de oferta.', proximosPassos: 'Testar série semanal fixa e collab com especialista.',
        arquivoUrl: '', arquivoNome: '', criadoPor: eu.email, criadoEm: agora, atualizadoEm: agora,
      });
    }
  }
  // Os conteúdos que já existiam ganham um pilar do cliente.
  const marcas = {};
  ler_('marcas').forEach(function (m) { marcas[m.clienteId] = m; });
  ler_('posts').forEach(function (p, k) {
    const m = marcas[p.clienteId];
    if (!p.pilar && m && m.pilares.length) atualizar_('posts', p.id, { pilar: m.pilares[k % m.pilares.length].nome });
  });
  return { marcas: n };
}
