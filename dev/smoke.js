/**
 * Checagem rápida da tela: monta ui/index como o Apps Script faria, confere se todo include existe
 * e se cada <script> compila. Uso: npm run smoke
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
let erros = 0;

function montar(arquivo) {
  const p = path.join(SRC, arquivo + '.html');
  if (!fs.existsSync(p)) { console.error('include sem arquivo: ' + arquivo); erros++; return ''; }
  return fs.readFileSync(p, 'utf8').replace(/<\?!=\s*include\('([^']+)'\);?\s*\?>/g, (_, f) => montar(f));
}

const html = montar('ui/index');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
try {
  new vm.Script(scripts.join('\n;\n'), { filename: 'tela.js' });
} catch (e) {
  console.error('script não compila: ' + e.message);
  erros++;
}
console.log(erros ? erros + ' problema(s).' : 'ok: ' + scripts.length + ' scripts, ' + Math.round(html.length / 1024) + ' KB.');
process.exit(erros ? 1 : 0);
