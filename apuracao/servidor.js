#!/usr/bin/env node
/**
 * Apuração 2026, 2º turno: servidor local.
 *
 * - Entrega o painel (index.html) em http://localhost:8026
 * - Repassa os arquivos oficiais do TSE em /tse/... (evita bloqueio de CORS no navegador)
 * - A cada minuto lê Brasil, os 27 estados e o exterior (presidente) e os estados com
 *   2º turno para governador, e grava o histórico em historico.json (minuto a minuto)
 *
 * Uso: node apuracao/servidor.js        (PORT=8026 e INTERVALO_S=60 por padrão)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 8026;
const INTERVALO_S = Number(process.env.INTERVALO_S) || 60;
const TSE = process.env.TSE_BASE || "https://resultados.tse.jus.br"; // TSE_BASE: só para testes
const CICLO = "ele2026";
const PRESIDENTE = { ele: 6258, cargo: 1 };
const GOVERNADOR = { ele: 6260, cargo: 3 };
const UFS = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb",
  "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"];
const ARQ_HIST = path.join(__dirname, "historico.json");
const ARQ_PAINEL = path.join(__dirname, "index.html");

function caminhoTse(e, uf) {
  const ele = String(e.ele).padStart(6, "0");
  const cargo = String(e.cargo).padStart(4, "0");
  return "/oficial/" + CICLO + "/" + e.ele + "/dados/" + uf + "/" + uf + "-c" + cargo + "-e" + ele + "-u.json";
}

// Cache curto para o painel e o coletor não pedirem o mesmo arquivo duas vezes
const cache = new Map();
async function buscarTse(caminho, maxIdadeMs) {
  const hit = cache.get(caminho);
  if (hit && Date.now() - hit.t < maxIdadeMs) return hit;
  const r = await fetch(TSE + caminho, { headers: { "user-agent": "apuracao-local/1.0" } });
  const corpo = Buffer.from(await r.arrayBuffer());
  const item = { t: Date.now(), status: r.status, tipo: r.headers.get("content-type") || "application/json", corpo };
  cache.set(caminho, item);
  return item;
}

function carregarHistorico() {
  try {
    return JSON.parse(fs.readFileSync(ARQ_HIST, "utf8"));
  } catch (e) {
    return { criado: new Date().toISOString(), series: {} };
  }
}
let historico = carregarHistorico();

function resumo(json) {
  const cands = [];
  const cargo = json && json.carg && json.carg[0];
  for (const agr of (cargo && cargo.agr) || []) {
    for (const par of agr.par || []) {
      for (const c of par.cand || []) cands.push({ n: String(c.n), vap: String(c.vap || "0"), pvap: String(c.pvap || "0") });
    }
  }
  return { t: Date.now(), dg: json.dg || "", hg: json.hg || "", pst: json.s ? String(json.s.pst || "0") : "0", c: cands };
}

function registrar(chave, ponto) {
  const serie = historico.series[chave] || (historico.series[chave] = []);
  const ultimo = serie[serie.length - 1];
  if (ultimo && ultimo.hg === ponto.hg && ultimo.dg === ponto.dg && ultimo.pst === ponto.pst) return false;
  serie.push(ponto);
  return true;
}

const semGovernador = new Map(); // uf -> momento do último 404, para não insistir toda hora
async function coletar() {
  let novos = 0;
  const tarefas = [];
  for (const uf of ["br", "zz"].concat(UFS)) {
    tarefas.push(["p:" + uf, caminhoTse(PRESIDENTE, uf)]);
  }
  for (const uf of UFS) {
    const miss = semGovernador.get(uf);
    if (miss && Date.now() - miss < 10 * 60 * 1000) continue;
    tarefas.push(["g:" + uf, caminhoTse(GOVERNADOR, uf), uf]);
  }
  await Promise.all(tarefas.map(async ([chave, caminho, ufGov]) => {
    try {
      const r = await buscarTse(caminho, 15000);
      if (r.status !== 200) {
        if (ufGov) semGovernador.set(ufGov, Date.now());
        return;
      }
      if (registrar(chave, resumo(JSON.parse(r.corpo.toString("utf8"))))) novos++;
    } catch (e) {
      // rede instável: tenta de novo no próximo ciclo
    }
  }));
  if (novos) fs.writeFile(ARQ_HIST, JSON.stringify(historico), () => {});
  const br = historico.series["p:br"];
  const u = br && br[br.length - 1];
  console.log(new Date().toLocaleTimeString("pt-BR") + "  " + novos + " recortes novos" +
    (u ? "  | Brasil " + u.pst + "% apurado, TSE " + u.hg : ""));
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      return fs.createReadStream(ARQ_PAINEL).pipe(res);
    }
    if (url.pathname === "/api/historico") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      return res.end(JSON.stringify(historico));
    }
    if (url.pathname.startsWith("/tse/oficial/")) {
      const r = await buscarTse(url.pathname.slice(4), 10000);
      res.writeHead(r.status, { "content-type": r.tipo, "cache-control": "no-store" });
      return res.end(r.corpo);
    }
    res.writeHead(404).end("não encontrado");
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" }).end("Falha ao falar com o TSE: " + e.message);
  }
});

servidor.listen(PORT, () => {
  console.log("Painel da apuração em http://localhost:" + PORT + "  (coleta a cada " + INTERVALO_S + "s)");
  coletar();
  setInterval(coletar, INTERVALO_S * 1000);
});
