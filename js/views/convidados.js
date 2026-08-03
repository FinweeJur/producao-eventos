// Aba Convidados: lista de presença, importação de planilha e a rotina de
// automação que dispara as mensagens de confirmação por WhatsApp/Telegram.

import { db, novoId } from '../db.js';
import { el, abrirModal, toast, confirmar, meta, confete } from '../ui.js';
import {
  STATUS_CONVIDADO, EMOJI_STATUS, lerPlanilha, normalizarTelefone, telefoneLegivel,
  chaveDedupe, estatisticas, interpretarResposta,
} from '../convidados.js';
import { MODELOS_PADRAO, VARIAVEIS, montar, resumoDiario } from '../mensagens.js';
import {
  lerConfig, salvarConfig, abrirWhatsApp, enviarTelegram, testarTelegram,
  buscarRespostasTelegram, copiar, linkReuniao,
} from '../canais.js';
import { REGRAS, pendencias, registrarEnvio, diasAte, resumoPendenteHoje, marcarResumoEnviado } from '../automacao.js';

const EXEMPLO_PLANILHA = 'nome,telefone,email,grupo\nMaria Silva,31 98888-1111,maria@exemplo.org,imprensa\nJoão Souza,(31) 97777-2222,,artistas';

// ---------- Importação ----------

async function importarTexto(ctx, texto) {
  const { convidados: lidos, ignorados } = lerPlanilha(texto);
  if (!lidos.length) {
    toast('Nenhuma linha com nome foi reconhecida.', 'erro');
    return 0;
  }
  const existentes = new Set(ctx.convidados.map(chaveDedupe));
  let novos = 0, repetidos = 0;
  for (const c of lidos) {
    const chave = chaveDedupe(c);
    if (existentes.has(chave)) { repetidos++; continue; }
    existentes.add(chave);
    await db.salvar('convidados', { ...c, id: novoId(), eventoId: ctx.evento.id, envios: {}, criadoEm: Date.now() });
    novos++;
  }
  const partes = [`${novos} convidado(s) importado(s)`];
  if (repetidos) partes.push(`${repetidos} já estavam na lista`);
  if (ignorados) partes.push(`${ignorados} linha(s) sem nome ignorada(s)`);
  toast(partes.join(' · '), 'ok');
  await ctx.recarregar();
  return novos;
}

function abrirImportacao(ctx) {
  const area = el('textarea', { rows: 8, placeholder: EXEMPLO_PLANILHA, style: 'font-family: monospace; font-size: 0.85em' });
  const arquivo = el('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv' });
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files[0];
    if (f) area.value = await f.text();
  });

  const corpo = el('div', {},
    el('p', { class: 'meta' }, 'Exporte sua planilha como CSV (Excel/Sheets → “Salvar como CSV”) e escolha o arquivo — ou cole as linhas aqui embaixo.'),
    el('div', { class: 'campo' }, el('label', {}, 'Arquivo CSV'), arquivo),
    el('div', { class: 'campo' }, el('label', {}, 'Ou cole a planilha'), area),
    el('p', { class: 'meta' }, 'Colunas reconhecidas: nome, telefone/whatsapp, email, telegram, grupo, acompanhantes, observação. Só “nome” é obrigatório; sem cabeçalho, o app assume nome, telefone, email.'),
  );

  abrirModal('Importar lista de convidados', corpo, [
    { rotulo: 'Importar', onClick: async (fechar) => {
      const n = await importarTexto(ctx, area.value);
      if (n) fechar();
    } },
  ]);
}

// ---------- Cadastro manual ----------

function abrirFormConvidado(ctx, convidado = null) {
  const c = convidado || {};
  const campoNome = el('input', { type: 'text', value: c.nome || '', placeholder: 'Nome' });
  const campoTel = el('input', { type: 'tel', value: telefoneLegivel(c.telefone) || '', placeholder: '(31) 98888-1111' });
  const campoEmail = el('input', { type: 'email', value: c.email || '', placeholder: 'opcional' });
  const campoTelegram = el('input', { type: 'text', value: c.telegramChatId || '', placeholder: 'chat id do Telegram (opcional)' });
  const campoGrupo = el('input', { type: 'text', value: c.grupo || '', placeholder: 'Ex: imprensa, artistas, parceiros' });
  const campoAcomp = el('input', { type: 'number', min: 0, value: c.acompanhantes ?? 0 });
  const campoStatus = el('select', {}, Object.entries(STATUS_CONVIDADO).map(([v, r]) => {
    const o = el('option', { value: v }, `${EMOJI_STATUS[v]} ${r}`);
    if ((c.status || 'pendente') === v) o.selected = true;
    return o;
  }));
  const campoObs = el('input', { type: 'text', value: c.observacao || '', placeholder: 'Restrição alimentar, acessibilidade…' });

  const corpo = el('div', {},
    el('div', { class: 'campo' }, el('label', {}, 'Nome'), campoNome),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'WhatsApp'), campoTel),
      el('div', { class: 'campo' }, el('label', {}, 'Acompanhantes'), campoAcomp),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'E-mail'), campoEmail),
    el('div', { class: 'campo' }, el('label', {}, 'Telegram'), campoTelegram),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Grupo'), campoGrupo),
      el('div', { class: 'campo' }, el('label', {}, 'Situação'), campoStatus),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'Observação'), campoObs),
  );

  abrirModal(convidado ? 'Editar convidado' : 'Novo convidado', corpo, [
    { rotulo: convidado ? 'Salvar' : 'Adicionar', onClick: async (fechar) => {
      const nome = campoNome.value.trim();
      if (!nome) { toast('Informe o nome.', 'erro'); return; }
      await db.salvar('convidados', {
        ...c,
        id: c.id || novoId(),
        eventoId: ctx.evento.id,
        nome,
        telefone: normalizarTelefone(campoTel.value),
        email: campoEmail.value.trim(),
        telegramChatId: campoTelegram.value.trim(),
        grupo: campoGrupo.value.trim(),
        acompanhantes: Number(campoAcomp.value) || 0,
        status: campoStatus.value,
        observacao: campoObs.value.trim(),
        envios: c.envios || {},
        criadoEm: c.criadoEm || Date.now(),
      });
      fechar();
      ctx.recarregar();
    } },
  ]);
}

// ---------- Envio (fila) ----------

// Uma pessoa por vez: você vê o texto, ajusta se quiser e dispara. O app só
// marca como enviado depois que o canal foi acionado.
function abrirFila(ctx, regraId, lista) {
  const config = lerConfig();
  let i = 0;
  const corpo = el('div', {});
  const acoes = el('div', { class: 'acoes-tarefa', style: 'flex-wrap: wrap' });
  const fechar = abrirModal(`${MODELOS_PADRAO[regraId].nome} — ${lista.length} pessoa(s)`, corpo, []);

  const desenhar = () => {
    if (i >= lista.length) {
      corpo.innerHTML = '';
      corpo.append(
        el('div', { class: 'vazio' }, el('span', { class: 'emoji' }, '📨'),
          el('p', {}, 'Fila concluída. As respostas que chegarem por Telegram entram sozinhas em “Sincronizar respostas”; as de WhatsApp você marca na lista.')),
        el('button', { class: 'btn btn-bloco', onclick: () => { fechar(); ctx.recarregar(); } }, 'Fechar'),
      );
      confete();
      return;
    }
    const c = lista[i];
    const texto = montar(regraId, ctx.evento, c, config, { link: linkReuniao(ctx.evento) });
    const area = el('textarea', { rows: 7 });
    area.value = texto;

    const marcar = async () => {
      await db.salvar('convidados', registrarEnvio(c, regraId));
      i++;
      desenhar();
    };

    const podeWhats = Boolean(c.telefone);
    const podeTelegram = Boolean(config.tokenTelegram && c.telegramChatId);

    corpo.innerHTML = '';
    corpo.append(
      el('p', { class: 'meta' }, `${i + 1} de ${lista.length}`),
      el('h3', {}, c.nome),
      meta(
        c.telefone ? '📱 ' + telefoneLegivel(c.telefone) : '📱 sem telefone',
        c.telegramChatId ? '✈️ Telegram' : null,
        c.grupo || null,
      ),
      el('div', { class: 'campo' }, el('label', {}, 'Mensagem (pode editar antes de enviar)'), area),
      acoes,
    );

    acoes.innerHTML = '';
    acoes.append(
      el('button', {
        class: 'btn', disabled: podeWhats ? null : 'disabled',
        title: podeWhats ? 'Abre o WhatsApp com a mensagem pronta' : 'Este convidado não tem telefone',
        onclick: () => {
          if (!abrirWhatsApp(c.telefone, area.value)) { toast('Libere pop-ups para abrir o WhatsApp.', 'erro'); return; }
          marcar();
        },
      }, '🟢 WhatsApp'),
      el('button', {
        class: 'btn', disabled: podeTelegram ? null : 'disabled',
        title: podeTelegram ? 'Envia agora pelo seu bot' : 'Cadastre o token do bot e o chat id do convidado',
        onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            await enviarTelegram(config.tokenTelegram, c.telegramChatId, area.value);
            toast('Enviado pelo Telegram.', 'ok');
            await marcar();
          } catch (erro) {
            toast('Telegram: ' + erro.message, 'erro');
            ev.target.disabled = false;
          }
        },
      }, '✈️ Telegram'),
      el('button', { class: 'btn btn-suave', onclick: async () => {
        await copiar(area.value);
        toast('Mensagem copiada.', 'ok');
      } }, '📋 Copiar'),
      el('button', { class: 'btn btn-suave', onclick: () => { i++; desenhar(); } }, 'Pular →'),
    );
  };

  desenhar();
}

// ---------- Respostas do Telegram ----------

async function sincronizarTelegram(ctx) {
  const config = lerConfig();
  if (!config.tokenTelegram) { toast('Cadastre o token do bot em ⚙️ Automação.', 'erro'); return; }
  try {
    const { mensagens, ultimo } = await buscarRespostasTelegram(config.tokenTelegram, config.ultimoUpdateTelegram);
    salvarConfig({ ultimoUpdateTelegram: ultimo });
    let aplicadas = 0;
    const naoIdentificadas = [];
    for (const m of mensagens) {
      const status = interpretarResposta(m.texto);
      const alvo = ctx.convidados.find((c) => c.telegramChatId && String(c.telegramChatId) === m.chatId)
        || (m.telefone ? ctx.convidados.find((c) => c.telefone === normalizarTelefone(m.telefone)) : null);
      if (!alvo || !status) { naoIdentificadas.push(m); continue; }
      await db.salvar('convidados', { ...alvo, status, respondidoEm: new Date().toISOString(), respostaTexto: m.texto });
      aplicadas++;
    }
    await ctx.recarregar();
    if (aplicadas) { toast(`${aplicadas} resposta(s) registrada(s).`, 'ok'); confete(); }
    else if (!mensagens.length) toast('Nenhuma mensagem nova.');
    if (naoIdentificadas.length) {
      abrirModal('Mensagens que não deu para classificar', el('div', {},
        el('p', { class: 'meta' }, 'O bot recebeu estas mensagens, mas não consegui casar com um convidado ou entender a resposta. Anote o chat id na ficha da pessoa para as próximas.'),
        naoIdentificadas.map((m) => el('div', { class: 'sugestao' },
          el('div', { class: 'info' }, el('strong', {}, m.usuario || m.chatId),
            el('div', { class: 'motivo' }, `chat id ${m.chatId} · “${m.texto}”`)))),
      ));
    }
  } catch (erro) {
    toast('Telegram: ' + erro.message, 'erro');
  }
}

// ---------- Configurações da automação ----------

function abrirConfiguracoes(ctx) {
  const config = lerConfig();
  const campoCanal = el('select', {}, [['whatsapp', '🟢 WhatsApp (link, envio manual)'], ['telegram', '✈️ Telegram (bot, envio automático)']].map(([v, r]) => {
    const o = el('option', { value: v }, r);
    if (config.canal === v) o.selected = true;
    return o;
  }));
  const campoAssinatura = el('input', { type: 'text', value: config.assinatura, placeholder: 'Ex: Produção do Festival' });
  const campoToken = el('input', { type: 'password', value: config.tokenTelegram, placeholder: '123456:ABC… (do @BotFather)' });
  const campoEquipe = el('input', { type: 'text', value: config.chatEquipeTelegram, placeholder: 'chat id do grupo da equipe' });

  const regras = el('div', { class: 'campo' }, el('label', {}, 'Quando disparar'));
  const checks = {};
  for (const r of REGRAS) {
    const modelo = MODELOS_PADRAO[r.id];
    const chk = el('input', { type: 'checkbox' });
    chk.checked = (config.regras || {})[r.id] !== false;
    checks[r.id] = chk;
    regras.append(el('label', { class: 'meta', style: 'display:flex; gap:8px; align-items:flex-start; padding:4px 0; font-weight:400; cursor:pointer' },
      chk, el('span', {}, el('strong', {}, modelo.nome), ' — ', modelo.quando)));
  }

  const modelos = el('div', {});
  const areas = {};
  for (const [id, m] of Object.entries(MODELOS_PADRAO)) {
    const area = el('textarea', { rows: 4 });
    area.value = (config.modelos || {})[id] || m.texto;
    areas[id] = area;
    modelos.append(el('div', { class: 'campo' }, el('label', {}, m.nome), area));
  }

  const corpo = el('div', {},
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Canal preferido'), campoCanal),
      el('div', { class: 'campo' }, el('label', {}, 'Assinatura'), campoAssinatura),
    ),
    regras,
    el('h2', { class: 'titulo-ajuda' }, 'Telegram (opcional)'),
    el('p', { class: 'meta' }, 'Crie um bot no @BotFather, cole o token aqui e peça para os convidados darem /start no bot. Só com o token preenchido o app fala com a internet — sem ele, tudo continua 100% offline.'),
    el('div', { class: 'campo' }, el('label', {}, 'Token do bot'), campoToken),
    el('div', { class: 'campo' }, el('label', {}, 'Chat do grupo da equipe (resumo diário)'), campoEquipe),
    el('h2', { class: 'titulo-ajuda' }, 'Textos das mensagens'),
    el('p', { class: 'meta' }, 'Variáveis: ' + VARIAVEIS.map(([v]) => v).join(' ')),
    modelos,
  );

  abrirModal('⚙️ Automação de mensagens', corpo, [
    { rotulo: '🔌 Testar bot', classe: 'btn btn-suave', onClick: async () => {
      try {
        toast('Conectado como ' + await testarTelegram(campoToken.value.trim()), 'ok');
      } catch (erro) { toast('Telegram: ' + erro.message, 'erro'); }
    } },
    { rotulo: 'Salvar', onClick: (fechar) => {
      salvarConfig({
        canal: campoCanal.value,
        assinatura: campoAssinatura.value.trim() || 'Produção',
        tokenTelegram: campoToken.value.trim(),
        chatEquipeTelegram: campoEquipe.value.trim(),
        regras: Object.fromEntries(Object.entries(checks).map(([id, c]) => [id, c.checked])),
        modelos: Object.fromEntries(Object.entries(areas).map(([id, a]) => [id, a.value.trim()])),
      });
      fechar();
      toast('Automação salva.', 'ok');
      ctx.recarregar();
    } },
  ]);
}

// ---------- Resumo diário da equipe ----------

async function abrirResumoDiario(ctx) {
  const config = lerConfig();
  const texto = resumoDiario(ctx.evento, ctx.tarefas, estatisticas(ctx.convidados), diasAte(ctx.evento.dataInicio));
  const area = el('textarea', { rows: 12 });
  area.value = texto;

  abrirModal('📣 Resumo diário da produção', el('div', {},
    el('p', { class: 'meta' }, 'Mande no grupo da equipe. Se o chat do grupo estiver configurado, o envio é direto pelo bot.'),
    el('div', { class: 'campo' }, area),
  ), [
    { rotulo: '📋 Copiar', classe: 'btn btn-suave', onClick: async () => { await copiar(area.value); toast('Copiado.', 'ok'); } },
    { rotulo: '✈️ Enviar à equipe', onClick: async (fechar) => {
      if (!config.tokenTelegram || !config.chatEquipeTelegram) { toast('Configure o token e o chat da equipe em ⚙️ Automação.', 'erro'); return; }
      try {
        await enviarTelegram(config.tokenTelegram, config.chatEquipeTelegram, area.value);
        await db.salvar('eventos', marcarResumoEnviado(ctx.evento));
        fechar();
        toast('Resumo enviado à equipe.', 'ok');
        ctx.recarregar();
      } catch (erro) { toast('Telegram: ' + erro.message, 'erro'); }
    } },
  ]);
}

// ---------- Ponte com o worker opcional (automacao/worker.mjs) ----------

function abrirWorker(ctx) {
  const config = lerConfig();

  const baixarJSON = () => {
    const dados = {
      geradoEm: new Date().toISOString(),
      evento: ctx.evento,
      tarefas: ctx.tarefas,
      convidados: ctx.convidados,
      config: { ...config, linkReuniao: linkReuniao(ctx.evento) },
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
    a.download = 'dados.json';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const arquivo = el('input', { type: 'file', accept: '.json,application/json' });
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files[0];
    if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      if (!Array.isArray(dados.convidados)) throw new Error('arquivo sem lista de convidados');
      let atualizados = 0;
      for (const vindo of dados.convidados) {
        const atual = ctx.convidados.find((c) => c.id === vindo.id);
        if (!atual) continue;
        await db.salvar('convidados', {
          ...atual, status: vindo.status, envios: vindo.envios || atual.envios,
          respondidoEm: vindo.respondidoEm || atual.respondidoEm, respostaTexto: vindo.respostaTexto || atual.respostaTexto,
        });
        atualizados++;
      }
      if (dados.evento?.automacao) await db.salvar('eventos', { ...ctx.evento, automacao: dados.evento.automacao });
      if (dados.config?.ultimoUpdateTelegram) salvarConfig({ ultimoUpdateTelegram: dados.config.ultimoUpdateTelegram });
      toast(`${atualizados} convidado(s) sincronizado(s) com o worker.`, 'ok');
      ctx.recarregar();
    } catch (erro) {
      toast('JSON inválido: ' + erro.message, 'erro');
    }
  });

  abrirModal('🤖 Worker de lembretes (opcional)', el('div', {},
    el('p', {}, 'O app já dispara tudo quando você o abre. O worker serve para deixar os lembretes rodando sozinhos num PC ligado — ele envia só por Telegram.'),
    el('div', { class: 'campo' }, el('label', {}, '1. Baixe os dados'),
      el('button', { class: 'btn', onclick: baixarJSON }, '⬇️ Baixar dados.json')),
    el('div', { class: 'campo' }, el('label', {}, '2. Rode no terminal'),
      el('p', { class: 'meta', style: 'font-family: monospace' }, 'node automacao/worker.mjs dados.json --loop 3600')),
    el('div', { class: 'campo' }, el('label', {}, '3. Traga de volta o que ele fez'), arquivo),
    el('p', { class: 'meta' }, '⚠️ O dados.json leva o token do bot e os contatos dos convidados. Guarde como você guardaria a planilha original.'),
  ));
}

// ---------- Painel da automação ----------

function painelAutomacao(ctx) {
  const config = lerConfig();
  const lista = pendencias(ctx.evento, ctx.convidados, config);
  const dias = diasAte(ctx.evento.dataInicio);

  const card = el('div', { class: 'card cartao-passo' },
    el('strong', {}, '🤖 Rotina de automação'),
    el('p', { class: 'meta' },
      dias === null ? 'Defina a data do evento para a rotina agendar as mensagens.'
        : dias >= 0 ? `Faltam ${dias} dia(s) para o evento.` : `O evento foi há ${-dias} dia(s).`),
  );

  if (!lista.length) {
    card.append(el('p', {}, ctx.convidados.length
      ? 'Nada a enviar hoje — a rotina avisa aqui quando chegar a hora de cada mensagem.'
      : 'Importe a lista de convidados para a rotina começar a trabalhar.'));
  } else {
    for (const p of lista) {
      card.append(el('div', { class: 'sugestao' },
        el('div', { class: 'info' },
          el('strong', {}, `${p.nome} — ${p.convidados.length} pessoa(s)`),
          el('div', { class: 'motivo' }, p.quando)),
        el('button', { class: 'btn', onclick: () => abrirFila(ctx, p.regra.id, p.convidados) }, 'Enviar'),
      ));
    }
  }

  const acoes = el('div', { class: 'acoes-tarefa', style: 'flex-wrap: wrap' },
    el('button', { class: 'btn btn-suave', onclick: () => sincronizarTelegram(ctx) }, '🔄 Sincronizar respostas'),
    el('button', { class: 'btn btn-suave' + (resumoPendenteHoje(ctx.evento) ? ' pulsar' : ''), onclick: () => abrirResumoDiario(ctx) }, '📣 Resumo diário'),
    el('button', { class: 'btn btn-suave', onclick: () => abrirConfiguracoes(ctx) }, '⚙️ Automação'),
    el('button', { class: 'btn btn-suave', onclick: () => abrirWorker(ctx) }, '🤖 Worker'),
  );
  card.append(acoes);
  return card;
}

// ---------- Lista ----------

function exportarConvidadosCSV(evento, convidados) {
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    ['nome', 'telefone', 'email', 'telegram', 'grupo', 'acompanhantes', 'situacao', 'respondido_em', 'observacao'].join(','),
    ...convidados.map((x) => [
      c(x.nome), c(telefoneLegivel(x.telefone)), c(x.email), c(x.telegramChatId), c(x.grupo),
      x.acompanhantes || 0, c(STATUS_CONVIDADO[x.status] || x.status), c(x.respondidoEm || ''), c(x.observacao),
    ].join(',')),
  ];
  const nome = evento.nome.normalize('NFD').replace(/[^A-Za-z\d-]+/g, '_');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nome}_convidados.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

const FILTRO_CHAVE = 'filtroConvidados';

export function renderConvidados(container, ctx) {
  const { evento, convidados } = ctx;

  if (!evento) {
    container.append(el('div', { class: 'vazio' },
      el('span', { class: 'emoji' }, '🎟'),
      el('p', {}, 'Crie um evento para montar a lista de convidados e ligar a confirmação automática de presença.')));
    return;
  }

  container.append(painelAutomacao(ctx));

  const est = estatisticas(convidados);
  container.append(el('div', { class: 'card' },
    el('h3', {}, '🎟 Lista de convidados'),
    meta(
      `${est.total} na lista`,
      `✅ ${est.confirmado} confirmados`,
      `🤔 ${est.talvez} talvez`,
      `❌ ${est.recusado} não vêm`,
      `⚪ ${est.semResposta} sem resposta`,
    ),
    est.total ? el('div', { class: 'progresso', title: `${est.taxaResposta}% responderam` },
      el('div', { style: `width:${est.taxaResposta}%` })) : null,
    est.total ? meta(`${est.taxaResposta}% responderam`, `👤 público previsto: ${est.publico} (com acompanhantes)`) : null,
    el('div', { class: 'acoes-tarefa', style: 'flex-wrap: wrap' },
      el('button', { class: 'btn', onclick: () => abrirImportacao(ctx) }, '📊 Importar planilha'),
      el('button', { class: 'btn btn-suave', onclick: () => abrirFormConvidado(ctx) }, '+ Convidado'),
      convidados.length ? el('button', { class: 'btn btn-suave', onclick: () => exportarConvidadosCSV(evento, convidados) }, '📄 Exportar CSV') : null,
    ),
  ));

  if (!convidados.length) {
    container.append(el('div', { class: 'vazio' },
      el('span', { class: 'emoji' }, '📇'),
      el('p', {}, 'Sem convidados ainda. Traga sua planilha do Excel/Sheets — o app reconhece as colunas nome, telefone, e-mail e grupo.')));
    return;
  }

  let filtro = localStorage.getItem(FILTRO_CHAVE) || 'todos';
  const chips = el('div', { class: 'chips' });
  const listaEl = el('div', {});

  const desenharLista = () => {
    listaEl.innerHTML = '';
    const visiveis = filtro === 'todos' ? convidados : convidados.filter((c) => c.status === filtro);
    if (!visiveis.length) {
      listaEl.append(el('p', { class: 'meta' }, 'Ninguém nesta situação.'));
      return;
    }
    for (const c of [...visiveis].sort((a, b) => a.nome.localeCompare(b.nome))) {
      const trocarStatus = async (novo) => {
        await db.salvar('convidados', { ...c, status: novo, respondidoEm: new Date().toISOString() });
        if (novo === 'confirmado') confete();
        ctx.recarregar();
      };
      listaEl.append(el('div', { class: 'card card-tarefa' },
        el('div', { class: 'linha-tarefa' },
          el('span', { class: 'cadeado', title: STATUS_CONVIDADO[c.status] }, EMOJI_STATUS[c.status]),
          el('div', { class: 'info' },
            el('h3', {}, c.nome, c.acompanhantes ? el('span', { class: 'meta' }, ` +${c.acompanhantes}`) : null),
            meta(
              STATUS_CONVIDADO[c.status],
              c.telefone ? '📱 ' + telefoneLegivel(c.telefone) : null,
              c.grupo || null,
              Object.keys(c.envios || {}).length ? `📨 ${Object.keys(c.envios).length} envio(s)` : null,
            ),
            c.observacao ? el('div', { class: 'meta' }, '📝 ' + c.observacao) : null,
          ),
        ),
        el('div', { class: 'acoes-tarefa', style: 'flex-wrap: wrap' },
          el('button', { class: 'btn btn-suave', title: 'Confirmar presença', onclick: () => trocarStatus('confirmado') }, '✅'),
          el('button', { class: 'btn btn-suave', title: 'Talvez', onclick: () => trocarStatus('talvez') }, '🤔'),
          el('button', { class: 'btn btn-suave', title: 'Não vem', onclick: () => trocarStatus('recusado') }, '❌'),
          el('button', { class: 'btn btn-suave', title: 'Mensagem avulsa', onclick: () => abrirFila(ctx, 'confirmacao', [c]) }, '💬'),
          el('button', { class: 'btn-icone', title: 'Editar', 'aria-label': `Editar ${c.nome}`, onclick: () => abrirFormConvidado(ctx, c) }, '✏️'),
          el('button', { class: 'btn-icone', title: 'Remover', 'aria-label': `Remover ${c.nome}`, onclick: async () => {
            if (!await confirmar(`Remover ${c.nome} da lista de convidados?`)) return;
            await db.remover('convidados', c.id);
            ctx.recarregar();
          } }, '🗑'),
        ),
      ));
    }
  };

  const opcoesFiltro = [['todos', `Todos (${est.total})`], ...Object.entries(STATUS_CONVIDADO)
    .map(([v, r]) => [v, `${EMOJI_STATUS[v]} ${r} (${est[v] || 0})`])];
  for (const [valor, rotulo] of opcoesFiltro) {
    const b = el('button', { class: 'chip' + (filtro === valor ? ' ativa' : ''), onclick: () => {
      filtro = valor;
      localStorage.setItem(FILTRO_CHAVE, valor);
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('ativa'));
      b.classList.add('ativa');
      desenharLista();
    } }, rotulo);
    chips.append(b);
  }

  container.append(chips, listaEl);
  desenharLista();
}
