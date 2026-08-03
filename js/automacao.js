// Rotina de automação: decide QUE mensagem cada convidado deve receber HOJE.
// O "worker" roda no próprio app, quando você o abre (offline-first, sem
// servidor). Em automacao/worker.mjs há a versão opcional em Node, para quem
// quiser disparo automático sem abrir o app.

import { MODELOS_PADRAO } from './mensagens.js';

export const REGRAS = [
  { id: 'convite', dias: null, alvo: ['pendente'], exigeAnterior: null },
  { id: 'confirmacao', dias: 7, alvo: ['pendente', 'convidado'], exigeAnterior: null },
  { id: 'cobranca', dias: 3, alvo: ['pendente', 'convidado'], exigeAnterior: 'confirmacao' },
  { id: 'lembrete', dias: 1, alvo: ['confirmado'], exigeAnterior: null },
  { id: 'agradecimento', dias: -1, alvo: ['confirmado'], exigeAnterior: null, depois: true },
];

export const REGRA_POR_ID = Object.fromEntries(REGRAS.map((r) => [r.id, r]));

const hojeISO = () => new Date().toISOString().slice(0, 10);

// Dias inteiros entre hoje e a data do evento (negativo = já passou).
export function diasAte(dataISO) {
  if (!dataISO) return null;
  const alvo = new Date(dataISO + 'T00:00:00');
  const hoje = new Date(hojeISO() + 'T00:00:00');
  return Math.round((alvo - hoje) / 864e5);
}

export function jaEnviado(convidado, regraId) {
  return Boolean((convidado.envios || {})[regraId]);
}

function regraAtivada(config, regraId) {
  const r = config.regras || {};
  return r[regraId] !== false;   // tudo ligado por padrão; o usuário desliga
}

function cabe(regra, evento, convidado, config) {
  if (!regraAtivada(config, regra.id)) return false;
  if (!regra.alvo.includes(convidado.status)) return false;
  if (jaEnviado(convidado, regra.id)) return false;
  if (regra.exigeAnterior && !jaEnviado(convidado, regra.exigeAnterior)) return false;
  if (regra.dias === null) return true;
  const dias = diasAte(evento.dataInicio);
  if (dias === null) return regra.id === 'convite';
  return regra.depois ? dias <= regra.dias : dias >= 0 && dias <= regra.dias;
}

/**
 * O que a automação recomenda enviar hoje, agrupado por regra.
 * @returns {{regra: object, nome: string, quando: string, convidados: object[]}[]}
 */
export function pendencias(evento, convidados, config) {
  if (!evento) return [];
  return REGRAS.map((regra) => ({
    regra,
    nome: MODELOS_PADRAO[regra.id].nome,
    quando: MODELOS_PADRAO[regra.id].quando,
    convidados: convidados.filter((c) => cabe(regra, evento, c, config)),
  })).filter((p) => p.convidados.length);
}

export function totalPendente(evento, convidados, config) {
  return pendencias(evento, convidados, config).reduce((s, p) => s + p.convidados.length, 0);
}

// Marca o disparo no convidado (e promove "pendente" para "convidado").
export function registrarEnvio(convidado, regraId) {
  const envios = { ...(convidado.envios || {}), [regraId]: new Date().toISOString() };
  const status = (regraId === 'convite' || regraId === 'confirmacao') && convidado.status === 'pendente'
    ? 'convidado' : convidado.status;
  return { ...convidado, envios, status };
}

// O resumo diário da equipe sai uma vez por dia, por evento.
export function resumoPendenteHoje(evento) {
  const auto = evento?.automacao || {};
  return Boolean(evento) && auto.resumoDiario !== false && auto.resumoEnviadoEm !== hojeISO();
}

export function marcarResumoEnviado(evento) {
  return { ...evento, automacao: { ...(evento.automacao || {}), resumoEnviadoEm: hojeISO() } };
}
