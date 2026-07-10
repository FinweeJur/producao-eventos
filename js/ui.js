// Helpers de interface: criação de elementos, modal, toast e confete.

export function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined) continue;
    e.append(f.nodeType ? f : document.createTextNode(f));
  }
  return e;
}

export function toast(msg, tipo = 'info') {
  const raiz = document.getElementById('toast-raiz');
  const t = el('div', { class: `toast toast-${tipo}`, role: 'status' }, msg);
  raiz.append(t);
  setTimeout(() => t.classList.add('visivel'), 10);
  setTimeout(() => { t.classList.remove('visivel'); setTimeout(() => t.remove(), 300); }, 3500);
}

export function abrirModal(titulo, corpo, acoes = []) {
  const raiz = document.getElementById('modal-raiz');
  raiz.innerHTML = '';
  const fechar = () => { raiz.innerHTML = ''; };
  const caixa = el('div', { class: 'modal-caixa', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    el('div', { class: 'modal-cabecalho' },
      el('h2', {}, titulo),
      el('button', { class: 'btn-icone', 'aria-label': 'Fechar', onclick: fechar }, '✕')
    ),
    el('div', { class: 'modal-corpo' }, corpo),
    acoes.length ? el('div', { class: 'modal-acoes' },
      acoes.map(({ rotulo, classe, onClick }) =>
        el('button', { class: classe || 'btn', onclick: () => onClick(fechar) }, rotulo))
    ) : null
  );
  const fundo = el('div', { class: 'modal-fundo', onclick: (ev) => { if (ev.target === fundo) fechar(); } }, caixa);
  raiz.append(fundo);
  return fechar;
}

export function confirmar(msg) {
  return new Promise((resolve) => {
    abrirModal('Confirmar', el('p', {}, msg), [
      { rotulo: 'Cancelar', classe: 'btn btn-suave', onClick: (f) => { f(); resolve(false); } },
      { rotulo: 'Confirmar', classe: 'btn btn-perigo', onClick: (f) => { f(); resolve(true); } },
    ]);
  });
}

// Confete leve ao concluir tarefa bloqueante (micro-interação, sem libs).
export function confete() {
  const cores = ['#7c3aed', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
  for (let i = 0; i < 24; i++) {
    const p = el('span', { class: 'confete' });
    p.style.left = `${20 + Math.random() * 60}vw`;
    p.style.background = cores[i % cores.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.setProperty('--desvio', `${(Math.random() - 0.5) * 40}vw`);
    document.body.append(p);
    setTimeout(() => p.remove(), 2200);
  }
}

export function avatar(pessoa) {
  const iniciais = pessoa ? pessoa.nome.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  return el('span', { class: `avatar papel-${pessoa ? pessoa.papel : 'nenhum'}`, title: pessoa ? pessoa.nome : 'Sem responsável' }, iniciais);
}

export function iconeCriticidade(n) {
  const nivel = n >= 4 ? 'alta' : n === 3 ? 'media' : 'baixa';
  const rotulo = n >= 4 ? 'Crítica (bloqueante)' : n === 3 ? 'Média' : 'Leve';
  return el('span', { class: `cadeado crit-${nivel}`, title: `Criticidade ${n} — ${rotulo}` }, '🔒');
}

// Linha de metadados: envolve cada item em <span> para o gap do flex funcionar.
export function meta(...itens) {
  return el('p', { class: 'meta' }, itens.filter(Boolean).map((i) => (i.nodeType ? i : el('span', {}, i))));
}

export function formatarMinutos(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h${m}` : `${h}h`) : `${m}min`;
}

export const NOMES_PAPEL = { coordenador: 'Coordenação', voluntario: 'Voluntariado', terceirizado: 'Terceirizados' };
export const ROTULO_PAPEL = { coordenador: 'Coordenador(a)', voluntario: 'Voluntário(a)', terceirizado: 'Terceirizado(a)' };
