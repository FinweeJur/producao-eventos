// Ajudas de bordo para quem está começando: tour guiado com holofote,
// cartão de "próximo passo" e central de ajuda com a legenda do app.

import { el, abrirModal, iconeCriticidade, ROTULO_PAPEL } from './ui.js';

const PASSOS = [
  { alvo: '.aba[data-aba="evento"]', titulo: 'Crie o evento', texto: 'Escolha um modelo pronto (Seminário, Show, Manifestação) e ele já vem com as tarefas típicas — é só desmarcar o que não servir.' },
  { alvo: '.aba[data-aba="equipe"]', titulo: 'Cadastre a equipe', texto: 'Diga quem é coordenador, voluntário ou terceirizado e o que cada pessoa sabe fazer.' },
  { alvo: '.aba[data-aba="tarefas"]', titulo: 'Distribua as tarefas', texto: 'O botão 🪄 sugere quem cuida do quê: tarefas críticas vão para a coordenação, as leves para quem tem aptidão. Você só confirma.' },
  { alvo: '.aba[data-aba="chat"]', titulo: 'Converse com o app', texto: 'Escreva em português: “adicionar tarefa…”, “o que está sem responsável?”, “me dê um resumo”.' },
  { alvo: '.controles-header', titulo: 'Do seu jeito', texto: 'Aqui em cima: texto maior ou menor (A− / A+), tema claro/escuro e esta ajuda, sempre que precisar.' },
];

export function iniciarTour() {
  document.querySelector('.tour-fundo')?.remove();
  let i = 0;
  const foco = el('div', { class: 'tour-foco' });
  const cartao = el('div', { class: 'tour-cartao', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tour guiado' });
  const raiz = el('div', { class: 'tour-fundo' }, foco, cartao);
  document.body.append(raiz);

  const terminar = () => { localStorage.setItem('tourVisto', '1'); raiz.remove(); };

  const mostrar = () => {
    const passo = PASSOS[i];
    const alvo = document.querySelector(passo.alvo);
    if (!alvo) { terminar(); return; }
    const r = alvo.getBoundingClientRect();
    Object.assign(foco.style, {
      left: `${r.left - 6}px`, top: `${r.top - 6}px`,
      width: `${r.width + 12}px`, height: `${r.height + 12}px`,
    });

    cartao.innerHTML = '';
    cartao.append(
      el('div', { class: 'tour-passo' }, `Passo ${i + 1} de ${PASSOS.length}`),
      el('h2', {}, passo.titulo),
      el('p', {}, passo.texto),
      el('div', { class: 'modal-acoes', style: 'padding: 0' },
        el('button', { class: 'btn btn-suave', onclick: terminar }, 'Pular'),
        el('button', { class: 'btn', onclick: () => { i++; i < PASSOS.length ? mostrar() : terminar(); } },
          i < PASSOS.length - 1 ? 'Próximo →' : 'Entendi!'),
      ),
    );
    // Cartão acima do alvo quando ele está na metade de baixo da tela.
    const acima = r.top > innerHeight / 2;
    cartao.style.top = acima ? '' : `${r.bottom + 14}px`;
    cartao.style.bottom = acima ? `${innerHeight - r.top + 14}px` : '';
    const larguraCartao = Math.min(innerWidth * 0.92, 340);
    cartao.style.left = `${Math.max(12, Math.min(r.left, innerWidth - larguraCartao - 12))}px`;
    cartao.querySelector('.btn').focus();
  };
  mostrar();
}

// A única próxima ação que faz o evento andar — para não deixar o usuário perdido.
export function proximoPasso(ctx) {
  const { evento, tarefas, pessoas } = ctx;
  if (!evento) return null;
  const pendentes = tarefas.filter((t) => t.status !== 'concluida');
  if (!tarefas.length) {
    return { texto: 'O evento ainda não tem tarefas. Adicione a primeira — ou peça no Chat, escrevendo em português.', rotulo: '+ Adicionar tarefas', aba: 'tarefas' };
  }
  if (!pessoas.length) {
    return { texto: 'Cadastre quem trabalha com você. Com a equipe no app, ele passa a sugerir quem cuida de cada tarefa.', rotulo: '👥 Cadastrar equipe', aba: 'equipe' };
  }
  const semDono = pendentes.filter((t) => !t.atribuidaA);
  if (semDono.length) {
    return { texto: `${semDono.length} tarefa(s) ainda sem responsável. Toque em 🪄 Distribuir e o app sugere quem cuida do quê.`, rotulo: '🪄 Distribuir tarefas', aba: 'tarefas' };
  }
  return null;
}

export function cartaoProximoPasso(ctx) {
  const passo = proximoPasso(ctx);
  if (!passo) return null;
  return el('div', { class: 'card cartao-passo' },
    el('strong', {}, '👉 Próximo passo'),
    el('p', {}, passo.texto),
    el('button', { class: 'btn', onclick: () => ctx.irParaAba(passo.aba) }, passo.rotulo),
  );
}

export function abrirAjuda(ctx) {
  const corPapel = { coordenador: '#7c3aed', voluntario: '#059669', terceirizado: '#d97706' };
  abrirModal('Como o app funciona', el('div', {},
    el('p', {}, 'O fluxo tem 4 passos: criar o evento → cadastrar a equipe → distribuir as tarefas → acompanhar (pelo kanban ou pelo Chat).'),

    el('h2', { class: 'titulo-ajuda' }, 'Os cadeados (criticidade)'),
    el('div', { class: 'legenda' },
      el('span', {}, iconeCriticidade(5), ' Crítica: trava outras tarefas — vai para a coordenação'),
      el('span', {}, iconeCriticidade(3), ' Média: importante, sem travar ninguém'),
      el('span', {}, iconeCriticidade(1), ' Leve: operacional — ótima para delegar'),
    ),

    el('h2', { class: 'titulo-ajuda' }, 'As cores da equipe'),
    el('div', { class: 'legenda' },
      Object.entries(ROTULO_PAPEL).map(([papel, rotulo]) =>
        el('span', {}, el('span', { class: 'pilula-papel', style: `background:${corPapel[papel]}` }, rotulo),
          papel === 'coordenador' ? ' recebe as tarefas críticas' : papel === 'voluntario' ? ' recebe as leves e as da sua aptidão' : ' entra pelas aptidões')),
    ),

    el('h2', { class: 'titulo-ajuda' }, 'Frases que o Chat entende'),
    el('div', { class: 'legenda' },
      ['“Adicionar tarefa: contratar segurança, criticidade 5, setor infraestrutura, 3 horas”',
       '“Quais tarefas estão sem responsável?”',
       '“Sugira quem pode cuidar da divulgação”',
       '“Me dê um resumo do evento”'].map((f) => el('span', {}, f)),
    ),

    el('p', { class: 'meta' }, '🔒 Tudo fica só no seu aparelho. Você pode instalar o app pela opção “Adicionar à tela inicial” do navegador.'),
  ), [
    { rotulo: '🔦 Rever o tour guiado', classe: 'btn btn-suave', onClick: (fechar) => { fechar(); iniciarTour(); } },
    { rotulo: 'Fechar', onClick: (fechar) => fechar() },
  ]);
}
