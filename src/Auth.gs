/**
 * Equipe, papéis e áreas (aba "equipe").
 * Papel diz o que a pessoa pode FAZER:
 *   leitor       só visualiza
 *   colaborador  cria e edita o que é da sua área e lança as próprias horas
 *   gestor       também arquiva, apaga e vê as horas de todo mundo
 *   admin        também mexe na configuração e na equipe
 * Área diz o que a pessoa VÊ: social (social media), trafego, comercial, financeiro. Cada um só recebe
 * os dados das próprias áreas. O C-Vision (visão do CEO) é uma marcação à parte.
 * No primeiro acesso, o dono da planilha entra como admin, junto com a equipe inicial (arquivo privado da agência, se existir);
 * se o dono não estiver na equipe inicial, entra com todas as áreas e o C-Vision.
 */
const PAPEIS = { leitor: 1, colaborador: 2, gestor: 3, admin: 4 };
const AREAS = ['social', 'trafego', 'comercial', 'financeiro'];
const NOME_AREA = { social: 'Social media', trafego: 'Tráfego', comercial: 'Comercial', financeiro: 'Financeiro' };

// O arquivo privado da agência (fora do Git) pode definir EQUIPE_INICIAL.
function equipeInicial_() { return typeof EQUIPE_INICIAL !== 'undefined' && Array.isArray(EQUIPE_INICIAL) ? EQUIPE_INICIAL : []; }

// Lista de áreas válida e sem repetição. A coluna antiga "financeiro" ainda conta como área.
function areas_(lista, financeiro) {
  const out = (Array.isArray(lista) ? lista : []).filter(function (a, i, arr) { return AREAS.indexOf(a) >= 0 && arr.indexOf(a) === i; });
  if (financeiro && out.indexOf('financeiro') < 0) out.push('financeiro');
  return out;
}

function registroMembro_(m, padrao) {
  const areas = areas_(m.areas || padrao, m.financeiro);
  return { areas: areas, financeiro: areas.indexOf('financeiro') >= 0, cvision: !!m.cvision };
}

function semearEquipe_(dono) {
  const agora = agora_();
  const iniciais = equipeInicial_();
  if (dono) {
    const meu = iniciais.filter(function (m) { return email_(m.email) === dono; })[0];
    inserir_('equipe', Object.assign({ email: dono, nome: meu && meu.nome || nomeDoEmail_(dono), papel: 'admin', ativo: true, criadoEm: agora, cargo: meu && meu.cargo || '' },
      meu ? registroMembro_(meu, []) : { areas: AREAS.slice(), financeiro: true, cvision: true }));
  }
  iniciais.forEach(function (m) {
    const email = email_(m.email);
    if (!email || email === dono) return;
    inserir_('equipe', Object.assign({
      email: email, nome: texto_(m.nome, 80) || nomeDoEmail_(email), papel: PAPEIS[m.papel] ? m.papel : 'colaborador',
      ativo: true, criadoEm: agora, cargo: texto_(m.cargo, 80),
    }, registroMembro_(m, [])));
  });
}

let EU_ = null;

// Apresentação (APRESENTAR_COMO no arquivo privado): o dono da planilha aparece como outra pessoa da equipe.
// Só vale para o dono, que já tem acesso total; o acesso do link continua o mesmo.
function apresentarComo_() { return typeof APRESENTAR_COMO !== 'undefined' && APRESENTAR_COMO ? String(APRESENTAR_COMO).toLowerCase() : ''; }

function emailDono_() { return String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase(); }

// Apelidos (APELIDOS no arquivo privado): uma conta pessoal entra como a pessoa da equipe.
function apelido_(email) { return typeof APELIDOS !== 'undefined' && APELIDOS[email] ? String(APELIDOS[email]).toLowerCase() : email; }

function emailAtual_() {
  const real = apelido_(String(Session.getActiveUser().getEmail() || '').trim().toLowerCase());
  return apresentarComo_() && real && real === emailDono_() ? apresentarComo_() : real;
}

function eu_() {
  if (EU_) return EU_;
  const email = emailAtual_();
  if (!ler_('equipe').length) {
    const dono = apresentarComo_() || emailDono_();
    if (dono) {
      comTrava_(function () {
        if (!ler_('equipe').length) semearEquipe_(dono);
      });
    }
  }
  let m = email ? achar_('equipe', email) : null;
  if (!m && email) {
    const cfg = config_();
    if (cfg.entradaAutomatica && cfg.dominio && email.slice(-cfg.dominio.length - 1) === '@' + cfg.dominio) {
      m = comTrava_(function () {
        return achar_('equipe', email) || inserir_('equipe', { email: email, nome: nomeDoEmail_(email), papel: 'colaborador', ativo: true, criadoEm: agora_(), areas: [] });
      });
    }
  }
  if (m && m.ativo && PAPEIS[m.papel]) {
    const r = registroMembro_(m, []);
    EU_ = { email: email, nome: m.nome || nomeDoEmail_(email), papel: m.papel, areas: r.areas, financeiro: r.financeiro, cvision: r.cvision, tema: m.tema || '' };
  } else {
    EU_ = { email: email, nome: email ? nomeDoEmail_(email) : '', papel: 'sem_acesso', areas: [], financeiro: false, cvision: false };
  }
  return EU_;
}

function pode_(eu, papel) { return (PAPEIS[eu.papel] || 0) >= PAPEIS[papel]; }

function temArea_(eu, area) { return (eu.areas || []).indexOf(area) >= 0; }

function exigir_(papel) {
  const eu = eu_();
  if (eu.papel === 'sem_acesso') throw new Error('Você não tem acesso a este CRM. Fale com o administrador.');
  if (!pode_(eu, papel)) throw new Error('Seu papel (' + eu.papel + ') não permite esta ação.');
  return eu;
}

// Exige o papel e pelo menos uma das áreas.
function exigirArea_(areas, papel) {
  const eu = exigir_(papel || 'leitor');
  const lista = [].concat(areas);
  if (!lista.some(function (a) { return temArea_(eu, a); })) {
    throw new Error('Isso é da área de ' + lista.map(function (a) { return NOME_AREA[a]; }).join(' / ') + '. Fale com o administrador para liberar.');
  }
  return eu;
}

function membroAtivo_(email) {
  const m = email ? achar_('equipe', email) : null;
  return m && m.ativo ? m : null;
}

function salvarMembro(d) {
  const eu = exigir_('admin');
  return comTrava_(function () {
    d = d || {};
    const email = email_(d.email);
    if (!email) throw new Error('E-mail inválido.');
    const papel = PAPEIS[d.papel] ? d.papel : 'colaborador';
    const ativo = d.ativo !== false;
    const nome = texto_(d.nome, 80) || nomeDoEmail_(email);
    const atual = achar_('equipe', email);
    const cargo = d.cargo == null && atual ? atual.cargo : texto_(d.cargo, 80);
    let areas = d.areas == null && atual ? registroMembro_(atual, []).areas : areas_(d.areas);
    // "financeiro: true/false" ainda funciona como atalho para pôr ou tirar a área Financeiro.
    if (d.financeiro === true && areas.indexOf('financeiro') < 0) areas = areas.concat(['financeiro']);
    if (d.financeiro === false) areas = areas.filter(function (a) { return a !== 'financeiro'; });
    const cvision = d.cvision == null && atual ? !!atual.cvision : !!d.cvision;
    const financeiro = areas.indexOf('financeiro') >= 0;
    if (atual && atual.papel === 'admin' && atual.ativo && (papel !== 'admin' || !ativo)) {
      const admins = ler_('equipe').filter(function (m) { return m.papel === 'admin' && m.ativo; });
      if (admins.length <= 1) throw new Error('Este é o único admin. Promova outra pessoa antes.');
    }
    const dados = { nome: nome, papel: papel, ativo: ativo, cargo: cargo, areas: areas, financeiro: financeiro, cvision: cvision };
    if (atual) {
      const antes = registroMembro_(atual, []);
      atualizar_('equipe', email, dados);
      if (atual.papel !== papel) registrar_(eu, 'equipe', email, 'alterou', 'papel', atual.papel, papel);
      if (atual.ativo !== ativo) registrar_(eu, 'equipe', email, ativo ? 'reativou' : 'desativou', '', '', '');
      if (antes.areas.join() !== areas.join()) registrar_(eu, 'equipe', email, 'alterou', 'áreas', antes.areas.join(', '), areas.join(', '));
      if (antes.cvision !== cvision) registrar_(eu, 'equipe', email, cvision ? 'liberou' : 'bloqueou', 'cvision', '', '');
    } else {
      inserir_('equipe', Object.assign({ email: email, criadoEm: agora_() }, dados));
      registrar_(eu, 'equipe', email, 'adicionou', 'papel', '', papel);
    }
    return ler_('equipe').map(function (m) { return membroTela_(m, fotosDiretorio_()); });
  });
}
