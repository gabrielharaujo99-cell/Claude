const test = require('node:test');
const assert = require('node:assert/strict');
const { novoEstado, executar } = require('../dev/gas.js');

const DONO = 'dono@agencia.dev';
const como = (estado, extra) => (fn, ...args) => executar(estado, { usuario: DONO, dono: DONO, ignorar: ['EquipeSeok.gs'], extra }, fn, args);

test('instalação nova vem neutra: produto Flowloop, sem marca de nenhuma agência', () => {
  const d = como(novoEstado())('carregar');
  assert.equal(d.config.produto, 'Flowloop');
  assert.equal(d.config.empresa, 'Sua agência');
  assert.equal(d.config.marca.logoUrl, '');
  assert.equal(d.config.dominio, '');
  assert.doesNotMatch(JSON.stringify(d.config), /seok/i);
});

test('perfil da agência (CONFIG_AGENCIA) vira o padrão da instalação; o Admin continua por cima', () => {
  const estado = novoEstado();
  const extra = "const CONFIG_AGENCIA = { empresa: 'Agência Teste', dominio: 'teste.com.br', marca: { logoUrl: 'https://teste.com.br/logo.png' }, segmentos: ['Pets'] };";
  const c = como(estado, extra);
  const d = c('carregar');
  assert.equal(d.config.empresa, 'Agência Teste');
  assert.equal(d.config.produto, 'Flowloop', 'o que o perfil não diz fica no padrão');
  assert.equal(d.config.marca.logoUrl, 'https://teste.com.br/logo.png');
  assert.equal(d.config.marca.primaria, '#141A0F', 'cores que o perfil não traz ficam no padrão');
  assert.deepEqual(d.config.segmentos, ['Pets']);
  const salvo = c('salvarConfig', Object.assign({}, d.config, { empresa: 'Nome Novo' }));
  assert.equal(salvo.empresa, 'Nome Novo');
  assert.equal(salvo.marca.logoUrl, 'https://teste.com.br/logo.png', 'salvar no Admin mantém o logo');
});

test('logo embutido (data:image) é aceito no Admin; outro tipo de link é recusado', () => {
  const c = como(novoEstado());
  const cfg = c('carregar').config;
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(c('salvarConfig', Object.assign({}, cfg, { marca: Object.assign({}, cfg.marca, { logoUrl: png }) })).marca.logoUrl, png);
  assert.equal(c('salvarConfig', Object.assign({}, cfg, { marca: Object.assign({}, cfg.marca, { logoUrl: 'javascript:alert(1)' }) })).marca.logoUrl, '');
});

test('agência de demonstração (Aurora) sobe com equipe, marca e sem nada da Seok', () => {
  const fs = require('fs');
  const extra = fs.readFileSync(require('path').join(__dirname, '..', 'dev', 'demo', 'AgenciaAurora.gs'), 'utf8');
  const estado = novoEstado();
  const camila = (fn, ...a) => executar(estado, { usuario: 'camila@agenciaaurora.com.br', dono: 'camila@agenciaaurora.com.br', ignorar: ['EquipeSeok.gs'], extra }, fn, a);
  const d = camila('carregar');
  assert.equal(d.config.empresa, 'Agência Aurora');
  assert.equal(d.equipe.length, 7);
  assert.equal(d.eu.nome, 'Camila Rocha');
  assert.match(d.config.marca.logoParticulas, /^data:image\/svg\+xml;base64,/);
  camila('popularExemplo');
  const tudo = JSON.stringify(camila('carregar'));
  assert.doesNotMatch(tudo, /seok/i);
});
