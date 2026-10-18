/**
 * Junta o projeto em 3 arquivos para colar no editor do Apps Script sem clasp:
 *   dist/Codigo.gs       todos os src/*.gs (inclusive EquipeSeok.gs, que fica fora do Git)
 *   dist/index.html      a tela inteira, com os include() já resolvidos (vira o arquivo "ui/index" no editor)
 *   dist/appsscript.json o manifesto
 * Uso: node dev/empacotar.js            (conta da empresa, acesso pelo domínio)
 *      node dev/empacotar.js --pessoal  (conta Gmail, só o dono acessa)
 *      node dev/empacotar.js --neutro   (instalação para um cliente novo: sem EquipeSeok.gs; sai em dist/neutro)
 *      node dev/empacotar.js --demo     (demonstração com a Agência Aurora fictícia; sai em dist/demo)
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const NEUTRO = process.argv.includes('--neutro'), DEMO = process.argv.includes('--demo');
const DIST = path.join(__dirname, '..', 'dist', NEUTRO ? 'neutro' : DEMO ? 'demo' : '');
const PRIVADOS = NEUTRO || DEMO ? ['EquipeSeok.gs'] : [];
fs.mkdirSync(DIST, { recursive: true });

// Carimbo da publicação, igual no servidor e na tela (a tela avisa quando o servidor tem um mais novo).
const CARIMBO = new Date().toISOString().slice(0, 16).replace('T', ' ');
const comCarimbo = (s) => s.replace("const BUILD = 'dev';", "const BUILD = '" + CARIMBO + "';");
const gs = fs.readdirSync(SRC).filter((f) => f.endsWith('.gs') && !PRIVADOS.includes(f)).sort()
  .map((f) => '// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n\n');
const extra = DEMO ? '\n\n// ===== AgenciaAurora.gs (demonstração) =====\n' + fs.readFileSync(path.join(__dirname, 'demo', 'AgenciaAurora.gs'), 'utf8') : '';
fs.writeFileSync(path.join(DIST, 'Codigo.gs'), comCarimbo(gs + extra));

function montar(arquivo) {
  const html = fs.readFileSync(path.join(SRC, arquivo + '.html'), 'utf8');
  return html.replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => montar(f));
}
fs.writeFileSync(path.join(DIST, 'index.html'), comCarimbo(montar('ui/index')));
// --pessoal: conta Gmail (sem domínio): acesso só do dono e sem o diretório do Google Workspace.
const manifesto = JSON.parse(fs.readFileSync(path.join(SRC, 'appsscript.json'), 'utf8'));
if (process.argv.includes('--pessoal')) {
  manifesto.webapp.access = 'MYSELF';
  delete manifesto.dependencies;
  manifesto.oauthScopes = manifesto.oauthScopes.filter((s) => !/directory/.test(s));
}
fs.writeFileSync(path.join(DIST, 'appsscript.json'), JSON.stringify(manifesto, null, 2) + '\n');

['Codigo.gs', 'index.html', 'appsscript.json'].forEach((f) => {
  console.log(f.padEnd(16) + Math.round(fs.statSync(path.join(DIST, f)).size / 1024) + ' KB');
});
