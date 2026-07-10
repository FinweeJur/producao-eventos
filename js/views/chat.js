// Aba Chat: assistente de planejamento em português.
// Usa Ollama local quando detectado (streaming); caso contrário funciona em
// modo offline com um assistente baseado em regras — sem perder as ações.

import { db, novoId } from '../db.js';
import { el, toast, abrirModal, formatarMinutos } from '../ui.js';
import { distribuirTarefas } from '../distribuir.js';

const historico = []; // {papel: 'usuario'|'bot', texto}
let ollamaDisponivel = null; // null = ainda não verificado

const SUGESTOES = [
  'Quais tarefas estão sem responsável?',
  'Liste as tarefas críticas pendentes',
  'Adicionar tarefa: contratar segurança, criticidade 5, setor infraestrutura, 3 horas',
  'Sugira quem pode cuidar da divulgação',
  'Quanto tempo falta no total?',
  'Me dê um resumo do evento',
];

function urlOllama() { return localStorage.getItem('ollamaUrl') || 'http://localhost:11434'; }
function modeloOllama() { return localStorage.getItem('ollamaModelo') || ''; }

async function detectarOllama() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const resp = await fetch(`${urlOllama()}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return false;
    const dados = await resp.json();
    if (!modeloOllama() && dados.models?.length) {
      localStorage.setItem('ollamaModelo', dados.models[0].name);
    }
    return Boolean(dados.models?.length);
  } catch {
    return false;
  }
}

function contextoJson(ctx) {
  const { evento, tarefas, pessoas } = ctx;
  return JSON.stringify({
    evento: evento ? {
      nome: evento.nome, tipo: evento.tipo, inicio: evento.dataInicio, fim: evento.dataFim,
      local: evento.local, formato: evento.formato, acesso: evento.acesso, publicoEstimado: evento.publicoEstimado,
    } : null,
    tarefas: tarefas.map((t) => ({
      titulo: t.titulo, setor: t.setor, criticidade: t.criticidade, status: t.status,
      minutos: t.tempoEstimadoMinutos,
      responsavel: (pessoas.find((p) => p.id === t.atribuidaA) || {}).nome || null,
    })),
    equipe: pessoas.map((p) => ({ nome: p.nome, papel: p.papel, aptidoes: p.aptidoes, disponibilidade: p.disponibilidade })),
  });
}

function promptSistema(ctx) {
  return `Você é um assistente de produção cultural falando português.
Seu trabalho é ajudar a criar, listar e atribuir tarefas de eventos.
Contexto atual (JSON): ${contextoJson(ctx)}
Responda sempre em português claro, de forma curta e prática. Sugira ações concretas.`;
}

// ---------- Assistente baseado em regras (fallback offline e comandos de ação) ----------

function extrairNovaTarefa(texto) {
  const m = texto.match(/(?:adicionar?|adicione|criar?|crie|nova)\s+(?:a\s+)?tarefa:?\s*(.+)/i);
  if (!m) return null;
  let resto = m[1];

  const crit = resto.match(/criticidade\s*(\d)/i);
  const setor = resto.match(/setor\s+(?:de\s+)?["']?([\p{L}\d \-]+?)["']?\s*(?:,|$|\.|\se\s)/iu);
  const horas = resto.match(/(\d+(?:[.,]\d+)?)\s*h(?:oras?)?/i);
  const minutos = resto.match(/(\d+)\s*min/i);

  let titulo = resto.match(/["'“”]([^"'“”]+)["'“”]/)?.[1];
  if (!titulo) {
    titulo = resto.split(/,|\bcom criticidade\b|\bsetor\b|\bcriticidade\b/i)[0].trim();
  }
  if (!titulo) return null;

  return {
    titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
    criticidade: crit ? Math.min(5, Math.max(1, Number(crit[1]))) : 3,
    setor: setor ? setor[1].trim().replace(/^\w/, (c) => c.toUpperCase()) : 'Geral',
    tempoEstimadoMinutos: minutos ? Number(minutos[1]) : horas ? Math.round(parseFloat(horas[1].replace(',', '.')) * 60) : 60,
  };
}

async function responderPorRegras(texto, ctx) {
  const { evento, tarefas, pessoas } = ctx;
  const q = texto.toLowerCase();
  const nomePessoa = (id) => (pessoas.find((p) => p.id === id) || {}).nome;
  const pendentes = tarefas.filter((t) => t.status !== 'concluida');

  // Ação: adicionar tarefa (funciona com ou sem Ollama)
  const nova = extrairNovaTarefa(texto);
  if (nova) {
    if (!evento) return 'Crie um evento primeiro (aba Evento) para eu poder adicionar tarefas. 😉';
    await db.salvar('tarefas', {
      id: novoId(), eventoId: evento.id, descricao: '', resultadoEsperado: '',
      dependeDe: [], status: 'pendente', atribuidaA: null, parentId: null, criadoEm: Date.now(),
      ...nova,
    });
    ctx.recarregar(false);
    return `✅ Tarefa criada: “${nova.titulo}” — setor ${nova.setor}, criticidade ${nova.criticidade}, ~${formatarMinutos(nova.tempoEstimadoMinutos)}.`;
  }

  if (!evento) return 'Nenhum evento ativo. Crie um na aba Evento e eu te ajudo a planejar!';

  if (/sem respons[aá]vel|sem dono|n[aã]o atribu/i.test(q)) {
    const soltas = pendentes.filter((t) => !t.atribuidaA);
    if (!soltas.length) return 'Todas as tarefas pendentes têm responsável. 👏';
    return `📋 ${soltas.length} tarefa(s) sem responsável:\n` +
      soltas.map((t) => `• [${t.criticidade >= 4 ? 'Crítico' : t.criticidade === 3 ? 'Médio' : 'Leve'}] ${t.titulo} (${t.setor})`).join('\n') +
      '\n\nDica: use o botão “🪄 Distribuir tarefas” ou me peça “sugira quem pode cuidar de…”.';
  }

  if (/cr[ií]tica/.test(q)) {
    const criticas = pendentes.filter((t) => t.criticidade >= 4);
    if (!criticas.length) return 'Nenhuma tarefa crítica pendente. Respira! 🌿';
    return `🔴 Tarefas críticas pendentes:\n` +
      criticas.map((t) => `• ${t.titulo} (${t.setor})${t.atribuidaA ? ' — ' + nomePessoa(t.atribuidaA) : ' — SEM RESPONSÁVEL ⚠️'}`).join('\n');
  }

  if (/sugira|quem pode|quem da equipe|indica/i.test(q)) {
    if (!pessoas.length) return 'A equipe está vazia. Cadastre pessoas na aba Equipe primeiro.';
    const alvo = pendentes.filter((t) => !t.atribuidaA && q.includes(t.setor.toLowerCase()));
    const paraDistribuir = alvo.length ? alvo : pendentes.filter((t) => !t.atribuidaA);
    if (!paraDistribuir.length) return 'Tudo já tem responsável — nada para sugerir. ✅';
    const { sugestoes, conflitos } = distribuirTarefas(
      [...tarefas.filter((t) => t.atribuidaA || t.status === 'concluida'), ...paraDistribuir], pessoas);
    let resposta = sugestoes.length
      ? '💡 Sugestões:\n' + sugestoes.map((s) => `• ${s.tarefa.titulo} → ${s.pessoa.nome} (${s.motivo})`).join('\n')
      : '';
    if (conflitos.length) {
      resposta += '\n⚠️ ' + conflitos.map((c) => `${c.tarefa.titulo}: ${c.motivo}`).join('\n⚠️ ');
    }
    return resposta + '\n\nConfirme na aba Tarefas com o botão “🪄 Distribuir tarefas”.';
  }

  if (/quanto tempo|tempo total|falta/i.test(q)) {
    const setorPedido = [...new Set(pendentes.map((t) => t.setor))].find((s) => q.includes(s.toLowerCase()));
    const consideradas = setorPedido ? pendentes.filter((t) => t.setor === setorPedido) : pendentes;
    const total = consideradas.reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0);
    return `⏱ ${setorPedido ? `Setor ${setorPedido}` : 'No total'}: faltam ~${formatarMinutos(total)} de trabalho em ${consideradas.length} tarefa(s) pendente(s).`;
  }

  if (/resumo|status|como est/i.test(q)) {
    const concluidas = tarefas.length - pendentes.length;
    const criticas = pendentes.filter((t) => t.criticidade >= 4);
    const semDono = pendentes.filter((t) => !t.atribuidaA);
    return `📋 Resumo de “${evento.nome}”:\n` +
      `✅ ${concluidas}/${tarefas.length} tarefas concluídas\n` +
      `🔴 ${criticas.length} crítica(s) pendente(s)\n` +
      `👤 ${semDono.length} sem responsável\n` +
      `⏱ faltam ~${formatarMinutos(pendentes.reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0))}`;
  }

  return 'Posso ajudar com:\n' + SUGESTOES.map((s) => `• ${s}`).join('\n') +
    '\n\n💡 Para respostas livres, instale o Ollama (ollama.com) e rode um modelo local — eu detecto automaticamente.';
}

// ---------- Cliente Ollama (streaming) ----------

async function responderPorOllama(texto, ctx, aoReceber) {
  const mensagens = [
    { role: 'system', content: promptSistema(ctx) },
    ...historico.slice(-10).map((m) => ({ role: m.papel === 'usuario' ? 'user' : 'assistant', content: m.texto })),
    { role: 'user', content: texto },
  ];
  const resp = await fetch(`${urlOllama()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modeloOllama(), messages: mensagens, stream: true }),
  });
  if (!resp.ok) throw new Error(`Ollama respondeu ${resp.status}`);

  const leitor = resp.body.getReader();
  const decodificador = new TextDecoder();
  let completo = '';
  let sobra = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    sobra += decodificador.decode(value, { stream: true });
    const linhas = sobra.split('\n');
    sobra = linhas.pop();
    for (const linha of linhas) {
      if (!linha.trim()) continue;
      try {
        const parte = JSON.parse(linha);
        if (parte.message?.content) { completo += parte.message.content; aoReceber(completo); }
      } catch { /* linha parcial — ignora */ }
    }
  }
  return completo || '(sem resposta do modelo)';
}

// ---------- Configuração do Ollama ----------

function abrirConfigOllama(ctx) {
  const campoUrl = el('input', { type: 'text', value: urlOllama(), placeholder: 'http://localhost:11434' });
  const campoModelo = el('input', { type: 'text', value: modeloOllama(), placeholder: 'ex: mistral:7b ou llama3:8b' });
  abrirModal('Configurar Ollama', el('div', {},
    el('p', { class: 'meta' }, 'O chatbot usa um LLM local via Ollama — suas conversas não saem do dispositivo. Sem Ollama, o chat funciona em modo básico (regras).'),
    el('div', { class: 'campo' }, el('label', {}, 'URL do servidor'), campoUrl),
    el('div', { class: 'campo' }, el('label', {}, 'Modelo (vazio = detectar)'), campoModelo),
  ), [
    { rotulo: 'Salvar', onClick: async (fechar) => {
      localStorage.setItem('ollamaUrl', campoUrl.value.trim().replace(/\/$/, ''));
      if (campoModelo.value.trim()) localStorage.setItem('ollamaModelo', campoModelo.value.trim());
      else localStorage.removeItem('ollamaModelo');
      ollamaDisponivel = await detectarOllama();
      toast(ollamaDisponivel ? 'Ollama conectado! 🤖' : 'Ollama não encontrado — modo básico ativo.');
      fechar();
      ctx.recarregar();
    } },
  ]);
}

// ---------- Render ----------

export function renderChat(container, ctx) {
  const mensagensEl = el('div', { class: 'chat-mensagens' });

  const desenharMensagens = () => {
    mensagensEl.innerHTML = '';
    if (!historico.length) {
      mensagensEl.append(el('div', { class: 'vazio' },
        el('span', { class: 'emoji' }, '💬'),
        el('p', {}, 'Sou seu assistente de produção. Experimente:'),
        el('div', { class: 'sugestoes-chat' },
          SUGESTOES.slice(0, 4).map((s) => el('button', { class: 'chip', onclick: () => enviar(s) }, s))
        ),
      ));
    }
    for (const m of historico) {
      mensagensEl.append(el('div', { class: `msg msg-${m.papel === 'usuario' ? 'usuario' : 'bot'}` }, m.texto));
    }
  };

  const statusEl = el('p', { class: 'chat-status' }, 'verificando assistente…');
  const atualizarStatus = () => {
    statusEl.textContent = ollamaDisponivel
      ? `🤖 Ollama conectado (${modeloOllama()}) — conversas 100% locais`
      : '📴 Modo básico (regras) — instale o Ollama para conversas livres';
  };

  const entrada = el('input', { type: 'text', placeholder: 'Pergunte ou dê um comando…', 'aria-label': 'Mensagem para o assistente' });

  async function enviar(texto) {
    texto = (texto || entrada.value).trim();
    if (!texto) return;
    entrada.value = '';
    historico.push({ papel: 'usuario', texto });
    desenharMensagens();

    const bolha = el('div', { class: 'msg msg-bot' }, '…');
    mensagensEl.append(bolha);
    bolha.scrollIntoView({ behavior: 'smooth' });

    let resposta;
    try {
      // Comandos de ação sempre passam pelas regras (criação real de tarefa).
      const acao = extrairNovaTarefa(texto);
      if (acao || !ollamaDisponivel) {
        resposta = await responderPorRegras(texto, ctx);
        bolha.textContent = resposta;
      } else {
        resposta = await responderPorOllama(texto, ctx, (parcial) => { bolha.textContent = parcial; });
      }
    } catch (e) {
      resposta = `Não consegui falar com o Ollama (${e.message}). Alternando para o modo básico.`;
      ollamaDisponivel = false;
      atualizarStatus();
      bolha.textContent = resposta;
    }
    historico.push({ papel: 'bot', texto: resposta });
    bolha.scrollIntoView({ behavior: 'smooth' });
  }

  container.append(el('div', { class: 'chat-caixa' },
    el('div', { class: 'acoes-tarefa' },
      statusEl,
      el('button', { class: 'btn-icone', title: 'Configurar Ollama', 'aria-label': 'Configurar Ollama', onclick: () => abrirConfigOllama(ctx) }, '⚙️'),
    ),
    mensagensEl,
    el('form', { class: 'chat-entrada', onsubmit: (ev) => { ev.preventDefault(); enviar(); } },
      entrada,
      el('button', { class: 'btn', type: 'submit' }, 'Enviar'),
    ),
  ));

  desenharMensagens();

  if (ollamaDisponivel === null) {
    detectarOllama().then((ok) => { ollamaDisponivel = ok; atualizarStatus(); });
  } else {
    atualizarStatus();
  }
}
