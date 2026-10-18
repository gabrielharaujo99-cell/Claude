/**
 * Perfil de cada pessoa (nome, cargo, telefone, foto, tema) e presença: quem está com o CRM aberto agora.
 * Mesmo esquema do Be Flow: cada aba avisa a cada ~45 s (ping); quem some por mais de ~2 min sai da lista.
 * Foto: a enviada no perfil (imagem pequena guardada na planilha) ou, se não houver, a do diretório do Google Workspace.
 */
const TEMAS_ = ['claro', 'escuro', 'floresta'];
const PRESENCA_MS_ = 110000;

function fotoValida_(v) {
  const s = String(v || '');
  if (!s) return '';
  if (!/^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'()<>]+)$/.test(s)) throw new Error('Imagem inválida. Use JPG, PNG ou WEBP.');
  if (s.length > 48000) throw new Error('Imagem grande demais. Escolha outra ou corte mais.');
  return s;
}

// Formato que vai para a tela (sem a foto do diretório misturada na planilha).
function membroTela_(m, fotos) {
  const r = registroMembro_(m, []);
  return {
    email: m.email, nome: m.nome, papel: m.papel, ativo: m.ativo, cargo: m.cargo, telefone: m.telefone,
    areas: r.areas, financeiro: r.financeiro, cvision: r.cvision, foto: m.foto || (fotos || {})[m.email] || '',
  };
}

// Cada um mexe só no próprio perfil (papel, ativo e acessos continuam no Admin > Equipe).
function salvarPerfil(d) {
  const eu = exigir_('leitor');
  return comTrava_(function () {
    d = d || {};
    const atual = achar_('equipe', eu.email);
    if (!atual) throw new Error('Perfil não encontrado. Recarregue a página.');
    const patch = {};
    if ('nome' in d) { patch.nome = texto_(d.nome, 80); if (!patch.nome) throw new Error('Informe o seu nome.'); }
    if ('cargo' in d) patch.cargo = texto_(d.cargo, 80);
    if ('telefone' in d) patch.telefone = texto_(d.telefone, 30);
    if ('foto' in d) patch.foto = fotoValida_(d.foto);
    if ('tema' in d) patch.tema = umDe_(d.tema, TEMAS_, 'claro');
    const r = atualizar_('equipe', eu.email, patch);
    ['nome', 'cargo', 'telefone'].forEach(function (c) {
      if (c in patch && r.antes[c] !== r.depois[c]) registrar_(eu, 'equipe', eu.email, 'alterou', c, r.antes[c], r.depois[c]);
    });
    if ('foto' in patch && r.antes.foto !== r.depois.foto) registrar_(eu, 'equipe', eu.email, patch.foto ? 'trocou a foto' : 'removeu a foto', '', '', '');
    return Object.assign(membroTela_(r.depois, fotosDiretorio_()), { tema: r.depois.tema });
  });
}

// Fotos do diretório do Google Workspace. Precisa do serviço avançado People e do escopo directory.readonly
// (já no appsscript.json); fora do Workspace, ou sem permissão, devolve {} e a tela usa as iniciais.
function fotosDiretorio_() {
  if (MEMO_.__fotos) return MEMO_.__fotos;
  const cache = CacheService.getScriptCache();
  try { const c = cache.get('fotos_v1'); if (c) return (MEMO_.__fotos = JSON.parse(c)); } catch (e) { /* refaz */ }
  const out = {};
  if (typeof People !== 'undefined') {
    ler_('equipe').forEach(function (m) {
      try {
        const r = People.People.searchDirectoryPeople({ query: m.email, readMask: 'photos,emailAddresses', sources: ['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'], pageSize: 5 });
        (r.people || []).forEach(function (p) {
          const ems = (p.emailAddresses || []).map(function (x) { return String(x.value || '').toLowerCase(); });
          const ph = (p.photos || []).filter(function (x) { return x.url && !x.default; })[0];
          if (ph && ems.indexOf(m.email) >= 0) out[m.email] = String(ph.url).replace(/=s\d+.*$/, '') + '=s96-c';
        });
      } catch (e) { console.warn('foto ' + m.email + ': ' + e.message); }
    });
  }
  try { cache.put('fotos_v1', JSON.stringify(out), Object.keys(out).length ? 21600 : 600); } catch (e) { /* sem cache */ }
  return (MEMO_.__fotos = out);
}

function lerPresenca_() {
  try { return JSON.parse(CacheService.getScriptCache().get('presenca') || '{}'); } catch (e) { return {}; }
}

function listaPresenca_(mapa) {
  const agora = Date.now(), out = [];
  Object.keys(mapa).forEach(function (k) { if (agora - mapa[k].t <= PRESENCA_MS_) out.push({ email: k, tela: mapa[k].a, ts: mapa[k].t }); });
  return out.sort(function (a, b) { return b.ts - a.ts; });
}

function presenca_() { return listaPresenca_(lerPresenca_()); }

// "Estou aqui, nesta tela." Devolve quem está online agora.
// Com o carimbo da tela (build), devolve também o do servidor, para a tela avisar quando há versão nova.
function ping(tela, build) {
  const lista = pingPresenca_(tela);
  return build ? { online: lista, build: BUILD } : lista;
}

function pingPresenca_(tela) {
  const eu = eu_();
  if (eu.papel === 'sem_acesso' || !eu.email) return [];
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(3000)) return presenca_();
  try {
    const mapa = lerPresenca_(), agora = Date.now();
    Object.keys(mapa).forEach(function (k) { if (agora - mapa[k].t > PRESENCA_MS_) delete mapa[k]; });
    mapa[eu.email] = { t: agora, a: texto_(tela, 20) };
    CacheService.getScriptCache().put('presenca', JSON.stringify(mapa), 21600);
    return listaPresenca_(mapa);
  } finally { trava.releaseLock(); }
}

// Ao fechar a aba: sai da lista na hora, sem esperar os 2 minutos.
function sair() {
  const eu = eu_();
  if (!eu.email) return true;
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(2000)) return true;
  try {
    const mapa = lerPresenca_();
    delete mapa[eu.email];
    CacheService.getScriptCache().put('presenca', JSON.stringify(mapa), 21600);
    return true;
  } finally { trava.releaseLock(); }
}
