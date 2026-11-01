const test = require('node:test');
const assert = require('node:assert/strict');
const { novoEstado, executar } = require('../dev/gas.js');

const DONO = 'dono@agencia.dev';
const SOC = 'soc@agencia.dev';
const TRA = 'tra@agencia.dev';

// Agência com uma pessoa da social, uma do tráfego e um cliente.
function agencia() {
  const estado = novoEstado();
  const como = (usuario) => (fn, ...args) => executar(estado, { usuario, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, args);
  const c = { estado, dono: como(DONO), soc: como(SOC), tra: como(TRA) };
  c.dono('carregar');
  c.dono('salvarMembro', { email: SOC, nome: 'Sô Cial', papel: 'colaborador', areas: ['social'] });
  c.dono('salvarMembro', { email: TRA, nome: 'Trá Fego', papel: 'colaborador', areas: ['trafego'] });
  c.cliente = c.dono('salvarCliente', { nome: 'Spa Raízes', instagram: '@sparaizes' });
  return c;
}

test('marca: criar registra o marco na jornada; só a social vê e mexe', () => {
  const c = agencia();
  const m = c.soc('salvarMarca', { clienteId: c.cliente.id, fase: 'Captação de leads', frequencia: '4', corPrimaria: '#1f4e79', pilares: [{ nome: 'Educação', meta: 40 }, { nome: '', meta: 10 }] });
  assert.equal(m.status, 'ativo');
  assert.equal(m.fase, 'Captação de leads');
  assert.equal(m.frequencia, 4);
  assert.deepEqual(m.pilares, [{ nome: 'Educação', meta: 40 }], 'pilar sem nome é descartado');
  const d = c.soc('carregar');
  assert.equal(d.marcas.length, 1);
  assert.equal(d.jornada.length, 1);
  assert.equal(d.jornada[0].tipo, 'marco');
  assert.ok(d.listas.fasesEstrategia.length >= 6);
  assert.equal(c.tra('carregar').marcas.length, 0);
  assert.throws(() => c.tra('salvarMarca', { clienteId: c.cliente.id }), /Social media/);
  assert.throws(() => c.soc('salvarMarca', { clienteId: 'nao-existe' }), /cliente/);
});

test('marca: valores inválidos caem no padrão (fase, cor, status)', () => {
  const c = agencia();
  const m = c.soc('salvarMarca', { clienteId: c.cliente.id, fase: 'Inventada', corPrimaria: 'vermelho', status: 'xyz', frequencia: 999 });
  assert.equal(m.fase, 'Criação de base');
  assert.equal(m.corPrimaria, '');
  assert.equal(m.status, 'ativo');
  assert.equal(m.frequencia, 50);
});

test('marca: editar só muda o que veio e cada mudança estratégica vira ajuste ligado ao feedback', () => {
  const c = agencia();
  c.soc('salvarMarca', { clienteId: c.cliente.id, tomVoz: 'Sereno', persona: 'Mulheres 30+' });
  const fb = c.soc('salvarJornada', { clienteId: c.cliente.id, tipo: 'feedback', titulo: 'Quer um tom mais próximo', sentimento: 'neutro' });
  const m = c.soc('salvarMarca', { clienteId: c.cliente.id, tomVoz: 'Próximo e acolhedor', feedbackId: fb.id });
  assert.equal(m.persona, 'Mulheres 30+', 'campo que não veio continua igual');
  const ajustes = c.soc('carregar').jornada.filter((j) => j.tipo === 'ajuste');
  assert.equal(ajustes.length, 1);
  assert.equal(ajustes[0].campo, 'tomVoz');
  assert.equal(ajustes[0].de, 'Sereno');
  assert.equal(ajustes[0].para, 'Próximo e acolhedor');
  assert.equal(ajustes[0].refId, fb.id);
  c.soc('salvarMarca', { clienteId: c.cliente.id, tomVoz: 'Próximo e acolhedor' });
  assert.equal(c.soc('carregar').jornada.filter((j) => j.tipo === 'ajuste').length, 1, 'salvar sem mudar não registra nada');
});

test('jornada: título obrigatório; só o autor ou um gestor apaga', () => {
  const c = agencia();
  const OUTRA = 'outra@agencia.dev';
  c.dono('salvarMembro', { email: OUTRA, nome: 'Ou Tra', papel: 'colaborador', areas: ['social'] });
  const outra = (fn, ...a) => executar(c.estado, { usuario: OUTRA, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, a);
  assert.throws(() => c.soc('salvarJornada', { clienteId: c.cliente.id, titulo: '  ' }), /título/);
  const j = c.soc('salvarJornada', { clienteId: c.cliente.id, tipo: 'overdelivering', titulo: 'Reels extra no aniversário' });
  assert.equal(j.tipo, 'overdelivering');
  assert.throws(() => outra('removerJornada', j.id), /Só quem registrou/);
  assert.equal(c.soc('removerJornada', j.id), true);
  assert.equal(c.soc('carregar').jornada.length, 0);
});

test('pedidos: entram pendentes, alocar vira post na pauta, não aloca duas vezes', () => {
  const c = agencia();
  assert.throws(() => c.soc('salvarPedido', { clienteId: c.cliente.id, titulo: '' }), /Descreva/);
  const p = c.soc('salvarPedido', { clienteId: c.cliente.id, titulo: 'Horário de domingo', origem: 'cliente', formato: 'Reels', pilar: 'Serviços', prioridade: 'alta' });
  assert.equal(p.status, 'pendente');
  assert.equal(p.prioridade, 'alta');
  assert.throws(() => c.soc('alocarPedido', p.id, ''), /dia/);
  const r = c.soc('alocarPedido', p.id, '2026-10-20', TRA);
  assert.equal(r.pedido.status, 'alocado');
  assert.equal(r.pedido.postId, r.post.id);
  assert.equal(r.post.status, 'pauta');
  assert.equal(r.post.data, '2026-10-20');
  assert.equal(r.post.formato, 'Reels');
  assert.equal(r.post.pilar, 'Serviços');
  assert.match(r.post.obs, /Pedido do cliente/);
  assert.equal(r.post.responsavel, TRA, 'responsável ativo da equipe é aceito');
  assert.throws(() => c.soc('alocarPedido', p.id, '2026-10-21'), /já está no calendário/);
  assert.equal(c.soc('carregar').posts.length, 1);
});

test('pedidos: descartar e voltar; responsável de fora da equipe cai em quem alocou', () => {
  const c = agencia();
  const p = c.soc('salvarPedido', { clienteId: c.cliente.id, titulo: 'Ideia de carrossel' });
  assert.equal(p.origem, 'ideia');
  assert.equal(c.soc('descartarPedido', p.id).status, 'descartado');
  assert.equal(c.soc('descartarPedido', p.id, true).status, 'pendente');
  const r = c.soc('alocarPedido', p.id, '2026-11-02', 'estranho@fora.dev');
  assert.equal(r.post.responsavel, SOC);
});

test('reports: um por cliente por mês, números limpos e mês obrigatório', () => {
  const c = agencia();
  assert.throws(() => c.soc('salvarReport', { clienteId: c.cliente.id, mes: '2026/09' }), /mês/);
  const r = c.soc('salvarReport', { clienteId: c.cliente.id, mes: '2026-09', seguidores: '12500', alcance: -5, engajamento: '4.6', ajustes: 'Mais reels' });
  assert.equal(r.seguidores, 12500);
  assert.equal(r.alcance, 0, 'negativo vira zero');
  assert.equal(r.engajamento, 4.6);
  assert.equal(r.arquivoUrl || '', '', 'sem PDF, sem arquivo');
  assert.throws(() => c.soc('salvarReport', { clienteId: c.cliente.id, mes: '2026-09' }), /Já existe/);
  const ed = c.soc('salvarReport', { id: r.id, clienteId: c.cliente.id, mes: '2026-09', seguidores: 12600 });
  assert.equal(ed.seguidores, 12600);
  assert.throws(() => c.soc('removerReport', r.id), /papel/);
  assert.equal(c.dono('removerReport', r.id), true);
});

test('reports: PDF que não vai para o Drive não impede salvar os números', () => {
  const c = agencia();
  const r = c.soc('salvarReport', { clienteId: c.cliente.id, mes: '2026-08', seguidores: 100, pdf: { nome: 'r.pdf', base64: 'JVBERi0=' } });
  assert.equal(r.seguidores, 100);
});

test('Instagram: lê a última postagem, guarda o erro quando bloqueia e liga o gatilho diário', () => {
  const c = agencia();
  c.soc('salvarMarca', { clienteId: c.cliente.id });
  const ontem = Math.floor(Date.now() / 1000) - 86400;
  c.estado.instagram = { sparaizes: { codigo: 200, corpo: { data: { user: { edge_followed_by: { count: 3210 }, edge_owner_to_timeline_media: { edges: [{ node: { taken_at_timestamp: ontem } }, { node: { taken_at_timestamp: ontem - 86400 * 3 } }] } } } } } };
  const [m] = c.soc('verificarInstagram', c.cliente.id);
  assert.equal(m.igErro, '');
  assert.equal(m.igSeguidores, 3210);
  assert.match(m.igUltimoPost, /^\d{4}-\d{2}-\d{2}$/);
  const guardado = m.igUltimoPost;
  c.estado.instagram.sparaizes = { codigo: 429, corpo: '' };
  const [m2] = c.soc('verificarInstagram', c.cliente.id);
  assert.match(m2.igErro, /recusou/);
  assert.equal(m2.igUltimoPost, guardado, 'erro não apaga a data que já tinha');
  assert.throws(() => c.soc('ligarVerificacaoInstagram', true), /papel/);
  assert.equal(c.dono('ligarVerificacaoInstagram', true), true);
  assert.equal(c.dono('ligarVerificacaoInstagram', true), true, 'ligar de novo não duplica');
  assert.equal(c.estado.gatilhos.filter((g) => g.fn === 'verificarInstagramDiario').length, 1);
  assert.equal(c.soc('carregar').igDiario, true);
  assert.equal(c.dono('ligarVerificacaoInstagram', false), false);
});

test('Instagram: cliente sem @ e clientes em pausa', () => {
  const c = agencia();
  const sem = c.dono('salvarCliente', { nome: 'Box Pulso' });
  c.soc('salvarMarca', { clienteId: sem.id });
  c.soc('salvarMarca', { clienteId: c.cliente.id, status: 'pausa' });
  const l = c.soc('verificarInstagram');
  assert.equal(l.length, 1, 'em pausa fica de fora da rodada geral');
  assert.match(l[0].igErro, /cadastre o @/);
});

test('exemplo da social: só o admin carrega, e só uma vez', () => {
  const c = agencia();
  c.dono('salvarCliente', { nome: 'Box Pulso' });
  assert.throws(() => c.soc('popularSocialExemplo'), /papel/);
  const r = c.dono('popularSocialExemplo');
  assert.ok(r.marcas >= 1);
  const d = c.dono('carregar');
  assert.ok(d.pedidos.length && d.jornada.length && d.reports.length);
  assert.throws(() => c.dono('popularSocialExemplo'), /já/i);
});

test('ping: com o carimbo da tela devolve o do servidor; sem ele, só a lista (páginas antigas)', () => {
  const c = agencia();
  assert.ok(Array.isArray(c.soc('ping', 'social')));
  const r = c.soc('ping', 'social', '2026-01-01 00:00');
  assert.equal(r.build, 'dev');
  assert.ok(Array.isArray(r.online));
});

test('Reportei: lê o PDF (texto) com Instagram, LinkedIn, posts, stories e a análise', () => {
  const c = agencia();
  const texto = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'reportei-exemplo.txt'), 'utf8');
  const r = c.soc('lerReportei', texto);
  assert.equal(r.periodoIni, '2026-09-09');
  assert.equal(r.mes, '2026-09', 'mês com mais dias no período');
  assert.deepEqual([r.instagram.seguidores, r.instagram.alcanceOrganico, r.instagram.alcancePago, r.instagram.alcance], [5210, 1340, 11060, 12400]);
  assert.equal(r.instagram.visualizacoes, 48900);
  assert.equal(r.posts.length, 2);
  assert.equal(r.posts[0].salvos, 20);
  assert.equal(r.posts[0].taxa, 14.19);
  assert.equal(r.reels.length, 1);
  assert.equal(r.reels[0].data, '2026-09-15');
  assert.equal(r.stories.length, 1);
  assert.equal(r.cidades[1].cidade, 'Campinas, São Paulo (estado)');
  assert.equal(r.analise.length, 2);
  assert.equal(r.analise[0].acoes.length, 2);
  assert.match(r.analise[1].texto, /^Nos conteúdos analisados/);
  assert.equal(r.linkedin.seguidores, 820);
  assert.equal(r.linkedin.postagens.length, 2);
  assert.equal(r.linkedin.postagens[0].taxa, 5.48);
  assert.throws(() => c.soc('lerReportei', 'um texto qualquer'), /Reportei/);
  assert.throws(() => c.tra('lerReportei', texto), /Social media/);

  // Salvar com o detalhe: números novos e a análise guardados no report.
  const salvo = c.soc('salvarReport', { clienteId: c.cliente.id, mes: r.mes, fonte: 'reportei', periodoIni: r.periodoIni, periodoFim: r.periodoFim,
    seguidores: r.instagram.seguidores, alcance: r.instagram.alcance, alcanceOrganico: r.instagram.alcanceOrganico, alcancePago: r.instagram.alcancePago,
    liSeguidores: r.linkedin.seguidores, detalhe: { posts: r.posts, reels: r.reels, stories: r.stories, cidades: r.cidades, analise: r.analise, linkedin: r.linkedin.postagens } });
  assert.equal(salvo.fonte, 'reportei');
  assert.equal(salvo.alcanceOrganico, 1340);
  assert.equal(salvo.liSeguidores, 820);
  assert.equal(salvo.detalhe.posts.length, 2);
  assert.equal(salvo.detalhe.analise[0].acoes.length, 2);
  assert.equal(c.soc('carregar').reports[0].detalhe.linkedin.length, 2);
});

test('Reportei: conserta as palavras que o pdf.js quebra nas ligaduras', () => {
  const c = agencia();
  const limpo = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'reportei-exemplo.txt'), 'utf8');
  const quebrado = limpo.replace(/Interações/g, 'Int erações').replace(/Compartilhamentos/g, 'Compart ilhament os').replace(/Data:/g, 'Dat a:')
    .replace(/Visitas do perfil/g, 'Visitas do per\u0000\u0000l').replace(/Visitas ao Perfil/g, 'Visit as ao Perf il').replace(/Postagem/g, 'Post agem')
    .replace(/Curtidas/g, 'Curt idas').replace(/Comentários/g, 'Coment ários').replace(/Retenção/g, 'Ret enção');
  const a = c.soc('lerReportei', limpo), b = c.soc('lerReportei', quebrado);
  assert.deepEqual(b.instagram, a.instagram);
  assert.equal(b.posts.length, a.posts.length);
  assert.equal(b.stories.length, 1);
  assert.equal(b.stories[0].visitasPerfil, 2);
});

test('quadro: blocos por cliente, frequência editável e configuração da agenda', () => {
  const c = agencia();
  const m = c.soc('salvarMarca', { clienteId: c.cliente.id });
  assert.deepEqual(m.blocos, ['frequencia', 'estoque', 'pedidos'], 'blocos padrão');
  assert.deepEqual(m.entregasEvento, ['Story', 'Feed Instagram', 'LinkedIn']);
  const m2 = c.soc('salvarMarca', { clienteId: c.cliente.id, blocos: ['eventos', 'temas', 'inventado', 'temas'], nicho: 'RH e treinamento corporativo', frequencia: 3 });
  assert.deepEqual(m2.blocos, ['eventos', 'temas']);
  assert.equal(m2.nicho, 'RH e treinamento corporativo');
  assert.equal(m2.frequencia, 3);
  assert.deepEqual(c.soc('salvarMarca', { clienteId: c.cliente.id, frequencia: 5 }).blocos, ['eventos', 'temas'], 'mudar a frequência não mexe nos blocos');
});

test('temas e cases: fila ordenada, reordenar e levar para a pauta', () => {
  const c = agencia();
  const a = c.soc('salvarTema', { clienteId: c.cliente.id, tipo: 'case', titulo: 'Case Senac' });
  const b = c.soc('salvarTema', { clienteId: c.cliente.id, tipo: 'case', titulo: 'Case Sesi' });
  const t = c.soc('salvarTema', { clienteId: c.cliente.id, tipo: 'tema', titulo: 'Liderança em times remotos' });
  assert.deepEqual([a.ordem, b.ordem, t.ordem], [1, 2, 1], 'cada tipo tem a sua fila');
  const ord = c.soc('ordenarTemas', [b.id, a.id]);
  assert.deepEqual(ord.map((x) => x.titulo), ['Case Sesi', 'Case Senac']);
  const r = c.soc('usarTema', a.id, '2026-11-20');
  assert.equal(r.tema.status, 'usado');
  assert.equal(r.post.temaId, a.id);
  assert.equal(r.post.formato, 'Carrossel');
  assert.throws(() => c.soc('usarTema', a.id, '2026-11-21'), /já está/);
  assert.equal(c.soc('carregar').temas.length, 3);
  assert.throws(() => c.tra('salvarTema', { clienteId: c.cliente.id, titulo: 'x' }), /Social media/);
});

test('agenda: só eventos com PAX entram, com as peças de cada evento ligadas a posts', () => {
  const c = agencia();
  c.soc('salvarMarca', { clienteId: c.cliente.id, agendaFiltro: '' });
  const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
  c.estado.agenda = [
    { id: 'e1', titulo: 'Treinamento Senac · 25 PAX', inicio: dia(5), fim: dia(5), local: 'Senac SP' },
    { id: 'e2', titulo: 'Reunião interna', inicio: dia(2), fim: dia(2) },
    { id: 'e3', titulo: 'Workshop liderança', descricao: 'PAX: 40', inicio: dia(-10), fim: dia(-10) },
  ];
  const evs = c.soc('sincronizarAgenda', c.cliente.id);
  assert.deepEqual(evs.map((e) => e.pax).sort((x, y) => x - y), [25, 40]);
  const e1 = evs.find((e) => e.pax === 25);
  const r = c.soc('criarEntregaEvento', e1.id, 'Story');
  assert.equal(r.post.formato, 'Stories');
  assert.equal(r.post.eventoId, e1.id);
  assert.equal(r.evento.entregas.Story, r.post.id);
  const li = c.soc('criarEntregaEvento', e1.id, 'LinkedIn').post;
  assert.equal(li.rede, 'LinkedIn');
  assert.throws(() => c.soc('criarEntregaEvento', e1.id, 'Story'), /já está/);
  // editar o post pelo formulário comum (sem eventoId) não solta a ligação; o link da publicação fica guardado
  const ed = c.soc('salvarPost', Object.assign({}, li, { eventoId: undefined, linkPost: 'https://www.linkedin.com/posts/x', status: 'publicado' }));
  assert.equal(ed.eventoId, e1.id);
  assert.equal(ed.linkPost, 'https://www.linkedin.com/posts/x');
  // sincronizar de novo mantém as peças
  assert.equal(c.soc('sincronizarAgenda', c.cliente.id).find((e) => e.id === e1.id).entregas.Story, r.post.id);
  // filtro por texto
  c.soc('salvarMarca', { clienteId: c.cliente.id, agendaFiltro: 'senac' });
  c.estado.agenda.push({ id: 'e4', titulo: 'Outro cliente 12 pax', inicio: dia(3) });
  assert.ok(!c.soc('sincronizarAgenda', c.cliente.id).some((e) => e.titulo.startsWith('Outro')));
});
