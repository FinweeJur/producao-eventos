// Modelos de mensagem e substituição de variáveis.
// Nada é enviado aqui: este módulo só monta o texto (ver canais.js).

import { ROTULO_FORMATO, ROTULO_ACESSO } from './relatorio.js';

export const VARIAVEIS = [
  ['{nome}', 'Primeiro nome do convidado'],
  ['{evento}', 'Nome do evento'],
  ['{data}', 'Data de início (dd/mm/aaaa)'],
  ['{hora}', 'Horário, se informado no local'],
  ['{local}', 'Local do evento'],
  ['{formato}', 'Presencial / Virtual / Híbrido'],
  ['{acesso}', 'Gratuito / Pago / Patrocinado'],
  ['{link}', 'Link da sala on-line (Jitsi), quando houver'],
  ['{produtor}', 'Assinatura da produção'],
];

export const MODELOS_PADRAO = {
  convite: {
    nome: 'Convite',
    quando: 'Ao adicionar o convidado à lista',
    texto: 'Olá, {nome}! Você está convidado(a) para *{evento}*, dia {data}, em {local}. Acesso {acesso}. Em breve mando os detalhes. — {produtor}',
  },
  confirmacao: {
    nome: 'Confirmação de presença',
    quando: '7 dias antes do evento',
    texto: 'Oi, {nome}! Estamos fechando a lista de *{evento}* ({data}, {local}) e precisamos saber: você vem mesmo?\n\nResponda esta mensagem com *SIM*, *NÃO* ou *TALVEZ*. Sua resposta ajuda a produção a dimensionar tudo. — {produtor}',
  },
  lembrete: {
    nome: 'Lembrete de véspera',
    quando: '1 dia antes, só para quem confirmou',
    texto: 'É amanhã, {nome}! *{evento}* começa {data} em {local}. {link}\n\nTe esperamos! — {produtor}',
  },
  cobranca: {
    nome: 'Cobrança de resposta',
    quando: '3 dias antes, para quem não respondeu',
    texto: 'Oi, {nome}! Ainda não recebi sua resposta sobre *{evento}* ({data}). Responda *SIM* ou *NÃO* — mesmo que não possa vir, saber já ajuda muito. — {produtor}',
  },
  agradecimento: {
    nome: 'Agradecimento',
    quando: 'Depois do evento',
    texto: 'Obrigado por estar com a gente no *{evento}*, {nome}! Se puder, conta o que achou — a gente lê tudo. — {produtor}',
  },
};

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

function dataBR(iso) {
  if (!iso) return 'data a confirmar';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function contexto(evento, convidado = {}, extras = {}) {
  return {
    nome: primeiroNome(convidado.nome) || 'você',
    evento: evento?.nome || '',
    data: dataBR(evento?.dataInicio),
    hora: evento?.hora || '',
    local: evento?.local || 'local a confirmar',
    formato: ROTULO_FORMATO[evento?.formato] || '',
    acesso: (ROTULO_ACESSO[evento?.acesso] || '').toLowerCase(),
    link: extras.link || '',
    produtor: extras.produtor || 'Produção',
  };
}

export function renderizar(texto, dados) {
  return String(texto || '').replace(/\{(\w+)\}/g, (todo, chave) =>
    (dados[chave] === undefined || dados[chave] === null || dados[chave] === '') ? '' : String(dados[chave])
  ).replace(/[ \t]{2,}/g, ' ').trim();
}

// Texto pronto de um modelo para um convidado específico.
export function montar(chaveModelo, evento, convidado, config = {}, extras = {}) {
  const modelo = (config.modelos && config.modelos[chaveModelo]) || MODELOS_PADRAO[chaveModelo]?.texto || '';
  return renderizar(modelo, contexto(evento, convidado, { produtor: config.assinatura, ...extras }));
}

// Resumo diário da produção (vai para a equipe, não para os convidados).
export function resumoDiario(evento, tarefas, estatisticas, dias) {
  const pendentes = tarefas.filter((t) => t.status !== 'concluida');
  const criticas = pendentes.filter((t) => t.criticidade >= 4);
  const semDono = pendentes.filter((t) => !t.atribuidaA);
  const linhas = [
    `📋 *${evento.nome}* — resumo de hoje`,
    dias === null ? '' : dias > 0 ? `⏳ faltam ${dias} dia(s)` : dias === 0 ? '🎉 é hoje!' : `✅ evento encerrado há ${-dias} dia(s)`,
    `✅ ${tarefas.length - pendentes.length}/${tarefas.length} tarefas concluídas`,
    criticas.length ? `🔒 ${criticas.length} tarefa(s) crítica(s) em aberto` : '🔒 nenhuma tarefa crítica em aberto',
    semDono.length ? `👤 ${semDono.length} sem responsável` : null,
    estatisticas.total ? `🎟 convidados: ${estatisticas.confirmado} confirmados, ${estatisticas.semResposta} sem resposta (público previsto: ${estatisticas.publico})` : null,
  ].filter(Boolean);
  if (criticas.length) {
    linhas.push('', 'Prioridades:', ...criticas.slice(0, 5).map((t) => `• ${t.titulo} (${t.setor})`));
  }
  return linhas.join('\n');
}
