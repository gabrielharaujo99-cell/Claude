/**
 * Servidor local para desenvolver a tela sem publicar no Apps Script.
 *   npm run dev            abre em http://localhost:8080
 *   npm run demo           modo demonstração em http://localhost:8081: instalação neutra (sem EquipeSeok.gs), dados em dev/.demo.json
 *   ?como=ana@agencia.dev  entra como outra pessoa (padrão: o dono da planilha)
 * Monta ui/index como o HtmlService faz (resolvendo os include) e troca google.script.run
 * por chamadas HTTP ao simulador (dev/gas.js). A "planilha" fica salva em dev/.dados.json.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { novoEstado, executar } = require('./gas.js');

// Modo demonstração: como uma agência nova veria o Flowloop (sem o perfil e a equipe da Seok).
// --limpo: instalação zerada, como a de um cliente novo (abre o assistente de boas-vindas).
const LIMPO = process.argv.includes('--limpo');
const DEMO = LIMPO || process.argv.includes('--demo');
const PORTA = Number(process.env.PORT) || (LIMPO ? 8082 : DEMO ? 8081 : 8080);
const SRC = path.join(__dirname, '..', 'src');
const DADOS = path.join(__dirname, LIMPO ? '.limpo.json' : DEMO ? '.demo.json' : '.dados.json');
// Dono da planilha simulado: o admin com cargo de CEO/sócio da equipe real (src/EquipeSeok.gs, fora do Git, porque o
// repositório é público; sem esse cargo, o primeiro admin), para a equipe inicial e o Financeiro aparecerem já no
// primeiro acesso. FLOW_DONO=email troca o dono.
function donoDaEquipe() {
  try {
    const admins = (fs.readFileSync(path.join(SRC, 'EquipeSeok.gs'), 'utf8').match(/\{[^{}]*?email:\s*'[^']+'[^{}]*?\}/g) || [])
      .filter(function (o) { return /papel:\s*'admin'/.test(o); });
    const dono = admins.find(function (o) { return /cargo:\s*'[^']*\b(CEO|s[oó]ci[oa]|fundador|fundadora)\b/i.test(o); }) || admins[0];
    return dono ? dono.match(/email:\s*'([^']+)'/)[1] : '';
  } catch (e) { return ''; }
}
const DONO = LIMPO ? 'dono@novaagencia.com.br' : DEMO ? 'camila@agenciaaurora.com.br' : process.env.FLOW_DONO || donoDaEquipe() || 'dono@suaagencia.com';
const IGNORAR = DEMO ? ['EquipeSeok.gs'] : [];
// Na demonstração entra o perfil da agência fictícia (equipe, marca e listas).
const EXTRA = DEMO && !LIMPO ? fs.readFileSync(path.join(__dirname, 'demo', 'AgenciaAurora.gs'), 'utf8') : '';

let estado = novoEstado();
try { estado = Object.assign(novoEstado(), JSON.parse(fs.readFileSync(DADOS, 'utf8'))); } catch (e) { /* começa vazio */ }

function salvar() { fs.writeFileSync(DADOS, JSON.stringify(estado)); }

// Substituto de google.script.run: mesma interface encadeável, por baixo um POST /api/<função>.
const PONTE = `<script>
(function () {
  var como = new URLSearchParams(location.search).get('como') || '';
  function corredor(ok, erro) {
    return new Proxy({}, { get: function (_, fn) {
      if (fn === 'withSuccessHandler') return function (f) { return corredor(f, erro); };
      if (fn === 'withFailureHandler') return function (f) { return corredor(ok, f); };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        fetch('/api/' + fn + '?como=' + encodeURIComponent(como), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
          .then(function (r) { return r.json(); })
          .then(function (r) { setTimeout(function () { if (r.erro) { if (erro) erro(new Error(r.erro)); } else if (ok) ok(r.valor); }, 150); })
          .catch(function (e) { if (erro) erro(e); });
      };
    } });
  }
  window.google = { script: { run: corredor(null, null) } };
})();
</script>`;

function montar(arquivo) {
  const html = fs.readFileSync(path.join(SRC, arquivo + '.html'), 'utf8');
  return html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => montar(f));
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const html = montar('ui/index').replace('<head>', '<head>' + PONTE);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(String(e.stack || e));
    }
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    let corpo = '';
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => {
      const fn = url.pathname.slice(5);
      const usuario = url.searchParams.get('como') || DONO;
      let saida;
      try {
        if (fn.endsWith('_')) throw new Error('Função interna: ' + fn);
        saida = { valor: executar(estado, { usuario, dono: DONO, console, ignorar: IGNORAR, extra: EXTRA }, fn, JSON.parse(corpo || '[]')) };
        salvar();
      } catch (e) {
        saida = { erro: e.message };
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(saida));
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/dev/zerar') {
    estado = novoEstado();
    salvar();
    res.writeHead(200);
    return res.end('ok');
  }
  res.writeHead(404);
  res.end();
});

servidor.listen(PORTA, () => console.log('Seok Flow (dev) em http://localhost:' + PORTA));
