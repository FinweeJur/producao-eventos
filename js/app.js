// Orquestrador: estado global, seletor de evento, abas e tema.

import { db } from './db.js';
import { renderEvento, abrirWizardEvento } from './views/evento.js';
import { renderTarefas } from './views/tarefas.js';
import { renderEquipe } from './views/equipe.js';
import { renderChat } from './views/chat.js';
import { iniciarTour, abrirAjuda } from './ajuda.js';

const VIEWS = { evento: renderEvento, tarefas: renderTarefas, equipe: renderEquipe, chat: renderChat };

const ctx = {
  eventos: [],
  evento: null,
  tarefas: [],
  pessoas: [],
  abaAtiva: localStorage.getItem('abaAtiva') || 'evento',
  recarregar,
  selecionarEvento,
  irParaAba,
};

function irParaAba(aba) {
  ctx.abaAtiva = aba;
  localStorage.setItem('abaAtiva', aba);
  renderAba();
}

async function carregarDados() {
  ctx.eventos = (await db.listar('eventos')).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  ctx.pessoas = await db.listar('pessoas');
  const idSalvo = localStorage.getItem('eventoAtivo');
  ctx.evento = ctx.eventos.find((e) => e.id === idSalvo) || ctx.eventos[0] || null;
  ctx.tarefas = ctx.evento ? await db.tarefasDoEvento(ctx.evento.id) : [];
}

function atualizarSeletor() {
  const sel = document.getElementById('seletor-evento');
  sel.innerHTML = '';
  for (const e of ctx.eventos) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.nome;
    if (ctx.evento && e.id === ctx.evento.id) o.selected = true;
    sel.append(o);
  }
  const novo = document.createElement('option');
  novo.value = '__novo';
  novo.textContent = '+ Novo evento…';
  sel.append(novo);
  sel.style.visibility = ctx.eventos.length ? 'visible' : 'hidden';
}

function renderAba() {
  document.querySelectorAll('.aba').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.aba === ctx.abaAtiva);
    b.setAttribute('aria-selected', b.dataset.aba === ctx.abaAtiva);
  });
  const conteudo = document.getElementById('conteudo');
  conteudo.innerHTML = '';
  VIEWS[ctx.abaAtiva](conteudo, ctx);
}

// Selo com o nº de tarefas pendentes na aba Tarefas — o que falta, à vista.
function atualizarBadge() {
  const aba = document.querySelector('.aba[data-aba="tarefas"]');
  aba.querySelector('.badge-aba')?.remove();
  const pendentes = ctx.tarefas.filter((t) => t.status !== 'concluida').length;
  if (pendentes) {
    const selo = document.createElement('span');
    selo.className = 'badge-aba';
    selo.textContent = pendentes > 99 ? '99+' : pendentes;
    selo.setAttribute('aria-label', `${pendentes} tarefas pendentes`);
    aba.append(selo);
  }
}

async function recarregar(renderizar = true) {
  await carregarDados();
  atualizarSeletor();
  atualizarBadge();
  if (renderizar) renderAba();
}

async function selecionarEvento(id) {
  if (id) localStorage.setItem('eventoAtivo', id);
  else localStorage.removeItem('eventoAtivo');
  await recarregar();
}

// ---------- Tamanho do texto (A− / A+) ----------

const FONTE_MIN = 14, FONTE_MAX = 22, FONTE_PADRAO = 17;

function aplicarFonte() {
  const tam = Number(localStorage.getItem('tamanhoFonte')) || FONTE_PADRAO;
  document.documentElement.style.fontSize = `${tam}px`;
  document.getElementById('btn-fonte-menos').disabled = tam <= FONTE_MIN;
  document.getElementById('btn-fonte-mais').disabled = tam >= FONTE_MAX;
}

function mudarFonte(delta) {
  const atual = Number(localStorage.getItem('tamanhoFonte')) || FONTE_PADRAO;
  const novo = Math.max(FONTE_MIN, Math.min(FONTE_MAX, atual + delta));
  localStorage.setItem('tamanhoFonte', novo);
  aplicarFonte();
}

// ---------- Tema ----------

function aplicarTema() {
  const salvo = localStorage.getItem('tema');
  if (salvo) document.documentElement.dataset.tema = salvo;
  const escuro = salvo ? salvo === 'escuro' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.getElementById('btn-tema').textContent = escuro ? '☀️' : '🌙';
}

// ---------- Inicialização ----------

document.querySelectorAll('.aba').forEach((b) => {
  b.addEventListener('click', () => {
    ctx.abaAtiva = b.dataset.aba;
    localStorage.setItem('abaAtiva', ctx.abaAtiva);
    renderAba();
  });
});

document.getElementById('seletor-evento').addEventListener('change', (ev) => {
  if (ev.target.value === '__novo') {
    atualizarSeletor(); // volta a seleção para o evento atual
    abrirWizardEvento(ctx);
  } else {
    selecionarEvento(ev.target.value);
  }
});

document.getElementById('btn-tema').addEventListener('click', () => {
  const atual = document.documentElement.dataset.tema ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  localStorage.setItem('tema', atual === 'escuro' ? 'claro' : 'escuro');
  aplicarTema();
});

document.getElementById('btn-fonte-menos').addEventListener('click', () => mudarFonte(-1));
document.getElementById('btn-fonte-mais').addEventListener('click', () => mudarFonte(1));
document.getElementById('btn-ajuda').addEventListener('click', () => abrirAjuda(ctx));

aplicarFonte();
aplicarTema();
recarregar().then(() => {
  // Primeiro uso: tour guiado apresenta o fluxo em 5 passos.
  if (!localStorage.getItem('tourVisto')) setTimeout(iniciarTour, 500);
});
