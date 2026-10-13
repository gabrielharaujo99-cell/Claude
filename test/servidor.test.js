const test = require('node:test');
const assert = require('node:assert/strict');
const { novoEstado, executar } = require('../dev/gas.js');

const DONO = 'dono@agencia.dev';
const ANA = 'ana@agencia.dev';
const LEO = 'leo@agencia.dev';

function crm() {
  const estado = novoEstado();
  const como = (usuario) => (fn, ...args) => executar(estado, { usuario, dono: DONO }, fn, args);
  return { estado, dono: como(DONO), ana: como(ANA), leo: como(LEO), estranho: como('x@fora.dev') };
}

function comEquipe() {
  const c = crm();
  c.dono('carregar');
  c.dono('salvarMembro', { email: ANA, nome: 'Ana Souza', papel: 'colaborador' });
  c.dono('salvarMembro', { email: LEO, nome: 'Leo Dias', papel: 'leitor' });
  return c;
}

test('primeiro acesso: o dono da planilha vira admin e as abas são criadas', () => {
  const c = crm();
  const d = c.dono('carregar');
  assert.equal(d.eu.papel, 'admin');
  assert.equal(d.equipe.length, 1);
  assert.ok(c.estado.abas.equipe && c.estado.abas.config);
  assert.equal(d.config.etapas.length, 6);
});

test('quem não está na equipe vê a tela de sem acesso e não chama nada', () => {
  const c = crm();
  c.dono('carregar');
  const d = c.estranho('carregar');
  assert.equal(d.semAcesso, true);
  assert.equal(d.oportunidades, undefined);
  assert.throws(() => c.estranho('salvarCliente', { nome: 'X' }), /não tem acesso/);
});

test('entrada automática pelo domínio, se ligada', () => {
  const c = crm();
  c.dono('carregar');
  const cfg = c.dono('carregar').config;
  c.dono('salvarConfig', Object.assign(cfg, { dominio: 'agencia.dev', entradaAutomatica: true }));
  assert.equal(c.ana('carregar').eu.papel, 'colaborador');
  assert.equal(c.estranho('carregar').semAcesso, true);
});

test('cria, edita e move oportunidade registrando histórico e tempo na etapa', () => {
  const c = comEquipe();
  const op = c.ana('salvarOportunidade', { titulo: 'Social media', clienteNome: 'Café Aurora', contrato: 'fee', valor: '4500,50', meses: 6 });
  assert.equal(op.etapa, 'lead');
  assert.equal(op.valor, 4500.5);
  assert.equal(op.meses, 6);
  assert.equal(op.responsavel, ANA);
  assert.ok(op.clienteId);
  assert.equal(c.ana('carregar').clientes[0].nome, 'Café Aurora');

  const editada = c.ana('salvarOportunidade', Object.assign({}, op, { titulo: 'Social media + tráfego', etapa: 'ganho' }));
  assert.equal(editada.etapa, 'lead', 'salvar não muda etapa');

  const movida = c.ana('moverOportunidade', op.id, 'perdido', 3, 'Preço');
  assert.equal(movida.etapa, 'perdido');
  assert.equal(movida.motivoPerda, 'Preço');
  assert.ok(movida.fechadoEm);

  const reaberta = c.ana('moverOportunidade', op.id, 'negociacao');
  assert.equal(reaberta.fechadoEm, '');
  assert.equal(reaberta.motivoPerda, '');

  const h = c.ana('detalheOportunidade', op.id).historico.map((x) => x.acao + ':' + x.campo);
  assert.ok(h.includes('criou:'));
  assert.ok(h.includes('alterou:titulo'));
  assert.equal(h.filter((x) => x === 'moveu:etapa').length, 2);
});

test('fechar como ganho avisa no chat', () => {
  const c = comEquipe();
  c.dono('salvarWebhookChat', 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=k');
  const op = c.ana('salvarOportunidade', { titulo: 'Site', clienteNome: 'Spa Raízes', valor: 15000 });
  c.ana('moverOportunidade', op.id, 'ganho');
  assert.equal(c.estado.chats.length, 1);
  assert.match(c.estado.chats[0].corpo.text, /Fechado.*Spa Raízes · Site/);
});

test('papéis: leitor não grava, colaborador não arquiva, só admin configura', () => {
  const c = comEquipe();
  assert.throws(() => c.leo('salvarCliente', { nome: 'X' }), /não permite/);
  const op = c.ana('salvarOportunidade', { titulo: 'A' });
  assert.throws(() => c.ana('arquivarOportunidade', op.id, true), /não permite/);
  assert.throws(() => c.ana('salvarConfig', {}), /não permite/);
  assert.equal(c.dono('arquivarOportunidade', op.id, true).arquivado, true);
});

test('não deixa remover o último admin', () => {
  const c = comEquipe();
  assert.throws(() => c.dono('salvarMembro', { email: DONO, papel: 'gestor' }), /único admin/);
  c.dono('salvarMembro', { email: ANA, nome: 'Ana Souza', papel: 'admin' });
  assert.equal(c.dono('salvarMembro', { email: DONO, papel: 'gestor' }).find((m) => m.email === DONO).papel, 'gestor');
});

test('texto que parece fórmula é gravado como texto puro', () => {
  const c = comEquipe();
  const cl = c.ana('salvarCliente', { nome: '=IMPORTXML("http://x")' });
  assert.equal(cl.nome, '=IMPORTXML("http://x")');
  const linha = c.estado.abas.clientes[1];
  assert.equal(linha[1], '=IMPORTXML("http://x")');
});

test('cliente com nome repetido é recusado (ignorando acento e caixa)', () => {
  const c = comEquipe();
  c.ana('salvarCliente', { nome: 'Café Aurora' });
  assert.throws(() => c.ana('salvarCliente', { nome: 'cafe  aurora' }), /Já existe/);
});

test('menção em comentário manda e-mail só para quem é da equipe', () => {
  const c = comEquipe();
  const op = c.ana('salvarOportunidade', { titulo: 'Branding', clienteNome: 'Ventana' });
  c.ana('comentar', op.id, 'Oi @Dono e @fulano', [DONO, 'fulano@fora.dev', ANA]);
  assert.equal(c.estado.emails.length, 1);
  assert.equal(c.estado.emails[0].to, DONO);
  assert.equal(c.ana('carregar').comentarios[op.id], 1);
  assert.throws(() => c.leo('comentar', op.id, 'oi', []), /não permite/);
});

test('tarefa passada para outra pessoa avisa por e-mail e concluir registra data', () => {
  const c = comEquipe();
  const t = c.dono('salvarTarefa', { titulo: 'Enviar moodboard', responsavel: ANA, prazo: '2026-01-10' });
  assert.equal(c.estado.emails.length, 1);
  const feita = c.ana('moverTarefa', t.id, 'feito');
  assert.ok(feita.concluidoEm);
  assert.equal(c.ana('moverTarefa', t.id, 'afazer').concluidoEm, '');
  assert.throws(() => c.ana('removerTarefa', t.id), /Só quem criou/);
  assert.equal(c.dono('removerTarefa', t.id), true);
});

test('horas: cada um vê as suas, gestor vê todas', () => {
  const c = comEquipe();
  const cl = c.dono('salvarCliente', { nome: 'Spa' });
  c.dono('lancarHoras', { clienteId: cl.id, horas: '2,5', data: '2026-10-01' });
  c.ana('lancarHoras', { clienteId: cl.id, horas: 1, data: '2026-10-02' });
  assert.throws(() => c.ana('lancarHoras', { clienteId: cl.id, horas: 1, email: DONO }), /só pode lançar as suas/);
  assert.throws(() => c.ana('lancarHoras', { horas: 1 }), /Escolha o cliente/);
  assert.equal(c.ana('listarHoras', {}).length, 1);
  assert.equal(c.dono('listarHoras', {}).length, 2);
  assert.equal(c.dono('listarHoras', { email: ANA }).length, 1);
  assert.equal(c.dono('listarHoras', { de: '2026-10-02' }).length, 1);
});

test('config: valida funil e não remove etapa em uso', () => {
  const c = comEquipe();
  const cfg = c.dono('carregar').config;
  assert.throws(() => c.dono('salvarConfig', Object.assign({}, cfg, { etapas: cfg.etapas.filter((e) => e.tipo !== 'ganho') })), /tipo "ganho"/);
  c.ana('salvarOportunidade', { titulo: 'A', etapa: 'briefing' });
  assert.throws(() => c.dono('salvarConfig', Object.assign({}, cfg, { etapas: cfg.etapas.filter((e) => e.id !== 'briefing') })), /Mova-as/);
  const nova = c.dono('salvarConfig', Object.assign({}, cfg, {
    empresa: 'Seok', etapas: cfg.etapas.concat([{ nome: 'Reunião marcada', tipo: 'aberta', prob: 40, cor: '#123456' }]),
    marca: Object.assign({}, cfg.marca, { primaria: 'vermelho', fonteTitulos: 'Playfair Display' }),
  }));
  assert.equal(nova.empresa, 'Seok');
  assert.equal(nova.etapas.at(-1).id, 'reuniao-marcada');
  assert.equal(nova.marca.primaria, '#5F6F52', 'cor inválida volta ao padrão');
  assert.equal(nova.marca.fonteTitulos, 'Playfair Display');
});

test('resumo diário: cards parados e tarefas atrasadas por pessoa, só via gatilho real', () => {
  const c = comEquipe();
  c.dono('popularExemplo');
  assert.throws(() => c.dono('popularExemplo'), /vazio/);
  assert.throws(() => c.ana('gatilhoDiario', { triggerUid: 'falso' }), /só roda pelo gatilho/);
  c.dono('instalarResumoDiario', 8);
  c.dono('instalarResumoDiario', 9);
  assert.equal(c.estado.gatilhos.length, 1, 'reinstalar não duplica');
  const r = c.dono('gatilhoDiario', { triggerUid: c.estado.gatilhos[0].id });
  assert.ok(r.paradas >= 3);
  assert.ok(r.atrasadas >= 2);
  assert.equal(r.emails, 1);
  assert.match(c.estado.emails.at(-1).body, /paradas há 5\+ dias/);
});

test('colunas extras criadas à mão na planilha são preservadas', () => {
  const c = comEquipe();
  const cl = c.ana('salvarCliente', { nome: 'Spa' });
  const aba = c.estado.abas.clientes;
  aba[0].push('minhaColuna');
  aba[1][aba[0].length - 1] = 'anotação';
  c.ana('salvarCliente', Object.assign({}, cl, { contato: 'Carla' }));
  assert.equal(aba[1][aba[0].length - 1], 'anotação');
});
