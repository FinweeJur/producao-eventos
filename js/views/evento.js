// Aba Evento: wizard de criação com templates (tarefas desmarcáveis),
// detalhes completos do evento, edição, exclusão e exportação de documentos.

import { db, novoId } from '../db.js';
import { el, abrirModal, toast, confirmar, formatarMinutos, iconeCriticidade, meta } from '../ui.js';
import { TIPOS_EVENTO, TEMPLATES, tarefasDoTemplate } from '../templates.js';
import { exportarPDF, exportarWord, exportarExcel, exportarCSV, ROTULO_FORMATO, ROTULO_ACESSO } from '../relatorio.js';
import { cartaoProximoPasso } from '../ajuda.js';

// Evento de exemplo pronto: quem está começando aprende vendo o app preenchido.
async function criarExemplo(ctx) {
  const hoje = new Date();
  const daqui30 = new Date(hoje.getTime() + 30 * 864e5).toISOString().slice(0, 10);
  const evento = await db.salvar('eventos', {
    id: novoId(), nome: 'Seminário de Exemplo', tipo: 'seminario',
    dataInicio: daqui30, dataFim: daqui30, local: 'Centro Cultural (exemplo)',
    publicoEstimado: 120, formato: 'presencial', acesso: 'gratuito',
    descricao: 'Evento de demonstração — edite ou exclua à vontade.', criadoEm: Date.now(),
  });
  for (const t of tarefasDoTemplate('seminario', evento.id, novoId)) await db.salvar('tarefas', t);
  const exemplos = [
    { nome: 'Ana (exemplo)', papel: 'coordenador', aptidoes: ['produção'], contato: '', disponibilidade: 'disponivel' },
    { nome: 'Beto (exemplo)', papel: 'voluntario', aptidoes: ['design', 'redes sociais'], contato: '', disponibilidade: 'disponivel' },
    { nome: 'Carla (exemplo)', papel: 'voluntario', aptidoes: ['recepção'], contato: '', disponibilidade: 'parcial' },
  ];
  for (const p of exemplos) await db.salvar('pessoas', { id: novoId(), ...p });
  toast('Exemplo criado — explore e depois exclua quando quiser. 🎓', 'ok');
  await ctx.selecionarEvento(evento.id);
}

function seletor(opcoes, valorAtual) {
  return el('select', {}, opcoes.map(([v, r]) => {
    const o = el('option', { value: v }, r);
    if (valorAtual === v) o.selected = true;
    return o;
  }));
}

function formularioEvento(evento = {}, aoTrocarTipo = null) {
  let tipoSelecionado = evento.tipo || 'seminario';

  const campoNome = el('input', { type: 'text', value: evento.nome || '', placeholder: 'Ex: Seminário de Inovação' });
  const campoInicio = el('input', { type: 'date', value: evento.dataInicio || '' });
  const campoFim = el('input', { type: 'date', value: evento.dataFim || '' });
  const campoLocal = el('input', { type: 'text', value: evento.local || '', placeholder: 'Ex: Centro Cultural / link da sala' });
  const campoPublico = el('input', { type: 'number', min: 0, value: evento.publicoEstimado ?? '', placeholder: 'Ex: 200' });
  const campoFormato = seletor(Object.entries(ROTULO_FORMATO), evento.formato || 'presencial');
  const campoAcesso = seletor(Object.entries(ROTULO_ACESSO), evento.acesso || 'gratuito');
  const campoDesc = el('textarea', { placeholder: 'Descrição (opcional)' });
  campoDesc.value = evento.descricao || '';

  const opcoes = el('div', { class: 'opcoes-tipo' },
    TIPOS_EVENTO.map((t) => {
      const b = el('button', { class: 'opcao-tipo' + (t.id === tipoSelecionado ? ' ativa' : ''), type: 'button' }, t.nome);
      b.addEventListener('click', () => {
        tipoSelecionado = t.id;
        opcoes.querySelectorAll('.opcao-tipo').forEach((o) => o.classList.remove('ativa'));
        b.classList.add('ativa');
        if (aoTrocarTipo) aoTrocarTipo(t.id);
      });
      return b;
    })
  );

  const corpo = el('div', {},
    el('div', { class: 'campo' }, el('label', {}, 'Nome do evento'), campoNome),
    el('div', { class: 'campo' }, el('label', {}, 'Tipo'), opcoes),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Início'), campoInicio),
      el('div', { class: 'campo' }, el('label', {}, 'Fim'), campoFim),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'Local'), campoLocal),
    el('div', { class: 'campo-linha' },
      el('div', { class: 'campo' }, el('label', {}, 'Formato'), campoFormato),
      el('div', { class: 'campo' }, el('label', {}, 'Acesso'), campoAcesso),
      el('div', { class: 'campo' }, el('label', {}, 'Público estimado'), campoPublico),
    ),
    el('div', { class: 'campo' }, el('label', {}, 'Descrição'), campoDesc),
  );

  return {
    corpo,
    ler: () => ({
      nome: campoNome.value.trim(),
      tipo: tipoSelecionado,
      dataInicio: campoInicio.value,
      dataFim: campoFim.value,
      local: campoLocal.value.trim(),
      publicoEstimado: campoPublico.value ? Number(campoPublico.value) : null,
      formato: campoFormato.value,
      acesso: campoAcesso.value,
      descricao: campoDesc.value.trim(),
    }),
  };
}

// Checklist das tarefas do modelo: desmarque as que não fizerem sentido.
function checklistTemplate(tipo) {
  const caixa = el('div', { class: 'campo' });
  const desenhar = (t) => {
    caixa.innerHTML = '';
    const modelo = TEMPLATES[t] || [];
    if (!modelo.length) {
      caixa.append(el('p', { class: 'meta' }, 'Evento em branco — nenhuma tarefa pré-carregada.'));
      return;
    }
    caixa.append(el('label', {}, `Tarefas do modelo (desmarque as que não fizerem sentido)`));
    modelo.forEach((tarefa, i) => {
      const check = el('input', { type: 'checkbox', dataset: { indice: i } });
      check.checked = true;
      caixa.append(el('label', { class: 'meta', style: 'display:flex; align-items:center; gap:8px; padding:4px 0; font-weight:400; cursor:pointer' },
        check, iconeCriticidade(tarefa.criticidade),
        `${tarefa.titulo} (${tarefa.setor} · ${formatarMinutos(tarefa.tempoEstimadoMinutos)})`,
      ));
    });
  };
  desenhar(tipo);
  return {
    caixa,
    desenhar,
    indicesMarcados: () => [...caixa.querySelectorAll('input:checked')].map((c) => Number(c.dataset.indice)),
  };
}

export function abrirWizardEvento(ctx) {
  const checklist = checklistTemplate('seminario');
  const form = formularioEvento({}, (tipo) => checklist.desenhar(tipo));
  form.corpo.append(checklist.caixa);

  abrirModal('Novo evento', form.corpo, [
    { rotulo: 'Criar evento', onClick: async (fechar) => {
      const dados = form.ler();
      if (!dados.nome) { toast('Dê um nome ao evento.', 'erro'); return; }
      const evento = await db.salvar('eventos', { ...dados, id: novoId(), criadoEm: Date.now() });
      const marcadas = new Set(checklist.indicesMarcados());
      const todas = tarefasDoTemplate(dados.tipo, evento.id, novoId);
      for (let i = 0; i < todas.length; i++) {
        if (marcadas.has(i)) await db.salvar('tarefas', todas[i]);
      }
      fechar();
      toast('Evento criado! 🎉', 'ok');
      await ctx.selecionarEvento(evento.id);
    } },
  ]);
}

function abrirExportacao(ctx) {
  const { evento, tarefas, pessoas } = ctx;
  const opcoes = [
    ['🖨 PDF', 'Documento completo — abre a impressão do navegador (Salvar como PDF)', () => {
      if (!exportarPDF(evento, tarefas, pessoas)) toast('Libere pop-ups para gerar o PDF.', 'erro');
    }],
    ['📝 Word (.doc)', 'Documento completo editável no Word/LibreOffice/Google Docs', () => exportarWord(evento, tarefas, pessoas)],
    ['📊 Excel (.xls)', 'Documento completo em tabelas para Excel/LibreOffice/Sheets', () => exportarExcel(evento, tarefas, pessoas)],
    ['📄 CSV', 'Só a lista de tarefas, em formato universal', () => exportarCSV(evento, tarefas, pessoas)],
  ];
  abrirModal('Exportar documento do evento', el('div', {},
    opcoes.map(([rotulo, desc, acao]) => el('div', { class: 'sugestao' },
      el('div', { class: 'info' }, el('strong', {}, rotulo), el('div', { class: 'motivo' }, desc)),
      el('button', { class: 'btn btn-suave', onclick: () => { acao(); toast('Documento gerado.', 'ok'); } }, 'Gerar'),
    ))
  ));
}

export async function renderEvento(container, ctx) {
  const { evento, tarefas, pessoas } = ctx;

  if (!evento) {
    container.append(
      el('div', { class: 'vazio' },
        el('span', { class: 'emoji' }, '🎪'),
        el('p', {}, 'Crie seu primeiro evento a partir de um modelo pronto — Seminário, Show ou Manifestação — e ganhe uma lista de tarefas típicas para adaptar.'),
        el('div', { class: 'acoes-tarefa', style: 'justify-content: center' },
          el('button', { class: 'btn', onclick: () => abrirWizardEvento(ctx) }, '+ Criar evento'),
          el('button', { class: 'btn btn-suave', onclick: () => criarExemplo(ctx) }, '🎓 Começar com um exemplo'),
        ),
      )
    );
    return;
  }

  const pendentes = tarefas.filter((t) => t.status !== 'concluida');
  const tempoRestante = pendentes.reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0);
  const pct = tarefas.length ? Math.round(((tarefas.length - pendentes.length) / tarefas.length) * 100) : 0;
  const criticasSemDono = pendentes.filter((t) => t.criticidade >= 4 && !t.atribuidaA);
  const tipoNome = (TIPOS_EVENTO.find((t) => t.id === evento.tipo) || {}).nome || evento.tipo;

  const passo = cartaoProximoPasso(ctx);
  if (passo) container.append(passo);

  container.append(
    el('div', { class: 'card' },
      el('h3', {}, evento.nome),
      meta(
        tipoNome,
        evento.dataInicio ? `📅 ${evento.dataInicio}${evento.dataFim && evento.dataFim !== evento.dataInicio ? ' → ' + evento.dataFim : ''}` : null,
        evento.local ? `📍 ${evento.local}` : null,
      ),
      meta(
        evento.formato ? `🎦 ${ROTULO_FORMATO[evento.formato]}` : null,
        evento.acesso ? `🎟 ${ROTULO_ACESSO[evento.acesso]}` : null,
        evento.publicoEstimado ? `👤 ~${evento.publicoEstimado} pessoas` : null,
      ),
      evento.descricao ? el('p', {}, evento.descricao) : null,
      el('div', { class: 'progresso', title: `${pct}% concluído` }, el('div', { style: `width:${pct}%` })),
      meta(
        `${tarefas.length - pendentes.length}/${tarefas.length} tarefas concluídas`,
        `⏱ faltam ~${formatarMinutos(tempoRestante)}`,
        `👥 ${pessoas.length} na equipe`,
      ),
      criticasSemDono.length
        ? el('p', { class: 'conflito' }, `⚠️ ${criticasSemDono.length} tarefa(s) crítica(s) sem responsável — use “Distribuir tarefas” na aba Tarefas.`)
        : null,
      el('div', { class: 'acoes-tarefa' },
        el('button', { class: 'btn btn-suave', onclick: () => {
          const form = formularioEvento(evento);
          abrirModal('Editar evento', form.corpo, [
            { rotulo: 'Salvar', onClick: async (fechar) => {
              const dados = form.ler();
              if (!dados.nome) { toast('Dê um nome ao evento.', 'erro'); return; }
              await db.salvar('eventos', { ...evento, ...dados });
              fechar();
              ctx.recarregar();
            } },
          ]);
        } }, '✏️ Editar'),
        el('button', { class: 'btn btn-suave', onclick: () => abrirExportacao(ctx) }, '📄 Exportar'),
        el('button', { class: 'btn btn-perigo', onclick: async () => {
          if (!await confirmar(`Excluir “${evento.nome}” e todas as suas tarefas? Essa ação não pode ser desfeita.`)) return;
          await db.removerTarefasDoEvento(evento.id);
          await db.remover('eventos', evento.id);
          toast('Evento excluído.');
          await ctx.selecionarEvento(null);
        } }, '🗑 Excluir'),
      ),
    ),
    el('button', { class: 'btn btn-bloco', onclick: () => abrirWizardEvento(ctx) }, '+ Novo evento'),
    el('p', { class: 'chat-status' }, '🔒 Seus dados ficam somente neste dispositivo (IndexedDB). Sem conta, sem rastreadores.'),
  );
}
