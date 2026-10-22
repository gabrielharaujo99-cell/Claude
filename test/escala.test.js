// Escala: gravações que não dependem do tamanho da planilha, presença sem trava e arquivo morto do histórico.
const test = require('node:test');
const assert = require('node:assert/strict');
const { novoEstado, executar } = require('../dev/gas.js');

const DONO = 'dono@agencia.dev';
const ANA = 'ana@agencia.dev';

function crm() {
  const estado = novoEstado();
  const como = (usuario) => (fn, ...args) => executar(estado, { usuario, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, args);
  const c = { estado, dono: como(DONO), ana: como(ANA) };
  c.dono('carregar');
  c.dono('salvarMembro', { email: ANA, nome: 'Ana Souza', papel: 'colaborador', areas: ['comercial'] });
  return c;
}

// Linhas antigas entram no topo do histórico, como numa planilha em uso há meses.
function encherHistorico(estado, n, diasAtras) {
  const h = estado.abas.historico, modelo = h[h.length - 1];
  const ts = new Date(Date.now() - diasAtras * 864e5).toISOString();
  for (let i = 0; i < n; i++) { const l = modelo.slice(); l[0] = 'h_antigo_' + i; l[1] = ts; h.splice(1, 0, l); }
}

test('mover um card não lê o histórico, por maior que ele seja', () => {
  const c = crm();
  const op = c.ana('salvarOportunidade', { titulo: 'Site novo', clienteNome: 'Café Aurora' });
  const etapas = c.ana('carregar').config.etapas;
  encherHistorico(c.estado, 20000, 10);
  c.estado.celulas = 0;
  const movida = c.ana('moverOportunidade', op.id, etapas[1].id, 0);
  assert.equal(movida.etapa, etapas[1].id);
  assert.ok(c.estado.celulas < 2000, 'leu ' + c.estado.celulas + ' células');
  const hist = c.ana('detalheOportunidade', op.id).historico;
  assert.equal(hist[0].acao, 'moveu', 'a linha nova entra no fim do histórico');
});

test('editar e remover pelo caminho leve continuam corretos', () => {
  const c = crm();
  const op = c.ana('salvarOportunidade', { titulo: 'Tráfego', clienteNome: 'Pet Amigo', valor: '1000' });
  const editada = c.ana('salvarOportunidade', Object.assign({}, op, { titulo: 'Tráfego pago', valor: '1500' }));
  assert.equal(editada.titulo, 'Tráfego pago');
  assert.equal(editada.valor, 1500);
  const com = c.ana('comentar', op.id, 'Proposta enviada.', []);
  assert.equal(c.ana('detalheOportunidade', op.id).comentarios.length, 1);
  assert.equal(c.ana('removerComentario', com.id), true);
  assert.equal(c.ana('detalheOportunidade', op.id).comentarios.length, 0);
  assert.equal(c.ana('carregar').oportunidades.find((o) => o.id === op.id).titulo, 'Tráfego pago');
});

test('presença: cada pessoa marca a própria chave e some ao sair', () => {
  const c = crm();
  c.dono('ping', 'inicio');
  const lista = c.ana('ping', 'funil');
  assert.deepEqual(lista.map((p) => p.email).sort(), [ANA, DONO].sort());
  assert.equal(lista.find((p) => p.email === ANA).tela, 'funil');
  c.ana('sair');
  assert.deepEqual(c.dono('ping', 'inicio').map((p) => p.email), [DONO]);
});

test('manutenção: o histórico antigo vai para o arquivo e o recente fica', () => {
  const c = crm();
  const op = c.ana('salvarOportunidade', { titulo: 'Branding', clienteNome: 'Ateliê Nove' });
  encherHistorico(c.estado, 300, 400);
  const antes = c.estado.abas.historico.length - 1;
  const r = c.dono('rodarManutencaoAgora');
  assert.equal(r.arquivadas, 300);
  assert.equal(c.estado.abas.historico.length - 1, antes - 300);
  assert.equal(c.estado.abas.historico_arquivo.length - 1, 300);
  assert.equal(c.ana('detalheOportunidade', op.id).historico[0].acao, 'criou');
  assert.equal(c.dono('rodarManutencaoAgora').arquivadas, 0, 'rodar de novo não move nada');
  assert.throws(() => c.ana('rodarManutencaoAgora'), /não permite/);
});

// Troca um campo direto na planilha, para simular um registro antigo.
function mudar(estado, aba, id, campo, valor) {
  const linhas = estado.abas[aba], col = linhas[0].indexOf(campo);
  linhas.find((l) => l[0] === id)[col] = valor;
}
const haDias = (n) => new Date(Date.now() - n * 864e5).toISOString();

test('abertura recortada: o encerrado há muito tempo fica fora e vem sob demanda', () => {
  const c = crm();
  const projeto = c.ana('salvarOportunidade', { titulo: 'Site 2024', clienteNome: 'Café Aurora', contrato: 'projeto', valor: '8000' });
  const fee = c.ana('salvarOportunidade', { titulo: 'Social 24 meses', clienteNome: 'Café Aurora', contrato: 'fee', valor: '3000', meses: 24 });
  const comTarefa = c.ana('salvarOportunidade', { titulo: 'Tráfego 2024', clienteNome: 'Café Aurora' });
  [projeto, fee, comTarefa].forEach((o) => {
    c.ana('moverOportunidade', o.id, 'ganho', 0);
    mudar(c.estado, 'oportunidades', o.id, 'fechadoEm', haDias(400));
  });
  const velha = c.ana('salvarTarefa', { titulo: 'Briefing antigo', status: 'feito', oportunidadeId: projeto.id });
  mudar(c.estado, 'tarefas', velha.id, 'concluidoEm', haDias(200));
  c.ana('salvarTarefa', { titulo: 'Renovar contrato', oportunidadeId: comTarefa.id });

  const d = c.ana('carregar');
  const ids = d.oportunidades.map((o) => o.id);
  assert.ok(!ids.includes(projeto.id), 'projeto fechado há 400 dias sai');
  assert.ok(ids.includes(fee.id), 'fee de 24 meses ainda em vigor fica');
  assert.ok(ids.includes(comTarefa.id), 'oportunidade com tarefa aberta fica');
  assert.ok(!d.tarefas.some((t) => t.id === velha.id), 'tarefa concluída há 200 dias sai');
  assert.deepEqual([d.antigos.oportunidades, d.antigos.tarefas, d.antigos.posts], [1, 1, 0]);
  assert.match(d.antigos.desde.tarefas, /^\d{4}-\d{2}-\d{2}$/);

  const a = c.ana('carregarAntigos');
  assert.deepEqual(a.oportunidades.map((o) => o.id), [projeto.id]);
  assert.deepEqual(a.tarefas.map((t) => t.id), [velha.id]);
});

test('abertura recortada: quem não é do comercial não recebe oportunidades antigas', () => {
  const c = crm();
  const op = c.ana('salvarOportunidade', { titulo: 'Antiga', clienteNome: 'Pet Amigo' });
  c.ana('moverOportunidade', op.id, 'perdido', 0, 'preço');
  mudar(c.estado, 'oportunidades', op.id, 'fechadoEm', haDias(500));
  c.dono('salvarMembro', { email: 'leo@agencia.dev', nome: 'Leo Dias', papel: 'colaborador', areas: ['social'] });
  const leo = (fn, ...args) => executar(c.estado, { usuario: 'leo@agencia.dev', dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, args);
  assert.equal(leo('carregar').antigos.oportunidades, 0);
  assert.deepEqual(leo('carregarAntigos').oportunidades, []);
});

test('manutenção: o gatilho diário é instalado uma vez só', () => {
  const c = crm();
  c.dono('carregar');
  c.ana('carregar');
  const g = c.estado.gatilhos.filter((x) => x.fn === 'gatilhoManutencao');
  assert.equal(g.length, 1);
  assert.equal(g[0].hora, 3);
  assert.throws(() => c.dono('gatilhoManutencao', { triggerUid: 'falso' }), /só roda pelo gatilho/);
  assert.deepEqual(c.dono('gatilhoManutencao', { triggerUid: g[0].id }), { arquivadas: 0 });
});
