#!/usr/bin/env node
// Worker opcional de lembretes (Fase 5). O app é offline-first e não precisa
// dele: o worker existe para quem quer disparo automático sem abrir o app —
// por exemplo, num PC ligado ou num servidorzinho da produção.
//
//   node automacao/worker.mjs dados.json            # roda uma vez e sai
//   node automacao/worker.mjs dados.json --loop 3600  # repete a cada 1h
//   node automacao/worker.mjs dados.json --simular   # mostra sem enviar
//
// dados.json é o arquivo exportado pelo app em Convidados → 🤖 Worker (JSON).
// Depois de rodar, reimporte o mesmo arquivo no app para ele saber o que já
// foi enviado e quem respondeu.
//
// Sem dependências: usa só o Node (18+, fetch nativo) e os mesmos módulos do
// app, para a regra de negócio não existir em duas versões.

import { readFile, writeFile } from 'node:fs/promises';
import { pendencias, registrarEnvio, diasAte } from '../js/automacao.js';
import { montar, resumoDiario } from '../js/mensagens.js';
import { estatisticas, interpretarResposta } from '../js/convidados.js';

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--'));
const simular = args.includes('--simular');
const iLoop = args.indexOf('--loop');
const intervalo = iLoop >= 0 ? Number(args[iLoop + 1] || 3600) : 0;

if (!arquivo) {
  console.error('uso: node automacao/worker.mjs dados.json [--loop SEGUNDOS] [--simular]');
  process.exit(1);
}

const log = (...m) => console.log(new Date().toISOString().slice(0, 19).replace('T', ' '), ...m);

async function telegram(token, metodo, params) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const dados = await resp.json();
  if (!dados.ok) throw new Error(dados.description || `HTTP ${resp.status}`);
  return dados.result;
}

// Respostas que chegaram ao bot desde a última rodada viram status na lista.
async function coletarRespostas(dados) {
  const { config } = dados;
  const updates = await telegram(config.tokenTelegram, 'getUpdates', {
    offset: config.ultimoUpdateTelegram ? config.ultimoUpdateTelegram + 1 : undefined,
    timeout: 0, allowed_updates: ['message'],
  });
  let aplicadas = 0;
  for (const u of updates || []) {
    config.ultimoUpdateTelegram = Math.max(config.ultimoUpdateTelegram || 0, u.update_id);
    const texto = u.message?.text;
    if (!texto) continue;
    const chatId = String(u.message.chat.id);
    const status = interpretarResposta(texto);
    const alvo = dados.convidados.find((c) => String(c.telegramChatId) === chatId);
    if (!alvo || !status) continue;
    alvo.status = status;
    alvo.respondidoEm = new Date().toISOString();
    alvo.respostaTexto = texto;
    aplicadas++;
    log(`resposta de ${alvo.nome}: ${status}`);
  }
  return aplicadas;
}

async function rodada() {
  const dados = JSON.parse(await readFile(arquivo, 'utf8'));
  const { evento, config } = dados;
  if (!config?.tokenTelegram) {
    log('sem token de bot no arquivo — o worker só envia por Telegram. Nada a fazer.');
    return;
  }

  const respostas = await coletarRespostas(dados).catch((e) => { log('erro ao ler respostas:', e.message); return 0; });

  let enviadas = 0;
  for (const grupo of pendencias(evento, dados.convidados, config)) {
    for (const convidado of grupo.convidados) {
      if (!convidado.telegramChatId) continue;   // sem Telegram, fica para o app (WhatsApp)
      const texto = montar(grupo.regra.id, evento, convidado, config, { link: config.linkReuniao || '' });
      if (simular) {
        log(`[simulação] ${grupo.nome} → ${convidado.nome}: ${texto.slice(0, 60)}…`);
      } else {
        try {
          await telegram(config.tokenTelegram, 'sendMessage', {
            chat_id: convidado.telegramChatId, text: texto, parse_mode: 'Markdown', disable_web_page_preview: true,
          });
          Object.assign(convidado, registrarEnvio(convidado, grupo.regra.id));
          log(`${grupo.nome} → ${convidado.nome}`);
        } catch (e) {
          log(`falha ao enviar para ${convidado.nome}: ${e.message}`);
          continue;
        }
      }
      enviadas++;
    }
  }

  // Resumo diário para o grupo da equipe, uma vez por dia.
  const hoje = new Date().toISOString().slice(0, 10);
  const auto = evento.automacao || (evento.automacao = {});
  if (config.chatEquipeTelegram && auto.resumoDiario !== false && auto.resumoEnviadoEm !== hoje) {
    const texto = resumoDiario(evento, dados.tarefas || [], estatisticas(dados.convidados), diasAte(evento.dataInicio));
    if (simular) log('[simulação] resumo diário para a equipe');
    else {
      await telegram(config.tokenTelegram, 'sendMessage', {
        chat_id: config.chatEquipeTelegram, text: texto, parse_mode: 'Markdown', disable_web_page_preview: true,
      });
      auto.resumoEnviadoEm = hoje;
      log('resumo diário enviado à equipe');
    }
  }

  if (!simular) await writeFile(arquivo, JSON.stringify(dados, null, 2), 'utf8');
  log(`rodada concluída — ${enviadas} mensagem(ns), ${respostas} resposta(s) registrada(s)`);
}

await rodada();
if (intervalo > 0) {
  log(`em loop a cada ${intervalo}s (Ctrl+C para parar)`);
  setInterval(() => rodada().catch((e) => log('erro:', e.message)), intervalo * 1000);
}
