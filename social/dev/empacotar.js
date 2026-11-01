/**
 * Junta o app em 3 arquivos para colar no Apps Script: publicar/Codigo.gs, publicar/index.html e publicar/appsscript.json.
 *   node dev/empacotar.js
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src'), OUT = path.join(__dirname, '..', 'publicar');
fs.mkdirSync(OUT, { recursive: true });
const gs = ['Base.gs', 'Social.gs', 'Reportei.gs'].map((f) => '// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(SRC, f), 'utf8').trim()).join('\n\n');
fs.writeFileSync(path.join(OUT, 'Codigo.gs'), '// Seok Social: gerado por dev/empacotar.js a partir de src/. Edite em src/ e gere de novo.\n\n' + gs + '\n');
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
if (html.includes('<?')) throw new Error('index.html não pode ter "<?" (o HtmlService interpretaria como scriptlet).');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(SRC, 'appsscript.json'), path.join(OUT, 'appsscript.json'));
console.log('publicar/: Codigo.gs, index.html, appsscript.json');
