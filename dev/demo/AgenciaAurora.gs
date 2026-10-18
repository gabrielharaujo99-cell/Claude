/**
 * Agência Aurora: agência fictícia para demonstrar o Flowloop em reuniões de venda.
 * Tudo aqui é inventado (nomes, e-mails, números). Usada pelo modo demonstração (npm run demo)
 * e pode ser colada como arquivo extra numa instalação de demonstração no Apps Script.
 */
const TODAS_AS_AREAS_ = ['social', 'trafego', 'comercial', 'financeiro'];

const LOGO_AURORA_ = 'data:image/svg+xml;base64,' + Utilities.base64Encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">' +
  '<path d="M10 52 A50 50 0 0 1 110 52" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round"/>' +
  '<path d="M32 52 A28 28 0 0 1 88 52" fill="none" stroke="#000" stroke-width="10" stroke-linecap="round"/>' +
  '<circle cx="60" cy="50" r="9" fill="#000"/></svg>');

const CONFIG_AGENCIA = {
  empresa: 'Agência Aurora',
  produto: 'Flowloop',
  dominio: 'agenciaaurora.com.br',
  marca: { logoParticulas: LOGO_AURORA_ },
  segmentos: ['Saúde', 'Fitness', 'Estética', 'Alimentação', 'Varejo', 'Serviços'],
};

const EQUIPE_INICIAL = [
  { nome: 'Camila Rocha', email: 'camila@agenciaaurora.com.br', cargo: 'CEO e fundadora', papel: 'admin', areas: TODAS_AS_AREAS_, cvision: true,
    atividades: ['Revisar o funil do mês', 'Reunião de estratégia com o cliente', 'Aprovar o posicionamento da marca'] },
  { nome: 'Rafael Monteiro', email: 'rafael@agenciaaurora.com.br', cargo: 'Diretor comercial', papel: 'admin', areas: TODAS_AS_AREAS_,
    atividades: ['Montar proposta comercial', 'Follow-up de negociação', 'Diagnóstico com lead novo'] },
  { nome: 'Beatriz Lemos', email: 'beatriz@agenciaaurora.com.br', cargo: 'Head de social media', papel: 'gestor', areas: ['social'],
    atividades: ['Aprovar as pautas da semana', 'Alinhar a linha editorial com o cliente', 'Montar o report mensal'] },
  { nome: 'Thiago Nunes', email: 'thiago@agenciaaurora.com.br', cargo: 'Designer', papel: 'colaborador', areas: ['social'],
    atividades: ['Criar as artes do calendário', 'Montar carrossel educativo', 'Ajustar a identidade visual'] },
  { nome: 'Larissa Duarte', email: 'larissa@agenciaaurora.com.br', cargo: 'Editora de vídeo', papel: 'colaborador', areas: ['social'],
    atividades: ['Editar os reels da semana', 'Gravar bastidores no cliente', 'Criar capas dos vídeos'] },
  { nome: 'Diego Castro', email: 'diego@agenciaaurora.com.br', cargo: 'Gestor de tráfego', papel: 'gestor', areas: ['trafego'],
    atividades: ['Subir campanha de captação', 'Analisar CPL da semana', 'Otimizar públicos e criativos'] },
  { nome: 'Fernanda Alves', email: 'fernanda@agenciaaurora.com.br', cargo: 'Financeiro', papel: 'gestor', areas: ['financeiro'],
    atividades: ['Emitir as notas do mês', 'Conferir reajustes previstos', 'Cobrar faturas em atraso'] },
];
