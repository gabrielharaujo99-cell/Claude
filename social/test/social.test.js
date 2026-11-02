const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { novoEstado, executar } = require('../../dev/gas.js');

const SRC = path.join(__dirname, '..', 'src');
const DONO = 'dono@seok.dev';

function app() {
  const estado = novoEstado();
  const como = (usuario) => (fn, ...args) => executar(estado, { usuario, dono: DONO, src: SRC }, fn, args);
  return { estado, dono: como(DONO), equipe: como(''), fora: como('x@fora.dev') };
}

test('primeiro acesso: dono vira admin e os 6 clientes nascem com os blocos combinados', () => {
  const a = app();
  const d = a.dono('carregar');
  assert.equal(d.eu.papel, 'admin');
  assert.deepEqual(d.clientes.map((c) => c.nome), ['Metapel', 'Outbox', 'Content Lab', 'Pietro', 'Seok Wellness', 'Nap Briddle']);
  const ob = d.clientes.find((c) => c.nome === 'Outbox');
  assert.deepEqual(ob.blocos, ['frequencia', 'eventos', 'temas', 'pedidos']);
  assert.deepEqual(ob.entregasEvento, ['Story', 'Feed Instagram', 'LinkedIn']);
  assert.equal(d.clientes.find((c) => c.nome === 'Content Lab').blocos[0], 'cases');
  assert.equal(a.dono('carregar').clientes.length, 6, 'não semeia de novo');
});

test('acesso: fechado por padrão; link aberto deixa a equipe de outro domínio entrar como editora', () => {
  const a = app();
  a.dono('carregar');
  assert.equal(a.equipe('carregar').semAcesso, true, 'padrão: só quem está na equipe');
  a.dono('salvarAjustes', { linkAberto: true });
  assert.equal(a.equipe('carregar').eu.papel, 'editor');
  assert.equal(a.fora('carregar').semAcesso, true, 'e-mail conhecido do domínio mas fora da equipe');
  a.dono('salvarAjustes', { linkAberto: false });
  assert.equal(a.equipe('carregar').semAcesso, true);
  assert.throws(() => a.equipe('salvarPost', {}), /acesso/);
});

test('cliente: frequência e blocos editáveis, nome obrigatório', () => {
  const a = app();
  const c = a.dono('carregar').clientes[0];
  const r = a.dono('salvarCliente', { id: c.id, frequencia: '3,5', blocos: ['estoque', 'inventado', 'estoque', 'cases'] });
  assert.equal(r.frequencia, 3.5);
  assert.deepEqual(r.blocos, ['estoque', 'cases']);
  assert.equal(r.nome, 'Metapel', 'o que não veio não muda');
  assert.throws(() => a.dono('salvarCliente', { id: c.id, nome: '' }), /nome/);
});

test('posts: data obrigatória para agendar, links validados, remover solta tema e pedido', () => {
  const a = app();
  const c = a.dono('carregar').clientes[1];
  assert.throws(() => a.dono('salvarPost', { clienteId: c.id, titulo: 'X', status: 'agendado' }), /data/);
  assert.throws(() => a.dono('salvarPost', { clienteId: c.id, titulo: 'X', linkPost: 'instagram.com/p/1' }), /https/);
  const t = a.dono('salvarTema', { clienteId: c.id, tipo: 'case', titulo: 'Case Senac' });
  const r = a.dono('temaParaPauta', t.id, '2026-11-20');
  assert.equal(r.post.formato, 'Carrossel');
  assert.throws(() => a.dono('temaParaPauta', t.id, '2026-11-21'), /já está/);
  assert.equal(a.dono('moverPost', r.post.id, 'agendado').status, 'agendado');
  a.dono('removerPost', r.post.id);
  assert.equal(a.dono('carregar').temas[0].status, 'aberto', 'tema volta para a fila');
});

test('cases: fila ordenável', () => {
  const a = app();
  const c = a.dono('carregar').clientes[2];
  const x = a.dono('salvarTema', { clienteId: c.id, tipo: 'case', titulo: 'A' });
  const y = a.dono('salvarTema', { clienteId: c.id, tipo: 'case', titulo: 'B' });
  assert.deepEqual(a.dono('ordenarTemas', [y.id, x.id]).map((t) => [t.titulo, t.ordem]), [['B', 1], ['A', 2]]);
});

test('pedidos: vira post na pauta e fica feito', () => {
  const a = app();
  const c = a.dono('carregar').clientes[0];
  const p = a.dono('salvarPedido', { clienteId: c.id, titulo: 'Post do novo horário', prioridade: 'alta', prazo: '2026-11-10' });
  const r = a.dono('pedidoParaPauta', p.id, '2026-11-08');
  assert.equal(r.pedido.status, 'feito');
  assert.equal(r.post.pedidoId, p.id);
});

test('agenda: só eventos com PAX, peças Story/Feed/LinkedIn ligadas ao evento', () => {
  const a = app();
  const ob = a.dono('carregar').clientes.find((c) => c.nome === 'Outbox');
  const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
  a.estado.agenda = [
    { id: 'e1', titulo: 'Treinamento Senac · 25 PAX', inicio: dia(4), local: 'Senac' },
    { id: 'e2', titulo: 'Reunião interna', inicio: dia(2) },
    { id: 'e3', titulo: 'Workshop', descricao: 'PAX: 40', inicio: dia(-8) },
  ];
  const evs = a.dono('sincronizarAgenda', ob.id);
  assert.deepEqual(evs.map((e) => e.pax).sort(), [25, 40]);
  const e1 = evs.find((e) => e.pax === 25);
  const s = a.dono('criarPeca', e1.id, 'Story');
  assert.equal(s.post.formato, 'Stories');
  assert.equal(a.dono('criarPeca', e1.id, 'LinkedIn').post.rede, 'LinkedIn');
  assert.throws(() => a.dono('criarPeca', e1.id, 'Story'), /já está/);
  a.dono('removerPost', s.post.id);
  assert.equal(a.dono('carregar').eventos.find((e) => e.id === e1.id).entregas.Story, undefined, 'peça removida volta a ficar pendente');
});

test('Reportei: lê o PDF (texto) e salva um relatório por mês, atualizando o mesmo', () => {
  const a = app();
  const c = a.dono('carregar').clientes[1];
  const texto = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'fixtures', 'reportei-exemplo.txt'), 'utf8');
  const r = a.dono('lerReportei', texto);
  assert.equal(r.instagram.alcanceOrganico, 1340);
  const base = { clienteId: c.id, mes: r.mes, seguidores: r.instagram.seguidores, alcanceOrganico: r.instagram.alcanceOrganico, detalhe: { posts: r.posts, analise: r.analise } };
  const s1 = a.dono('salvarReport', base);
  const s2 = a.dono('salvarReport', Object.assign({}, base, { seguidores: 9999 }));
  assert.equal(s2.id, s1.id);
  assert.equal(a.dono('carregar').reports.length, 1);
  assert.equal(a.dono('carregar').reports[0].detalhe.posts.length, 2);
});

test('tendências: Google Notícias sem a chave, IA com a chave; não repete', () => {
  const a = app();
  const c = a.dono('carregar').clientes[0];
  a.estado.http = [{ contem: 'news.google.com', corpo: '<rss><item><title>Check-up preventivo cresce - Folha</title><link>https://ex.com/a</link><source url="x">Folha</source></item></rss>' }];
  const r = a.dono('pesquisarTendencias', c.id);
  assert.equal(r.novos[0].titulo, 'Check-up preventivo cresce');
  assert.equal(a.dono('pesquisarTendencias', c.id).novos.length, 0);
  a.dono('salvarAjustes', { chaveIA: 'sk-ant-teste' });
  a.estado.http = [{ contem: 'api.anthropic.com', corpo: { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"tendencias":[{"titulo":"Longevidade no trabalho","porque":"x","ideia":"Reels"}]}' }] } }];
  assert.equal(a.dono('pesquisarTendencias', c.id).fonte, 'ia');
  const nap = a.dono('carregar').clientes.find((x) => x.nome === 'Nap Briddle');
  assert.throws(() => a.dono('pesquisarTendencias', nap.id), /nicho/);
});

test('marcos: título, data e cliente obrigatórios; edita e apaga', () => {
  const a = app();
  const c = a.dono('carregar').clientes[0];
  assert.throws(() => a.dono('salvarMarco', { clienteId: c.id, data: '2026-10-01' }), /título/);
  assert.throws(() => a.dono('salvarMarco', { clienteId: c.id, titulo: 'X' }), /data/);
  const m = a.dono('salvarMarco', { clienteId: c.id, titulo: 'Lançou a linha nova', data: '2026-10-01', tipo: 'lancamento' });
  assert.equal(a.dono('salvarMarco', { id: m.id, clienteId: c.id, titulo: 'Lançou a linha', data: '2026-10-02', tipo: 'xyz' }).tipo, 'conquista');
  const d = a.dono('carregar');
  assert.equal(d.marcos.length, 1);
  assert.ok(d.time.length >= 1, 'a barra de cima recebe a equipe');
  a.dono('removerMarco', m.id);
  assert.equal(a.dono('carregar').marcos.length, 0);
});

test('link pessoal: conta Gmail sem e-mail visível entra pela chave do link, com o papel dela', () => {
  const a = app();
  a.dono('carregar');
  const eq = a.dono('salvarMembro', { email: 'pessoa@gmail.com', papel: 'editor' });
  const k = eq.find((m) => m.email === 'pessoa@gmail.com').acesso;
  assert.match(k, /^[a-f0-9]{32}$/);
  assert.equal(a.equipe('rodar', '', 'carregar', []).semAcesso, true, 'sem chave, link fechado: sem acesso');
  const d = a.equipe('rodar', k, 'carregar', []);
  assert.equal(d.eu.email, 'pessoa@gmail.com');
  assert.equal(d.eu.papel, 'editor');
  assert.throws(() => a.equipe('rodar', k, 'salvarMembro', [{ email: 'x@y.com' }]), /acesso/);
  const k2 = a.dono('salvarMembro', { email: 'pessoa@gmail.com', papel: 'editor', novoLink: true }).find((m) => m.email === 'pessoa@gmail.com').acesso;
  assert.notEqual(k2, k);
  assert.equal(a.equipe('rodar', k, 'carregar', []).semAcesso, true, 'link antigo para de valer');
  assert.throws(() => a.dono('rodar', '', 'eu_', []), /desconhecida/);
});

test('perfil: cada pessoa troca o próprio nome e foto; foto inválida é recusada', () => {
  const a = app();
  a.dono('carregar');
  const k = a.dono('salvarMembro', { email: 'pessoa@gmail.com', papel: 'editor' }).find((m) => m.email === 'pessoa@gmail.com').acesso;
  assert.equal(a.equipe('rodar', k, 'carregar', []).eu.nome, 'Pessoa');
  const foto = 'data:image/jpeg;base64,' + 'A'.repeat(200);
  const p = a.equipe('rodar', k, 'salvarPerfil', [{ nome: 'Pessoa da Silva', foto }]);
  assert.equal(p.nome, 'Pessoa da Silva');
  assert.equal(p.foto, foto);
  const d = a.equipe('rodar', k, 'carregar', []);
  assert.equal(d.eu.foto, foto);
  assert.ok(d.time.some((m) => m.nome === 'Pessoa da Silva' && m.foto === foto));
  assert.throws(() => a.equipe('rodar', k, 'salvarPerfil', [{ foto: 'javascript:alert(1)' }]), /inválida/);
  assert.throws(() => a.equipe('rodar', k, 'atualizarPerfis', []), /acesso/);
});

test('agenda padrão: treinamentos vêm da agenda de outra conta; sem compartilhar, o erro explica o que fazer', () => {
  const a = app();
  const ob = a.dono('carregar').clientes.find((c) => c.nome === 'Outbox');
  const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
  a.estado.agenda = [
    { id: 'm1', agenda: 'social@gmail.com', titulo: 'Treinamento Natura · 18 PAX', inicio: dia(3) },
    { id: 'd1', titulo: 'Treinamento do dono · 50 PAX', inicio: dia(3) },
  ];
  assert.deepEqual(a.dono('sincronizarAgenda', ob.id).map((e) => e.pax), [50], 'sem agenda padrão: a do dono');
  assert.throws(() => a.dono('salvarAjustes', { agendaPadrao: 'sem arroba' }), /e-mail/);
  assert.equal(a.dono('salvarAjustes', { agendaPadrao: 'social@gmail.com' }).agendaPadrao, 'social@gmail.com');
  assert.ok(a.dono('sincronizarAgenda', ob.id).some((e) => e.pax === 18), 'com agenda padrão: a da social media');
  a.dono('salvarAjustes', { agendaPadrao: 'naocompartilhada@gmail.com' });
  assert.throws(() => a.dono('sincronizarAgenda', ob.id), /compartilhada com dono@seok\.dev/);
});
