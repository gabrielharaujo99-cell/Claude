#!/usr/bin/env node
/**
 * Coletor da apuração (roda no GitHub Actions, ver .github/workflows/apuracao.yml).
 *
 * A cada minuto lê no TSE o presidente (Brasil, exterior e 27 estados) e os governadores
 * no 2º turno, grava apuracao/dados/*.json e faz commit + push quando algo mudou.
 * O painel no claude.ai lê esses arquivos pela conexão do GitHub.
 *
 * Variáveis: DURACAO_MIN (340), INTERVALO_S (60), SEM_GIT=1 para só gravar os arquivos.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, "dados");
const TSE = process.env.TSE_BASE || "https://resultados.tse.jus.br";
const DURACAO_MIN = Number(process.env.DURACAO_MIN) || 340;
const INTERVALO_S = Number(process.env.INTERVALO_S) || 60;
const SEM_GIT = process.env.SEM_GIT === "1";

const PRESIDENTE = { ele: 6258, cargo: 1 };
const GOVERNADOR = { ele: 6260, cargo: 3 };
const PRIMEIRO = { ele: 6257, cargo: 1 };
const ESTADOS = {
  br: "Brasil", zz: "Exterior",
  ac: "Acre", al: "Alagoas", am: "Amazonas", ap: "Amapá", ba: "Bahia", ce: "Ceará", df: "Distrito Federal",
  es: "Espírito Santo", go: "Goiás", ma: "Maranhão", mg: "Minas Gerais", ms: "Mato Grosso do Sul", mt: "Mato Grosso",
  pa: "Pará", pb: "Paraíba", pe: "Pernambuco", pi: "Piauí", pr: "Paraná", rj: "Rio de Janeiro", rn: "Rio Grande do Norte",
  ro: "Rondônia", rr: "Roraima", rs: "Rio Grande do Sul", sc: "Santa Catarina", se: "Sergipe", sp: "São Paulo", to: "Tocantins",
};
const REGIAO = {
  ac: "Norte", am: "Norte", ap: "Norte", pa: "Norte", ro: "Norte", rr: "Norte", to: "Norte",
  al: "Nordeste", ba: "Nordeste", ce: "Nordeste", ma: "Nordeste", pb: "Nordeste", pe: "Nordeste", pi: "Nordeste", rn: "Nordeste", se: "Nordeste",
  df: "Centro-Oeste", go: "Centro-Oeste", ms: "Centro-Oeste", mt: "Centro-Oeste",
  es: "Sudeste", mg: "Sudeste", rj: "Sudeste", sp: "Sudeste",
  pr: "Sul", rs: "Sul", sc: "Sul",
  br: "Brasil", zz: "Exterior",
};
const UFS = Object.keys(ESTADOS).filter((u) => u !== "br" && u !== "zz");

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function caminho(e, uf) {
  const ele = String(e.ele).padStart(6, "0");
  const cargo = String(e.cargo).padStart(4, "0");
  return "/oficial/ele2026/" + e.ele + "/dados/" + uf + "/" + uf + "-c" + cargo + "-e" + ele + "-u.json";
}

async function buscar(e, uf) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(TSE + caminho(e, uf), { signal: ctrl.signal, headers: { "cache-control": "no-cache" } });
    if (r.status === 404 || r.status === 403) return null;
    if (!r.ok) throw new Error("HTTP " + r.status + " em " + uf);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function lerRecorte(json) {
  const cands = [];
  const cargo = json && json.carg && json.carg[0];
  for (const agr of (cargo && cargo.agr) || []) {
    for (const par of agr.par || []) {
      for (const c of par.cand || []) {
        cands.push({
          n: String(c.n || ""), nome: c.nmu || c.nm || "Candidato", partido: par.sg || "",
          vap: num(c.vap) || 0, pvap: num(c.pvapn != null && c.pvapn !== "" ? c.pvapn : c.pvap),
          eleito: /^eleito/i.test(c.st || "") || c.e === "s",
        });
      }
    }
  }
  cands.sort((x, y) => Number(x.n) - Number(y.n));
  const soma = cands.reduce((t, c) => t + c.vap, 0);
  for (const c of cands) if (c.pvap == null) c.pvap = soma ? Math.round(c.vap / soma * 10000) / 100 : null;
  const s = json.s || {}, v = json.v || {}, e = json.e || {};
  return {
    dg: json.dg || "", hg: json.hg || "", andamento: json.and || "",
    pst: num(s.pst) || 0, secoes_apuradas: num(s.st), secoes_total: num(s.ts),
    eleitorado: num(e.te), comparecimento: num(e.c), p_comparecimento: num(e.pc),
    abstencao: num(e.a), p_abstencao: num(e.pa),
    validos: num(v.vv) ?? soma, p_validos: num(v.pvv),
    brancos: num(v.vb), p_brancos: num(v.pvb), nulos: num(v.tvn), p_nulos: num(v.ptvn),
    cands,
  };
}

// Momento ISO (UTC) a partir de dg/hg do TSE, que vêm no horário de Brasília (UTC-3)
function momento(r) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.dg || "");
  const h = /^(\d{2}):(\d{2}):(\d{2})$/.exec(r.hg || "");
  if (!m || !h) return new Date().toISOString();
  return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +h[1] + 3, +h[2], +h[3])).toISOString();
}

function lerJson(arquivo, padrao) {
  try { return JSON.parse(readFileSync(join(PASTA, arquivo), "utf8")); } catch { return padrao; }
}
function gravar(arquivo, dados) {
  const novo = JSON.stringify(dados);
  let antigo = "";
  try { antigo = readFileSync(join(PASTA, arquivo), "utf8"); } catch { /* arquivo novo */ }
  if (antigo === novo) return false;
  writeFileSync(join(PASTA, arquivo), novo);
  return true;
}

const primeiro = {};
async function carregarPrimeiroTurno() {
  await Promise.all(["br", "zz"].concat(UFS).map(async (uf) => {
    try {
      const j = await buscar(PRIMEIRO, uf);
      if (!j) return;
      const r = lerRecorte(j);
      const a = r.cands.find((c) => c.n === "13"), b = r.cands.find((c) => c.n === "22");
      primeiro[uf] = { p1_a: a ? a.pvap : null, p1_b: b ? b.pvap : null, v1_a: a ? a.vap : null, v1_b: b ? b.vap : null };
    } catch { /* comparação é opcional */ }
  }));
}

const semGovernador = new Map();
async function rodada() {
  const presidente = {};
  const governadores = {};
  let falhas = 0;
  await Promise.all(["br", "zz"].concat(UFS).map(async (uf) => {
    try {
      const j = await buscar(PRESIDENTE, uf);
      if (j) presidente[uf] = lerRecorte(j);
    } catch (e) { falhas++; console.log("falha presidente " + uf + ": " + e.message); }
  }));
  await Promise.all(UFS.map(async (uf) => {
    const miss = semGovernador.get(uf);
    if (miss && Date.now() - miss < 10 * 60 * 1000) return;
    try {
      const j = await buscar(GOVERNADOR, uf);
      if (!j) { semGovernador.set(uf, Date.now()); return; }
      const r = lerRecorte(j);
      if (r.cands.length >= 2) governadores[uf] = r;
      else semGovernador.set(uf, Date.now());
    } catch (e) { console.log("falha governador " + uf + ": " + e.message); }
  }));

  // presidente.json: uma linha por recorte (Brasil, exterior, estados)
  const antigoPres = lerJson("presidente.json", { rows: [] });
  const porUf = Object.fromEntries((antigoPres.rows || []).map((r) => [r.uf, r]));
  for (const uf in presidente) {
    const r = presidente[uf];
    const a = r.cands.find((c) => c.n === "13") || r.cands[0];
    const b = r.cands.find((c) => c.n === "22") || r.cands[1];
    const { cands, ...resto } = r;
    porUf[uf] = {
      uf: uf.toUpperCase(), estado: ESTADOS[uf], regiao: REGIAO[uf], atualizado_em: momento(r), ...resto,
      a_nome: a ? a.nome : null, a_partido: a ? a.partido : null, a_numero: a ? a.n : null, a_votos: a ? a.vap : null, a_pct: a ? a.pvap : null, a_eleito: a ? a.eleito : false,
      b_nome: b ? b.nome : null, b_partido: b ? b.partido : null, b_numero: b ? b.n : null, b_votos: b ? b.vap : null, b_pct: b ? b.pvap : null, b_eleito: b ? b.eleito : false,
      margem_pp: a && b && a.pvap != null && b.pvap != null ? Math.round((a.pvap - b.pvap) * 100) / 100 : null,
      ...(primeiro[uf] || { p1_a: null, p1_b: null, v1_a: null, v1_b: null }),
    };
  }
  const ordem = ["br", "zz"].concat(UFS).map((u) => u.toUpperCase());
  const linhasPres = Object.values(porUf).sort((x, y) => ordem.indexOf(x.uf) - ordem.indexOf(y.uf));
  const mudouPres = gravar("presidente.json", { fonte: "TSE, eleição 6258 (presidente, 2º turno)", rows: linhasPres });

  // historico.json: um ponto por recorte a cada atualização do TSE
  const hist = lerJson("historico.json", { rows: [] });
  const vistos = new Set(hist.rows.map((p) => p.uf + "|" + p.momento + "|" + p.pst));
  const ultimoPst = {};
  for (const p of hist.rows) ultimoPst[p.uf] = p.pst;
  for (const uf in presidente) {
    const r = presidente[uf];
    const a = r.cands.find((c) => c.n === "13") || r.cands[0];
    const b = r.cands.find((c) => c.n === "22") || r.cands[1];
    if (!a || !b || !(r.pst > 0)) continue;
    const p = { uf: uf.toUpperCase(), momento: momento(r), hora: r.hg.slice(0, 5), pst: r.pst, a_pct: a.pvap, b_pct: b.pvap };
    // Brasil e exterior guardam toda atualização; os estados, a cada 1 p.p. de urnas (e o 100%), para o arquivo seguir pequeno
    const anterior = ultimoPst[p.uf];
    if (uf !== "br" && uf !== "zz" && anterior != null && r.pst < 100 && r.pst - anterior < 1) continue;
    if (uf === "br") { p.a_votos = a.vap; p.b_votos = b.vap; }
    const k = p.uf + "|" + p.momento + "|" + p.pst;
    if (!vistos.has(k)) { hist.rows.push(p); vistos.add(k); ultimoPst[p.uf] = p.pst; }
  }
  hist.rows.sort((x, y) => (x.uf === y.uf ? x.momento.localeCompare(y.momento) : x.uf.localeCompare(y.uf)));
  const mudouHist = gravar("historico.json", { fonte: "TSE, eleição 6258; um ponto por atualização", rows: hist.rows });

  // governadores.json: uma linha por candidato nos estados com 2º turno
  const antigoGov = lerJson("governadores.json", { rows: [] });
  const linhasGov = (antigoGov.rows || []).filter((r) => !governadores[r.uf.toLowerCase()]);
  for (const uf in governadores) {
    const r = governadores[uf];
    r.cands.slice(0, 2).forEach((c, i) => {
      linhasGov.push({
        chave: uf.toUpperCase() + "-" + c.n, uf: uf.toUpperCase(), estado: ESTADOS[uf], ordem: i + 1,
        pst: r.pst, hora: r.hg.slice(0, 5), atualizado_em: momento(r),
        nome: c.nome, partido: c.partido, numero: c.n, votos: c.vap, pct: c.pvap, eleito: c.eleito,
      });
    });
  }
  linhasGov.sort((x, y) => x.uf.localeCompare(y.uf) || x.ordem - y.ordem);
  const mudouGov = gravar("governadores.json", { fonte: "TSE, eleição 6260 (governador, 2º turno)", rows: linhasGov });

  const br = presidente.br;
  console.log(new Date().toISOString() + "  Brasil " + (br ? br.pst + "% (TSE " + br.hg + ")" : "sem dados") +
    "  governadores: " + Object.keys(governadores).length + "  falhas: " + falhas);
  return { mudou: mudouPres || mudouHist || mudouGov, br };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function publicar(br) {
  if (SEM_GIT) return;
  git("add", "apuracao/dados");
  try { git("diff", "--cached", "--quiet"); return; } catch { /* há mudanças */ }
  git("commit", "-q", "-m", "Apuração: dados do TSE " + (br ? br.hg + " (" + String(br.pst).replace(".", ",") + "% apurado)" : ""));
  for (let i = 0; i < 4; i++) {
    try { git("push", "-q"); return; } catch (e) {
      console.log("push recusado, sincronizando: " + String(e.stderr || e.message).split("\n")[0]);
      try { git("pull", "-q", "--rebase", "-X", "theirs"); } catch { /* tenta o push de novo */ }
    }
  }
}

mkdirSync(PASTA, { recursive: true });
const fim = Date.now() + DURACAO_MIN * 60 * 1000;
await carregarPrimeiroTurno();
let finalDesde = 0;
while (Date.now() < fim) {
  const inicio = Date.now();
  try {
    const { mudou, br } = await rodada();
    if (mudou) publicar(br);
    // Encerra 30 minutos depois de o Brasil chegar a 100%
    if (br && br.pst >= 100) {
      finalDesde = finalDesde || Date.now();
      if (Date.now() - finalDesde > 30 * 60 * 1000) { console.log("Apuração em 100% há 30 minutos. Encerrando."); break; }
    }
  } catch (e) {
    console.log("rodada falhou: " + e.message);
  }
  await new Promise((ok) => setTimeout(ok, Math.max(5000, INTERVALO_S * 1000 - (Date.now() - inicio))));
}
