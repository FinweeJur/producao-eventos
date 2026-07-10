// Aba Tarefas: kanban por setor, lista por pessoa, CRUD com subtarefas,
// dependências, criticidade e distribuição inteligente.

import { db, novoId } from '../db.js';
import { el, abrirModal, toast, confirmar, confete, avatar, iconeCriticidade, formatarMinutos, meta } from '../ui.js';
import { distribuirTarefas, tarefaBloqueada, cargaPorPessoa } from '../distribuir.js';

const estado = { filtroSetor: 'todos', visao: 'setor' };

// ---------- Formulário de tarefa ----------

function formularioTarefa(ctx, tarefa = {}) {
  const { tarefas, pessoas } = ctx;
  const campoTitulo = el('input', { type: 'text', value: tarefa.titulo || '', placeholder: 'Ex: Contratar segurança' });
  const setores = [...new Set(tarefas.map((t) => t.setor).filter(Boolean))];
  const campoSetor = el('input', { type: 'text', value: tarefa.setor || '', placeholder: 'Ex: Infraestrutura', list: 'lista-setores' });
  const dataList = el('datalist', { id: 'lista-setores' }, setores.map((s) => el('option', { value: s })));

  const campoCrit = el('select', {},
    [1, 2, 3, 4, 5].map((n) => {
      const o = el('option', { value: n }, `${n} — ${n >= 4 ? 'crítica (bloqueante)' : n === 3 ? 'média' : 'leve'}`);
      if ((tarefa.criticidade || 3) === n) o.selected = true;
      return o;
    })
  );
  const campoTempo = el('input', { type: 'number', min: 0, step: 5, value: tarefa.tempoEstimadoMinutos ?? 60 });
  const campoResultado = el('input', { type: 'text', value: tarefa.resultadoEsperado || '', placeholder: 'Como saber que ficou pronta?' });
  const campoDesc = el('textarea', { placeholder: 'Detalhes (opcional)' });
  campoDesc.value = tarefa.descricao || '';

  const campoResp = el('select', {},
    el('option', { value: '' }, '— Sem responsável —'),
    pessoas.map((p) => {
      const o = el('option', { value: p.id }, p.nome);
      if (tarefa.atribuidaA === p.id) o.selected = true;
      return o;
    })
  );

  const outras = tarefas.filter((t) => t.id !== tarefa.id && !t.parentId);
  const campoDeps = el('select', { multiple: true, size: Math.min(outras.length, 4) || 1 },
    outras.map((t) => {
      const o = el('option', { value: t.id }, t.titulo);
      if ((tarefa.dependeDe || []).includes(t.id)) o.selected = true;
      return o;
    })
  );

  const campoPai = el('select', {},
    el('option', { value: '' }, '— Nenhuma (tarefa principal) —'),
    outras.map((t) => {
      const o = el('option', { value: t.id }, t.titulo);
      if (tarefa.parentId === t.id) o.selected = true;
      return o;
    })
  );

  const corpo = el('div', {},
    dataList,
    el('div', { class: 'campo' }, el('label', {}, 'Título'), campoTitulo),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Setor'), campoSetor),
      el('div', { class: 'campo' }, el('label', {}, 'Criticidade'), campoCrit),
    ),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Tempo estimado (min)'), campoTempo),
      el('div', { class: 'campo' }, el('label', {}, 'Responsável'), campoResp),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'Resultado esperado'), campoResultado),
    el('div', { class: 'campo' }, el('label', {}, 'Descrição'), campoDesc),
    el('div', { class: 'campo' }, el('label', {}, 'Depende de (segure Ctrl para várias)'), campoDeps),
    el('div', { class: 'campo' }, el('label', {}, 'Subtarefa de'), campoPai),
  );

  return {
    corpo,
    ler: () => ({
      titulo: campoTitulo.value.trim(),
      setor: campoSetor.value.trim() || 'Geral',
      criticidade: Number(campoCrit.value),
      tempoEstimadoMinutos: Number(campoTempo.value) || 0,
      resultadoEsperado: campoResultado.value.trim(),
      descricao: campoDesc.value.trim(),
      atribuidaA: campoResp.value || null,
      dependeDe: [...campoDeps.selectedOptions].map((o) => o.value),
      parentId: campoPai.value || null,
    }),
  };
}

export function abrirFormTarefa(ctx, tarefa = null) {
  const form = formularioTarefa(ctx, tarefa || {});
  abrirModal(tarefa ? 'Editar tarefa' : 'Nova tarefa', form.corpo, [
    { rotulo: tarefa ? 'Salvar' : 'Adicionar', onClick: async (fechar) => {
      const dados = form.ler();
      if (!dados.titulo) { toast('Dê um título à tarefa.', 'erro'); return; }
      await db.salvar('tarefas', {
        id: tarefa ? tarefa.id : novoId(),
        eventoId: ctx.evento.id,
        status: tarefa ? tarefa.status : 'pendente',
        criadoEm: tarefa ? tarefa.criadoEm : Date.now(),
        ...dados,
      });
      fechar();
      toast(tarefa ? 'Tarefa atualizada.' : 'Tarefa adicionada.', 'ok');
      ctx.recarregar();
    } },
  ]);
}

// ---------- Ações sobre a tarefa ----------

async function mudarStatus(ctx, tarefa, status) {
  await db.salvar('tarefas', { ...tarefa, status });
  if (status === 'concluida') {
    const desbloqueadas = ctx.tarefas.filter((t) => (t.dependeDe || []).includes(tarefa.id));
    if (desbloqueadas.length) {
      confete();
      toast(`🎉 ${desbloqueadas.length} tarefa(s) desbloqueada(s)!`, 'ok');
    }
  }
  ctx.recarregar();
}

function abrirDelegar(ctx, tarefa) {
  const { pessoas, tarefas } = ctx;
  if (!pessoas.length) { toast('Cadastre a equipe primeiro, na aba Equipe.', 'erro'); return; }
  const carga = cargaPorPessoa(tarefas);
  const lista = el('div', {},
    pessoas.map((p) => el('div', { class: 'sugestao' },
      avatar(p),
      el('div', { class: 'info' },
        el('strong', {}, p.nome),
        el('div', { class: 'motivo' }, `${p.papel} · carga ${formatarMinutos(carga.get(p.id) || 0)}`),
      ),
      el('button', { class: 'btn btn-suave', onclick: async () => {
        await db.salvar('tarefas', { ...tarefa, atribuidaA: p.id });
        document.getElementById('modal-raiz').innerHTML = '';
        toast(`Delegada para ${p.nome}.`, 'ok');
        ctx.recarregar();
      } }, 'Delegar'),
    ))
  );
  abrirModal(`Delegar: ${tarefa.titulo}`, lista);
}

// ---------- Distribuição inteligente ----------

export function abrirDistribuicao(ctx) {
  const { tarefas, pessoas } = ctx;
  if (!pessoas.length) { toast('Cadastre a equipe primeiro, na aba Equipe.', 'erro'); return; }
  const { sugestoes, conflitos } = distribuirTarefas(tarefas, pessoas);
  if (!sugestoes.length && !conflitos.length) {
    toast('Todas as tarefas pendentes já têm responsável. 👌', 'ok');
    return;
  }

  const corpo = el('div', {},
    conflitos.map((c) => el('p', { class: 'conflito' }, `⚠️ “${c.tarefa.titulo}”: ${c.motivo}`)),
    sugestoes.map((s) => {
      const linha = el('div', { class: 'sugestao' },
        iconeCriticidade(s.tarefa.criticidade),
        el('div', { class: 'info' },
          el('strong', {}, s.tarefa.titulo),
          el('div', { class: 'motivo' }, `→ ${s.pessoa.nome} (${s.motivo})`),
        ),
        el('button', { class: 'btn btn-suave', onclick: async (ev) => {
          await db.salvar('tarefas', { ...s.tarefa, atribuidaA: s.pessoa.id });
          ev.target.textContent = '✓';
          ev.target.disabled = true;
        } }, 'Aceitar'),
      );
      return linha;
    }),
  );

  abrirModal('Sugestões de distribuição', corpo, sugestoes.length ? [
    { rotulo: 'Aceitar todas', onClick: async (fechar) => {
      for (const s of sugestoes) {
        await db.salvar('tarefas', { ...s.tarefa, atribuidaA: s.pessoa.id });
      }
      fechar();
      toast(`${sugestoes.length} tarefa(s) atribuída(s). ✅`, 'ok');
      ctx.recarregar();
    } },
  ] : []);
  // Recarrega a visão quando o modal fechar por aceitações individuais.
  const observador = new MutationObserver(() => {
    if (!document.querySelector('.modal-fundo')) { observador.disconnect(); ctx.recarregar(); }
  });
  observador.observe(document.getElementById('modal-raiz'), { childList: true });
}

// ---------- Card de tarefa ----------

function cardTarefa(ctx, tarefa) {
  const { tarefas, pessoas } = ctx;
  const responsavel = pessoas.find((p) => p.id === tarefa.atribuidaA);
  const bloqueada = tarefa.status !== 'concluida' && tarefaBloqueada(tarefa, tarefas);
  const subtarefas = tarefas.filter((t) => t.parentId === tarefa.id);
  const subPendentes = subtarefas.filter((t) => t.status !== 'concluida');

  const classes = ['card', 'card-tarefa'];
  if (tarefa.status === 'concluida') classes.push('concluida');
  if (bloqueada) classes.push('bloqueada');

  const acoes = el('div', { class: 'acoes-tarefa' });
  if (tarefa.status === 'pendente') {
    acoes.append(el('button', { class: 'btn btn-suave', onclick: () => mudarStatus(ctx, tarefa, 'em_andamento') }, '▶ Iniciar'));
  }
  if (tarefa.status !== 'concluida') {
    acoes.append(
      el('button', { class: 'btn btn-suave', onclick: () => mudarStatus(ctx, tarefa, 'concluida') }, '✓ Concluir'),
      el('button', { class: 'btn btn-suave', onclick: () => abrirDelegar(ctx, tarefa) }, '👤 Delegar'),
    );
  } else {
    acoes.append(el('button', { class: 'btn btn-suave', onclick: () => mudarStatus(ctx, tarefa, 'pendente') }, '↩ Reabrir'));
  }
  acoes.append(
    el('button', { class: 'btn-icone', title: 'Editar', 'aria-label': 'Editar tarefa', onclick: () => abrirFormTarefa(ctx, tarefa) }, '✏️'),
    el('button', { class: 'btn-icone', title: 'Excluir', 'aria-label': 'Excluir tarefa', onclick: async () => {
      if (!await confirmar(`Excluir a tarefa “${tarefa.titulo}”?`)) return;
      for (const s of subtarefas) await db.remover('tarefas', s.id);
      await db.remover('tarefas', tarefa.id);
      ctx.recarregar();
    } }, '🗑'),
  );

  return el('div', { class: classes.join(' ') },
    el('div', { class: 'linha-tarefa' },
      iconeCriticidade(tarefa.criticidade),
      el('div', { class: 'info' },
        el('h3', { title: tarefa.resultadoEsperado ? `Resultado esperado: ${tarefa.resultadoEsperado}` : '' }, tarefa.titulo),
        meta(
          `⏱ ${formatarMinutos(tarefa.tempoEstimadoMinutos)}`,
          tarefa.status === 'em_andamento' ? '🔄 em andamento' : null,
          subtarefas.length ? `☑ ${subtarefas.length - subPendentes.length}/${subtarefas.length} subtarefas` : null,
          bloqueada ? el('span', { class: 'etiqueta-bloqueada' }, '⛔ bloqueada por dependência') : null,
        ),
        tarefa.resultadoEsperado ? el('div', { class: 'meta' }, `🎯 ${tarefa.resultadoEsperado}`) : null,
      ),
      avatar(responsavel),
    ),
    subtarefas.length ? el('div', { class: 'subtarefas' },
      subtarefas.map((s) => el('div', { class: 'meta' },
        el('button', {
          class: 'btn-icone', title: s.status === 'concluida' ? 'Reabrir' : 'Concluir',
          onclick: () => mudarStatus(ctx, s, s.status === 'concluida' ? 'pendente' : 'concluida'),
        }, s.status === 'concluida' ? '☑' : '☐'),
        el('span', { style: s.status === 'concluida' ? 'text-decoration: line-through' : '' }, s.titulo),
      ))
    ) : null,
    acoes,
  );
}

// ---------- Render principal ----------

export function renderTarefas(container, ctx) {
  const { evento, tarefas, pessoas } = ctx;

  if (!evento) {
    container.append(el('div', { class: 'vazio' },
      el('span', { class: 'emoji' }, '📋'),
      el('p', {}, 'Crie um evento primeiro, na aba Evento.'),
    ));
    return;
  }

  const principais = tarefas.filter((t) => !t.parentId);
  const setores = [...new Set(principais.map((t) => t.setor))].sort();

  // Pulso de convite quando há tarefa sem dono e equipe cadastrada.
  const temSemDono = tarefas.some((t) => !t.atribuidaA && t.status !== 'concluida');

  // Barra de ações
  container.append(el('div', { class: 'acoes-tarefa', style: 'margin-bottom: 12px' },
    el('button', { class: 'btn', onclick: () => abrirFormTarefa(ctx) }, '+ Tarefa'),
    el('button', { class: 'btn btn-suave' + (pessoas.length && temSemDono ? ' pulsar' : ''), onclick: () => abrirDistribuicao(ctx) }, '🪄 Distribuir tarefas'),
    el('select', {
      class: 'seletor-evento', style: 'flex:0 1 auto', 'aria-label': 'Modo de visualização',
      onchange: (ev) => { estado.visao = ev.target.value; ctx.recarregar(); },
    },
      [['setor', 'Por setor'], ['pessoa', 'Por pessoa'], ['lista', 'Lista (criticidade)']].map(([v, r]) => {
        const o = el('option', { value: v }, r);
        if (estado.visao === v) o.selected = true;
        return o;
      })
    ),
  ));

  if (!principais.length) {
    container.append(el('div', { class: 'vazio' },
      el('span', { class: 'emoji' }, '🌱'),
      el('p', {}, 'Nenhuma tarefa ainda. Adicione a primeira ou peça ajuda no Chat.'),
    ));
    return;
  }

  // Filtro por setor (chips)
  if (estado.visao === 'setor' && setores.length > 1) {
    container.append(el('div', { class: 'chips' },
      ['todos', ...setores].map((s) => el('button', {
        class: 'chip' + (estado.filtroSetor === s ? ' ativa' : ''),
        onclick: () => { estado.filtroSetor = s; ctx.recarregar(); },
      }, s === 'todos' ? 'Todos' : s))
    ));
  }

  const ordenar = (lista) => [...lista].sort((a, b) =>
    (a.status === 'concluida') - (b.status === 'concluida') || b.criticidade - a.criticidade);

  if (estado.visao === 'setor') {
    const visiveis = estado.filtroSetor === 'todos' ? setores : setores.filter((s) => s === estado.filtroSetor);
    container.append(el('div', { class: 'kanban' },
      visiveis.map((setor) => {
        const doSetor = ordenar(principais.filter((t) => t.setor === setor));
        const pendentesMin = doSetor.filter((t) => t.status !== 'concluida').reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0);
        const totalMin = doSetor.reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0);
        const pct = totalMin ? Math.round(((totalMin - pendentesMin) / totalMin) * 100) : 100;
        return el('div', { class: 'coluna-setor' },
          el('h2', {}, setor, el('span', { class: 'soma' }, `faltam ${formatarMinutos(pendentesMin)}`)),
          el('div', { class: 'progresso' }, el('div', { style: `width:${pct}%` })),
          doSetor.map((t) => cardTarefa(ctx, t)),
        );
      })
    ));
  } else if (estado.visao === 'pessoa') {
    const grupos = [
      ...pessoas.map((p) => ({ chave: p.id, titulo: p.nome, pessoa: p })),
      { chave: null, titulo: 'Sem responsável', pessoa: null },
    ];
    container.append(el('div', { class: 'kanban' },
      grupos.map((g) => {
        const daPessoa = ordenar(principais.filter((t) => (t.atribuidaA || null) === g.chave));
        if (!daPessoa.length && g.chave !== null) return null;
        const cargaMin = daPessoa.filter((t) => t.status !== 'concluida').reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0);
        return el('div', { class: 'coluna-setor' },
          el('h2', {}, g.titulo, el('span', { class: 'soma' }, `carga ${formatarMinutos(cargaMin)}`)),
          daPessoa.length ? daPessoa.map((t) => cardTarefa(ctx, t)) : el('p', { class: 'meta' }, 'Nada pendente. 🎉'),
        );
      })
    ));
  } else {
    container.append(ordenar(principais).map((t) => cardTarefa(ctx, t)));
  }
}
