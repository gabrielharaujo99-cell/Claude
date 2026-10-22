const test = require('node:test');
const assert = require('node:assert/strict');
const { novoEstado, executar } = require('../dev/gas.js');

const DONO = 'dono@agencia.dev';
const ANA = 'ana@agencia.dev';
const LEO = 'leo@agencia.dev';

// A equipe real (src/EquipeSeok.gs) fica fora do Git: os testes nunca a carregam; quem precisa passa a sua em `extra`.
function crm(extra) {
  const estado = novoEstado();
  const como = (usuario) => (fn, ...args) => executar(estado, { usuario, dono: DONO, ignorar: ['EquipeSeok.gs'], extra }, fn, args);
  return { estado, dono: como(DONO), ana: como(ANA), leo: como(LEO), estranho: como('x@fora.dev') };
}

function comEquipe() {
  const c = crm();
  c.dono('carregar');
  c.dono('salvarMembro', { email: ANA, nome: 'Ana Souza', papel: 'colaborador', areas: ['comercial'] });
  c.dono('salvarMembro', { email: LEO, nome: 'Leo Dias', papel: 'leitor', areas: ['comercial'] });
  return c;
}

test('primeiro acesso: o dono da planilha vira admin e as abas são criadas', () => {
  const c = crm();
  const d = c.dono('carregar');
  assert.equal(d.eu.papel, 'admin');
  assert.equal(d.equipe.length, 1, 'sem EquipeSeok.gs, só o dono');
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
  c.ana('salvarOportunidade', { titulo: 'A', etapa: 'diagnostico' });
  assert.throws(() => c.dono('salvarConfig', Object.assign({}, cfg, { etapas: cfg.etapas.filter((e) => e.id !== 'diagnostico') })), /Mova-as/);
  const nova = c.dono('salvarConfig', Object.assign({}, cfg, {
    empresa: 'Seok', etapas: cfg.etapas.concat([{ nome: 'Reunião marcada', tipo: 'aberta', prob: 40, cor: '#123456' }]),
    marca: Object.assign({}, cfg.marca, { primaria: 'vermelho', fonteTitulos: 'Playfair Display' }),
  }));
  assert.equal(nova.empresa, 'Seok');
  assert.equal(nova.etapas.at(-1).id, 'reuniao-marcada');
  assert.equal(nova.marca.primaria, '#141A0F', 'cor inválida volta ao padrão');
  assert.equal(nova.marca.fonteTitulos, 'Playfair Display');
});

test('resumo diário: cards parados e tarefas atrasadas por pessoa, só via gatilho real', () => {
  const c = comEquipe();
  c.dono('popularExemplo');
  assert.throws(() => c.dono('popularExemplo'), /vazio/);
  assert.throws(() => c.ana('gatilhoDiario', { triggerUid: 'falso' }), /só roda pelo gatilho/);
  c.dono('instalarResumoDiario', 8);
  c.dono('instalarResumoDiario', 9);
  const resumo = c.estado.gatilhos.filter((g) => g.fn === 'gatilhoDiario');
  assert.equal(resumo.length, 1, 'reinstalar não duplica');
  const r = c.dono('gatilhoDiario', { triggerUid: resumo[0].id });
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

const EQUIPE_TESTE = `const EQUIPE_INICIAL = [
  { nome: 'Fin Ança', email: 'fin@agencia.dev', cargo: 'Financeiro', papel: 'gestor', financeiro: true, atividades: ['Emitir notas'] },
  { nome: 'Dé Signer', email: 'design@agencia.dev', cargo: 'Designer', papel: 'colaborador', atividades: ['Criar artes', 'Editar vídeo', 'Capas'] },
];`;

function mesesAtras(n) { const d = new Date(); d.setDate(10); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); }

test('equipe inicial entra no primeiro acesso, com cargo e acesso ao financeiro', () => {
  const c = crm(EQUIPE_TESTE);
  const eq = c.dono('carregar').equipe;
  assert.equal(eq.length, 3);
  const fin = eq.find((m) => m.email === 'fin@agencia.dev');
  assert.equal(fin.papel, 'gestor');
  assert.equal(fin.cargo, 'Financeiro');
  assert.equal(fin.financeiro, true);
  assert.equal(eq.find((m) => m.email === DONO).papel, 'admin');
  assert.equal(eq.find((m) => m.email === 'design@agencia.dev').financeiro, false);
  // exemplo cria as atividades de cada pessoa
  c.dono('popularExemplo');
  const tarefas = c.dono('carregar').tarefas;
  assert.equal(tarefas.filter((t) => t.responsavel === 'design@agencia.dev').length, 3);
});

test('financeiro: só quem tem acesso recebe e grava contratos', () => {
  const c = comEquipe();
  const cl = c.dono('salvarCliente', { nome: 'Spa' });
  c.dono('salvarMembro', { email: DONO, nome: 'Dono', papel: 'admin', financeiro: false });
  assert.throws(() => c.dono('salvarContrato', { clienteId: cl.id, valor: 1000, inicio: '2026-01-10' }), /restrita/);
  assert.deepEqual(c.dono('carregar').contratos, []);
  c.dono('salvarMembro', { email: ANA, nome: 'Ana Souza', papel: 'colaborador', areas: ['comercial', 'financeiro'] });
  const r = c.ana('salvarContrato', { clienteId: cl.id, servico: 'Tráfego pago', tipo: 'fee', valor: 1000, inicio: '2026-01-10', meses: 12 });
  assert.equal(r.contrato.titulo, 'Tráfego pago');
  assert.equal(c.ana('carregar').contratos.length, 1);
  assert.equal(c.dono('carregar').contratos.length, 0, 'admin sem a marcação também não vê');
  assert.throws(() => c.leo('listarFinanceiro'), /restrita/);
});

test('contrato: reajuste, adicional mensal, avulso e encerramento entram na conta de cada mês', () => {
  const c = comEquipe();
  c.dono('salvarMembro', { email: DONO, nome: 'Dono', papel: 'admin', financeiro: true });
  const cl = c.dono('salvarCliente', { nome: 'Spa' });
  let r = c.dono('salvarContrato', { clienteId: cl.id, titulo: 'Assessoria', tipo: 'fee', valor: 10000, inicio: mesesAtras(5), meses: 12 });
  const id = r.contrato.id;
  assert.equal(r.contrato.mesesAtivo, 6);
  assert.equal(r.contrato.faturado, 60000);
  assert.equal(r.contrato.totalPrevisto, 120000);

  r = c.dono('registrarAjuste', { contratoId: id, tipo: 'reajuste', data: mesesAtras(2), valor: 11000 });
  assert.equal(r.contrato.valorAtual, 11000);
  assert.equal(r.contrato.reajustePct, 10);
  assert.equal(r.contrato.faturado, 3 * 10000 + 3 * 11000);

  r = c.dono('registrarAjuste', { contratoId: id, tipo: 'adicional', data: mesesAtras(1), valor: 500, recorrente: true, descricao: 'Google Meu Negócio' });
  assert.equal(r.contrato.valorAtual, 11500);
  r = c.dono('registrarAjuste', { contratoId: id, tipo: 'adicional', data: mesesAtras(0), valor: 3000, recorrente: false, descricao: 'Ensaio' });
  assert.equal(r.contrato.valorAtual, 11500, 'avulso não muda o mensal');
  assert.equal(r.contrato.faturado, 3 * 10000 + 3 * 11000 + 2 * 500 + 3000);
  assert.equal(r.ajustes.length, 3);
  assert.throws(() => c.dono('registrarAjuste', { contratoId: id, tipo: 'adicional', valor: 100 }), /Descreva/);

  r = c.dono('salvarContrato', Object.assign({}, r.contrato, { status: 'encerrado', encerradoEm: mesesAtras(1) }));
  assert.equal(r.contrato.serie.length, 5, 'para de contar no mês do encerramento');
  assert.equal(r.contrato.diasParaFim, null);

  const semPrazo = c.dono('salvarContrato', { clienteId: cl.id, tipo: 'fee', valor: 2000, inicio: mesesAtras(3), meses: 0 }).contrato;
  assert.equal(semPrazo.semPrazo, true);
  assert.equal(semPrazo.faturado, 8000);
});

test('áreas: cada um só recebe e mexe no que é da sua área', () => {
  const c = comEquipe();
  const SOC = 'soc@agencia.dev', TRA = 'tra@agencia.dev';
  c.dono('salvarMembro', { email: SOC, nome: 'Sô Cial', papel: 'colaborador', areas: ['social'] });
  c.dono('salvarMembro', { email: TRA, nome: 'Trá Fego', papel: 'colaborador', areas: ['trafego'] });
  const soc = (fn, ...a) => executar(c.estado, { usuario: SOC, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, a);
  const tra = (fn, ...a) => executar(c.estado, { usuario: TRA, dono: DONO, ignorar: ['EquipeSeok.gs'] }, fn, a);
  const cl = c.dono('salvarCliente', { nome: 'Spa' });
  c.ana('salvarOportunidade', { titulo: 'Assessoria', clienteId: cl.id });
  assert.equal(soc('carregar').oportunidades.length, 0);
  assert.throws(() => soc('salvarOportunidade', { titulo: 'X' }), /área de Comercial/);
  const p = soc('salvarPost', { clienteId: cl.id, titulo: 'Reels de bastidores', formato: 'Reels' });
  assert.equal(p.status, 'pauta');
  assert.throws(() => soc('moverPost', p.id, 'agendado'), /data/);
  assert.equal(soc('carregar').posts.length, 1);
  assert.equal(tra('carregar').posts.length, 0);
  assert.throws(() => tra('salvarPost', { clienteId: cl.id, titulo: 'X' }), /Social media/);
  const camp = tra('salvarCampanha', { clienteId: cl.id, nome: 'Leads', verba: 3000 });
  tra('lancarResultado', { campanhaId: camp.id, investimento: '1.200,50'.replace('.', ''), leads: 30, cliques: 100, impressoes: 5000 });
  assert.equal(tra('carregar').resultados.length, 1);
  assert.equal(soc('carregar').campanhas.length, 0);
  assert.equal(c.dono('carregar').eu.areas.length, 4, 'o dono fora da equipe inicial entra com todas as áreas');
});

test('pipeline do financeiro: mover para Encerrados encerra; sair reativa', () => {
  const c = comEquipe();
  const cl = c.dono('salvarCliente', { nome: 'Spa' });
  let r = c.dono('salvarContrato', { clienteId: cl.id, tipo: 'fee', valor: 5000, inicio: mesesAtras(2), meses: 12 });
  assert.equal(r.contrato.fase, 'em_dia');
  r = c.dono('moverContratoFase', r.contrato.id, 'atraso');
  assert.equal(r.contrato.fase, 'atraso');
  r = c.dono('moverContratoFase', r.contrato.id, 'encerrado');
  assert.equal(r.contrato.status, 'encerrado');
  r = c.dono('moverContratoFase', r.contrato.id, 'renovacao');
  assert.equal(r.contrato.status, 'ativo');
  assert.equal(r.contrato.fase, 'renovacao');
  assert.throws(() => c.ana('moverContratoFase', r.contrato.id, 'em_dia'), /restrita/);
});

test('C-Vision: só quem tem a marcação, com a nota de saúde e as áreas', () => {
  const c = comEquipe();
  c.dono('popularExemplo');
  c.dono('salvarMembro', { email: DONO, nome: 'Dono', papel: 'admin', cvision: false });
  assert.throws(() => c.dono('cvision'), /exclusivo/);
  c.dono('salvarMembro', { email: DONO, nome: 'Dono', papel: 'admin', cvision: true });
  const v = c.dono('cvision');
  assert.ok(v.saude.nota >= 0 && v.saude.nota <= 100);
  assert.equal(v.saude.itens.reduce((s, i) => s + i.peso, 0), 100);
  assert.ok(v.comercial.abertoN > 0);
  assert.ok(v.financeiro.mrr > 0);
  assert.equal(v.financeiro.faturado12.length, 12);
  assert.ok(v.social.publicadosMes >= 0);
  assert.ok(v.trafego.investimento30 > 0);
  assert.throws(() => c.ana('cvision'), /exclusivo/);
});
