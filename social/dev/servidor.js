/**
 * Servidor local do Seok Social: abre src/index.html com google.script.run trocado por HTTP ao simulador (../../dev/gas.js).
 *   node dev/servidor.js          http://localhost:8090 (dados em dev/.dados.json)
 *   node dev/servidor.js --demo   começa com posts, eventos, pedidos e relatórios de exemplo (fictícios)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { novoEstado, executar } = require('../../dev/gas.js');

const SRC = path.join(__dirname, '..', 'src');
const DADOS = path.join(__dirname, '.dados.json');
const PORTA = Number(process.env.PORT) || 8090;
const DONO = 'dono@seok.dev';

let estado = novoEstado();
const roda = (fn, ...args) => executar(estado, { usuario: DONO, dono: DONO, src: SRC }, fn, args);
try { if (!process.argv.includes('--demo')) estado = Object.assign(novoEstado(), JSON.parse(fs.readFileSync(DADOS, 'utf8'))); else throw 0; } catch (e) { semear(); }
function salvar() { fs.writeFileSync(DADOS, JSON.stringify(estado)); }

function semear() {
  estado = novoEstado();
  const d = roda('carregar');
  const c = Object.fromEntries(d.clientes.map((x) => [x.nome, x.id]));
  const dia = (n) => { const t = new Date(Date.now() + n * 864e5); return t.toISOString().slice(0, 10); };
  const post = (cli, titulo, n, status, formato, rede, porque) => roda('salvarPost', { clienteId: c[cli], titulo, data: dia(n), hora: '10:00', status, formato: formato || 'Post', rede: rede || 'Instagram', porque: porque || '' });
  roda('salvarCliente', { id: c.Outbox, objetivo: 'Ser lembrada pelo RH como referência em treinamento de liderança e encher as turmas abertas.' });
  roda('salvarCliente', { id: c.Metapel, objetivo: 'Educar sobre prevenção e levar agendamentos de check-up para as unidades.' });
  roda('salvarCliente', { id: c.Pietro, objetivo: 'Crescer a audiência orgânica com rotina e longevidade e vender a nova linha.' });
  // Histórico de publicados (8 semanas) com ritmos diferentes por cliente.
  const ritmo = { Metapel: 3, Outbox: 2, 'Content Lab': 3, Pietro: 3, 'Seok Wellness': 4, 'Nap Briddle': 1 };
  const fmts = ['Reels', 'Carrossel', 'Post', 'Reels', 'Carrossel'];
  Object.keys(ritmo).forEach((cli) => {
    for (let s = 1; s <= 8; s++) for (let k = 0; k < ritmo[cli] - (s % 3 === 0 ? 1 : 0); k++) post(cli, cli + ' · peça ' + s + '.' + (k + 1), -(s * 7) + k * 2, 'publicado', fmts[(s + k) % 5]);
  });
  // Estoque e próximos posts.
  post('Metapel', 'Check-up anual: o que pedir ao médico', 1, 'agendado', 'Carrossel', 'Instagram', 'Pergunta mais frequente no direct em outubro.');
  post('Metapel', 'Mitos do colesterol', 3, 'agendado', 'Reels');
  post('Metapel', 'Novembro Azul: prevenção', 5, 'aprovacao', 'Carrossel');
  post('Metapel', 'Bastidores do laboratório', 8, 'producao', 'Reels');
  post('Pietro', 'Rotina matinal em 5 passos', 2, 'agendado', 'Reels', 'Instagram', 'Reels de rotina tiveram o maior alcance orgânico do mês.');
  post('Pietro', 'Sono e longevidade', 4, 'agendado', 'Carrossel');
  post('Pietro', 'Respiração 4-7-8', 6, 'agendado', 'Reels');
  post('Pietro', 'Mitos sobre jejum', 9, 'agendado', 'Carrossel');
  post('Pietro', 'Q&A com seguidores', 11, 'aprovacao', 'Stories');
  post('Seok Wellness', 'Wellness corporativo em números', 1, 'agendado', 'Carrossel');
  post('Seok Wellness', 'Pausa ativa no escritório', 3, 'agendado', 'Reels');
  post('Seok Wellness', 'Depoimento: programa de 90 dias', 7, 'producao', 'Vídeo');
  post('Content Lab', 'Case: creator B2B que virou canal de vendas', 2, 'agendado', 'Carrossel');
  post('Content Lab', 'UGC x influenciador: quando usar', 5, 'aprovacao', 'Reels');
  post('Outbox', 'Liderança que escuta', 3, 'agendado', 'Carrossel', 'LinkedIn');
  post('Nap Briddle', 'Apresentação da marca', 6, 'ideia', 'Post');
  // Treinamentos da Outbox (Google Agenda com PAX).
  estado.agenda = [
    { id: 'ev1', titulo: 'Treinamento de Liderança · Senac · 32 PAX', inicio: new Date(new Date(Date.now() + 4 * 864e5).setHours(12, 0, 0, 0)).toISOString(), local: 'Senac Paulista' },
    { id: 'ev2', titulo: 'Workshop Feedback · Natura · 18 PAX', inicio: new Date(new Date(Date.now() + 11 * 864e5).setHours(17, 0, 0, 0)).toISOString(), local: 'Natura Cajamar' },
    { id: 'ev3', titulo: 'Comunicação não violenta · 45 PAX', inicio: new Date(new Date(Date.now() - 9 * 864e5).setHours(13, 0, 0, 0)).toISOString(), local: 'On-line' },
    { id: 'ev4', titulo: 'Reunião interna', inicio: new Date(Date.now() + 2 * 864e5).toISOString() },
  ];
  const evs = roda('sincronizarAgenda', c.Outbox);
  const prox = evs.find((e) => e.pax === 32), pass = evs.find((e) => e.pax === 45);
  roda('criarPeca', prox.id, 'Story');
  ['Story', 'Feed Instagram', 'LinkedIn'].forEach((t) => { const r = roda('criarPeca', pass.id, t); roda('moverPost', r.post.id, 'publicado', dia(-8)); });
  // Temas (Outbox), cases (Content Lab), tendências.
  ['Saúde mental da liderança', 'Feedback contínuo', 'Onboarding que retém', 'Gestão de conflitos'].forEach((t) => roda('salvarTema', { clienteId: c.Outbox, tipo: 'tema', titulo: t, descricao: 'Pauta valorizada pelo RH' }));
  ['Senac: trilha de líderes', 'Natura: cultura de feedback', 'Creator B2B da Totvs', 'Podcast interno do Itaú'].forEach((t) => roda('salvarTema', { clienteId: c['Content Lab'], tipo: 'case', titulo: t }));
  [['Metapel', 'Check-up preventivo cresce entre jovens adultos'], ['Metapel', 'Exames genéticos no SUS'], ['Pietro', 'Longevidade como estilo de vida'], ['Seok Wellness', 'Burnout volta à pauta das empresas'], ['Content Lab', 'Creators viram mídia própria das marcas']]
    .forEach(([cli, t]) => roda('salvarTema', { clienteId: c[cli], tipo: 'tendencia', titulo: t, fonte: 'Google Notícias', link: 'https://news.google.com/' }));
  // Pedidos.
  roda('salvarPedido', { clienteId: c.Metapel, titulo: 'Post do novo horário de sábado', prioridade: 'alta', prazo: dia(3) });
  roda('salvarPedido', { clienteId: c.Outbox, titulo: 'Divulgar vagas da turma de março', prazo: dia(10) });
  roda('salvarPedido', { clienteId: c.Pietro, titulo: 'Reels com a nova linha de suplementos', prioridade: 'alta', prazo: dia(5) });
  roda('salvarPedido', { clienteId: c['Nap Briddle'], titulo: 'Definir tom de voz e paleta', prazo: dia(14) });
  // Relatórios do Reportei (números fictícios), 3 meses.
  const meses = ['2026-08', '2026-09', '2026-10'];
  const base = { Metapel: 4200, Outbox: 2800, 'Content Lab': 6100, Pietro: 9800, 'Seok Wellness': 3500 };
  Object.keys(base).forEach((cli, i) => meses.forEach((m, j) => {
    const seg = Math.round(base[cli] * (1 + 0.025 * j + 0.01 * i * j));
    const org = Math.round(seg * (2.4 + 0.3 * j - 0.1 * i)), pago = Math.round(seg * (j === 1 ? 1.4 : 0.6));
    roda('salvarReport', { clienteId: c[cli], mes: m, seguidores: seg, alcance: org + pago, alcanceOrganico: org, alcancePago: pago, visualizacoes: (org + pago) * 3, interacoes: Math.round(seg * 0.18), visitasPerfil: Math.round(seg * 0.3),
      liSeguidores: cli === 'Outbox' ? 1200 + j * 90 : 0, liImpressoes: cli === 'Outbox' ? 8000 + j * 1500 : 0,
      detalhe: { posts: [
        { legenda: 'Carrossel educativo com 5 dicas práticas', tipo: 'Carrossel', alcance: Math.round(org * 0.22), interacoes: 410, salvos: 120, compartilhamentos: 64, taxa: 6.1 },
        { legenda: 'Reels de bastidores', tipo: 'Reels', alcance: Math.round(org * 0.35), interacoes: 520, salvos: 40, compartilhamentos: 90, taxa: 5.4 },
        { legenda: 'Post institucional de data comemorativa', tipo: 'Post', alcance: Math.round(org * 0.04), interacoes: 22, salvos: 1, compartilhamentos: 0, taxa: 0.8 },
      ], analise: [{ texto: 'Conteúdo educativo e Reels de bastidores puxaram o alcance orgânico. Datas comemorativas genéricas tiveram baixo engajamento.', acoes: ['Manter 2 Reels por semana', 'Trocar datas comemorativas por conteúdo útil'] }] } });
  }));
  // Marcos (fictícios).
  [['Pietro', 'lancamento', -40, 'Lançamento da linha de suplementos', 'Campanha de 3 semanas com Reels de rotina e depoimentos.'],
    ['Pietro', 'estrategia', -120, 'Virada para conteúdo de longevidade', 'Saímos de dicas soltas para uma série semanal sobre rotina e sono.'],
    ['Pietro', 'campanha', -75, 'Primeira campanha paga de alcance', 'R$ 1.500 em 30 dias para testar público de 35+.'],
    ['Metapel', 'campanha', -20, 'Outubro Rosa', '8 peças e live com a médica responsável.'],
    ['Metapel', 'evento', -95, 'Inauguração da unidade Moema'],
    ['Outbox', 'evento', -9, 'Maior turma do ano: 45 PAX'],
    ['Content Lab', 'estrategia', -60, 'Fila de cases como linha editorial'],
    ['Seok Wellness', 'lancamento', -30, 'Novo posicionamento: só wellness', 'Esporte, Longevidade, Saúde e Recovery.'],
    ['Nap Briddle', 'estrategia', -5, 'Início da parceria com a Seok']]
    .forEach(([cli, tipo, n, titulo, descricao]) => roda('salvarMarco', { clienteId: c[cli], tipo, data: dia(n), titulo, descricao: descricao || '' }));
  salvar();
}

const PONTE = `<script>
(function () {
  function corredor(ok, erro) {
    return new Proxy({}, { get: function (_, fn) {
      if (fn === 'withSuccessHandler') return function (f) { return corredor(f, erro); };
      if (fn === 'withFailureHandler') return function (f) { return corredor(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/api/' + fn + location.search, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
          .then(function (r) { return r.json(); })
          .then(function (r) { setTimeout(function () { if (r.erro) { if (erro) erro(new Error(r.erro)); } else if (ok) ok(r.valor); }, 120); })
          .catch(function (e) { if (erro) erro(e); });
      };
    } });
  }
  window.google = { script: { run: corredor(null, null) } };
})();
</script>`;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(SRC, 'index.html'), 'utf8').replace('<head>', '<head>' + PONTE));
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    let corpo = '';
    req.on('data', (x) => { corpo += x; });
    req.on('end', () => {
      const fn = url.pathname.slice(5);
      let saida;
      try {
        if (fn.endsWith('_')) throw new Error('Função interna: ' + fn);
        saida = { valor: executar(estado, { usuario: url.searchParams.get('como') || DONO, dono: DONO, src: SRC, console }, fn, JSON.parse(corpo || '[]')) };
        salvar();
      } catch (e) { saida = { erro: e.message }; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(saida));
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORTA, () => console.log('Seok Social (dev) em http://localhost:' + PORTA));
