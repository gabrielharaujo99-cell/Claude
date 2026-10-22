/**
 * Teste de carga do servidor no simulador (Fase 0 do estudo de viabilidade).
 * Mede quantas células da planilha cada operação lê, com o histórico em tamanhos diferentes.
 * Uso: node dev/carga.js [linhas de histórico...]   (padrão: 1000 10000 100000)
 * Para estimar tempo no Google: ~0,7 s a cada 100 mil células lidas (premissa do estudo, a confirmar no Apps Script real).
 */
const { novoEstado, executar } = require('./gas.js');

const DONO = 'dono@agencia.dev';
const TAMANHOS = process.argv.slice(2).map(Number).filter(Boolean);
const OPORTUNIDADES = 2000;

function cenario(linhasHistorico) {
  const estado = novoEstado();
  const run = (fn, ...args) => executar(estado, { usuario: DONO, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, args);
  const cfg = run('carregar').config;
  const op = run('salvarOportunidade', { titulo: 'Base', clienteNome: 'Cliente Base', contrato: 'fee', valor: 1000, meses: 12 });

  // Planilha de uma agência em uso: muitas oportunidades e um histórico longo (linhas antigas no topo).
  const ops = estado.abas.oportunidades, modeloOp = ops[1];
  for (let i = 0; i < OPORTUNIDADES; i++) { const l = modeloOp.slice(); l[0] = 'op_carga_' + i; ops.splice(1, 0, l); }
  const hist = estado.abas.historico, modeloH = hist[hist.length - 1];
  // Histórico recente (10 dias): o pior caso, numa agência grande; a manutenção corta pelo limite de linhas.
  const antigo = new Date(Date.now() - 10 * 864e5).toISOString();
  for (let i = 0; i < linhasHistorico; i++) { const l = modeloH.slice(); l[0] = 'h_carga_' + i; l[1] = antigo; hist.splice(1, 0, l); }

  const ops_ = [
    ['mover card', () => run('moverOportunidade', op.id, cfg.etapas[1].id, 0)],
    ['editar card', () => run('salvarOportunidade', Object.assign({}, op, { titulo: 'Base editada' }))],
    ['comentar', () => run('comentar', op.id, 'Liguei hoje.', [])],
    ['presença (ping)', () => run('ping', 'funil')],
    ['abrir card', () => run('detalheOportunidade', op.id)],
    ['abrir card*', () => { run('rodarManutencaoAgora'); estado.celulas = 0; run('detalheOportunidade', op.id); }],
  ];
  return ops_.map(([nome, fn]) => { estado.celulas = 0; fn(); return [nome, estado.celulas]; });
}

const tamanhos = TAMANHOS.length ? TAMANHOS : [1000, 10000, 100000];
const linhas = tamanhos.map((h) => ({ h, r: cenario(h) }));
const fmt = (n) => n.toLocaleString('pt-BR');
console.log('Células lidas por operação (' + fmt(OPORTUNIDADES) + ' oportunidades na planilha)\n');
console.log(['operação'.padEnd(18)].concat(tamanhos.map((h) => ('hist. ' + fmt(h)).padStart(16))).join(''));
linhas[0].r.forEach(([nome], i) => {
  console.log([nome.padEnd(18)].concat(linhas.map((x) => fmt(x.r[i][1]).padStart(16))).join(''));
});
console.log('\n* depois da manutenção diária (histórico principal com no máximo 20 mil linhas)');

// Abertura: o que o carregar manda para a tela numa agência com anos de uso.
function abertura() {
  const estado = novoEstado();
  const run = (fn, ...args) => executar(estado, { usuario: DONO, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, args);
  run('carregar');
  const op = run('salvarOportunidade', { titulo: 'Modelo', clienteNome: 'Cliente Base', contrato: 'projeto', valor: 5000 });
  run('salvarTarefa', { titulo: 'Modelo', oportunidadeId: op.id });
  run('salvarPost', { titulo: 'Modelo', clienteId: op.clienteId });
  const dias = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const clonar = (aba, n, mudar) => {
    const linhas = estado.abas[aba], cab = linhas[0], modelo = linhas[1];
    for (let i = 0; i < n; i++) {
      const l = modelo.slice(), set = (c, v) => { l[cab.indexOf(c)] = v; };
      set('id', aba + '_carga_' + i);
      mudar(set, i);
      linhas.push(l);
    }
  };
  // 80% das oportunidades fechadas há mais de um ano; 90% das tarefas concluídas há meses; 85% dos posts publicados há meses.
  clonar('oportunidades', 3000, (set, i) => { if (i % 5) { set('etapa', i % 2 ? 'ganho' : 'perdido'); set('fechadoEm', dias(400 + i % 300)); set('atualizadoEm', dias(400)); } });
  clonar('tarefas', 20000, (set, i) => { if (i % 10) { set('status', 'feito'); set('concluidoEm', dias(120 + i % 500)); } });
  clonar('posts', 6000, (set, i) => { if (i % 7) { set('status', 'publicado'); set('data', dias(200 + i % 400).slice(0, 10)); } });
  const d = run('carregar');
  const kb = Math.round(JSON.stringify(d).length / 1024);
  console.log('\nAbertura (carregar) numa agência com 3 mil oportunidades, 20 mil tarefas e 6 mil posts:');
  console.log('  ' + fmt(kb) + ' KB · ' + fmt(d.oportunidades.length) + ' oportunidades · ' + fmt(d.tarefas.length) + ' tarefas · ' + fmt(d.posts.length) + ' posts');
  if (d.antigos) {
    const a = run('carregarAntigos');
    console.log('  sob demanda (carregarAntigos): ' + fmt(Math.round(JSON.stringify(a).length / 1024)) + ' KB · ' +
      fmt(a.oportunidades.length) + ' oportunidades · ' + fmt(a.tarefas.length) + ' tarefas · ' + fmt(a.posts.length) + ' posts');
  }
}
abertura();
