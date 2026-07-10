// Aba Equipe: cadastro de pessoas com papel, aptidões (tags) e disponibilidade.

import { db, novoId } from '../db.js';
import { el, abrirModal, toast, confirmar, avatar, formatarMinutos, ROTULO_PAPEL, meta } from '../ui.js';
import { cargaPorPessoa } from '../distribuir.js';

function formularioPessoa(pessoa = {}) {
  const campoNome = el('input', { type: 'text', value: pessoa.nome || '', placeholder: 'Nome' });
  const campoPapel = el('select', {},
    Object.entries(ROTULO_PAPEL).map(([v, r]) => {
      const o = el('option', { value: v }, r);
      if ((pessoa.papel || 'voluntario') === v) o.selected = true;
      return o;
    })
  );
  const campoAptidoes = el('input', {
    type: 'text', value: (pessoa.aptidoes || []).join(', '),
    placeholder: 'Ex: design, som, redes sociais',
  });
  const campoContato = el('input', { type: 'text', value: pessoa.contato || '', placeholder: 'Telefone / e-mail (opcional)' });
  const campoDisp = el('select', {},
    [['disponivel', 'Disponível'], ['parcial', 'Parcialmente disponível'], ['indisponivel', 'Indisponível']].map(([v, r]) => {
      const o = el('option', { value: v }, r);
      if ((pessoa.disponibilidade || 'disponivel') === v) o.selected = true;
      return o;
    })
  );

  const corpo = el('div', {},
    el('div', { class: 'campo' }, el('label', {}, 'Nome'), campoNome),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Papel'), campoPapel),
      el('div', { class: 'campo' }, el('label', {}, 'Disponibilidade'), campoDisp),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'Aptidões (separadas por vírgula)'), campoAptidoes),
    el('div', { class: 'campo' }, el('label', {}, 'Contato'), campoContato),
  );

  return {
    corpo,
    ler: () => ({
      nome: campoNome.value.trim(),
      papel: campoPapel.value,
      aptidoes: campoAptidoes.value.split(',').map((a) => a.trim()).filter(Boolean),
      contato: campoContato.value.trim(),
      disponibilidade: campoDisp.value,
    }),
  };
}

export function abrirFormPessoa(ctx, pessoa = null) {
  const form = formularioPessoa(pessoa || {});
  abrirModal(pessoa ? 'Editar pessoa' : 'Nova pessoa', form.corpo, [
    { rotulo: pessoa ? 'Salvar' : 'Adicionar', onClick: async (fechar) => {
      const dados = form.ler();
      if (!dados.nome) { toast('Informe o nome.', 'erro'); return; }
      await db.salvar('pessoas', { id: pessoa ? pessoa.id : novoId(), ...dados });
      fechar();
      toast(pessoa ? 'Pessoa atualizada.' : 'Pessoa adicionada.', 'ok');
      ctx.recarregar();
    } },
  ]);
}

function verTarefasDaPessoa(ctx, pessoa) {
  const minhas = ctx.tarefas.filter((t) => t.atribuidaA === pessoa.id);
  const corpo = el('div', {},
    minhas.length
      ? minhas.map((t) => el('div', { class: 'sugestao' },
          el('div', { class: 'info' },
            el('strong', { style: t.status === 'concluida' ? 'text-decoration: line-through' : '' }, t.titulo),
            el('div', { class: 'motivo' }, `${t.setor} · criticidade ${t.criticidade} · ${formatarMinutos(t.tempoEstimadoMinutos)}`),
          ),
        ))
      : el('p', { class: 'meta' }, 'Nenhuma tarefa atribuída ainda.'),
  );
  abrirModal(`Tarefas de ${pessoa.nome}`, corpo);
}

export function renderEquipe(container, ctx) {
  const { pessoas, tarefas } = ctx;
  const carga = cargaPorPessoa(tarefas);
  const corPapel = { coordenador: '#7c3aed', voluntario: '#059669', terceirizado: '#d97706' };

  container.append(el('button', { class: 'btn', style: 'margin-bottom: 12px', onclick: () => abrirFormPessoa(ctx) }, '+ Pessoa'));

  if (!pessoas.length) {
    container.append(el('div', { class: 'vazio' },
      el('span', { class: 'emoji' }, '👥'),
      el('p', {}, 'Cadastre a equipe para poder delegar tarefas e usar a distribuição inteligente.'),
    ));
    return;
  }

  const ordenadas = [...pessoas].sort((a, b) =>
    (a.papel === 'coordenador' ? 0 : a.papel === 'voluntario' ? 1 : 2) -
    (b.papel === 'coordenador' ? 0 : b.papel === 'voluntario' ? 1 : 2) ||
    a.nome.localeCompare(b.nome));

  for (const p of ordenadas) {
    const minhas = tarefas.filter((t) => t.atribuidaA === p.id && t.status !== 'concluida');
    container.append(el('div', { class: 'card' },
      el('div', { class: 'linha-tarefa' },
        avatar(p),
        el('div', { class: 'info' },
          el('h3', {}, p.nome, ' ',
            el('span', { class: 'pilula-papel', style: `background:${corPapel[p.papel]}` }, ROTULO_PAPEL[p.papel]),
          ),
          meta(
            p.disponibilidade === 'indisponivel' ? '🚫 indisponível' : p.disponibilidade === 'parcial' ? '🕗 parcial' : '🟢 disponível',
            `${minhas.length} tarefa(s) pendente(s)`,
            `carga ${formatarMinutos(carga.get(p.id) || 0)}`,
          ),
          (p.aptidoes || []).length ? el('div', { class: 'meta' }, '🏷 ' + p.aptidoes.join(' · ')) : null,
          p.contato ? el('div', { class: 'meta' }, '📞 ' + p.contato) : null,
        ),
      ),
      el('div', { class: 'acoes-tarefa' },
        el('button', { class: 'btn btn-suave', onclick: () => verTarefasDaPessoa(ctx, p) }, '📋 Ver tarefas'),
        el('button', { class: 'btn-icone', title: 'Editar', 'aria-label': `Editar ${p.nome}`, onclick: () => abrirFormPessoa(ctx, p) }, '✏️'),
        el('button', { class: 'btn-icone', title: 'Remover', 'aria-label': `Remover ${p.nome}`, onclick: async () => {
          if (!await confirmar(`Remover ${p.nome} da equipe? As tarefas atribuídas ficarão sem responsável.`)) return;
          for (const t of tarefas.filter((x) => x.atribuidaA === p.id)) {
            await db.salvar('tarefas', { ...t, atribuidaA: null });
          }
          await db.remover('pessoas', p.id);
          ctx.recarregar();
        } }, '🗑'),
      ),
    ));
  }
}
