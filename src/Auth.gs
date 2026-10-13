/**
 * Equipe e papéis (aba "equipe").
 *   leitor       só visualiza
 *   colaborador  cria e edita oportunidades, clientes, tarefas, propostas e lança as próprias horas
 *   gestor       também arquiva, apaga e vê as horas de todo mundo
 *   admin        também mexe na configuração e na equipe
 * No primeiro acesso, o dono da planilha entra como admin.
 */
const PAPEIS = { leitor: 1, colaborador: 2, gestor: 3, admin: 4 };

let EU_ = null;

function emailAtual_() { return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); }

function eu_() {
  if (EU_) return EU_;
  const email = emailAtual_();
  if (!ler_('equipe').length) {
    const dono = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
    if (dono) {
      comTrava_(function () {
        if (!ler_('equipe').length) inserir_('equipe', { email: dono, nome: nomeDoEmail_(dono), papel: 'admin', ativo: true, criadoEm: agora_() });
      });
    }
  }
  let m = email ? achar_('equipe', email) : null;
  if (!m && email) {
    const cfg = config_();
    if (cfg.entradaAutomatica && cfg.dominio && email.slice(-cfg.dominio.length - 1) === '@' + cfg.dominio) {
      m = comTrava_(function () {
        return achar_('equipe', email) || inserir_('equipe', { email: email, nome: nomeDoEmail_(email), papel: 'colaborador', ativo: true, criadoEm: agora_() });
      });
    }
  }
  EU_ = m && m.ativo && PAPEIS[m.papel]
    ? { email: email, nome: m.nome || nomeDoEmail_(email), papel: m.papel }
    : { email: email, nome: email ? nomeDoEmail_(email) : '', papel: 'sem_acesso' };
  return EU_;
}

function pode_(eu, papel) { return (PAPEIS[eu.papel] || 0) >= PAPEIS[papel]; }

function exigir_(papel) {
  const eu = eu_();
  if (eu.papel === 'sem_acesso') throw new Error('Você não tem acesso a este CRM. Fale com o administrador.');
  if (!pode_(eu, papel)) throw new Error('Seu papel (' + eu.papel + ') não permite esta ação.');
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
    if (atual && atual.papel === 'admin' && atual.ativo && (papel !== 'admin' || !ativo)) {
      const admins = ler_('equipe').filter(function (m) { return m.papel === 'admin' && m.ativo; });
      if (admins.length <= 1) throw new Error('Este é o único admin. Promova outra pessoa antes.');
    }
    if (atual) {
      atualizar_('equipe', email, { nome: nome, papel: papel, ativo: ativo });
      if (atual.papel !== papel) registrar_(eu, 'equipe', email, 'alterou', 'papel', atual.papel, papel);
      if (atual.ativo !== ativo) registrar_(eu, 'equipe', email, ativo ? 'reativou' : 'desativou', '', '', '');
    } else {
      inserir_('equipe', { email: email, nome: nome, papel: papel, ativo: ativo, criadoEm: agora_() });
      registrar_(eu, 'equipe', email, 'adicionou', 'papel', '', papel);
    }
    return ler_('equipe');
  });
}
