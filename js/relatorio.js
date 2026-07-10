// Documento geral do evento: gera um relatório completo (dados do evento,
// equipe e tarefas por setor) e exporta em PDF (via impressão), Word (.doc)
// e Excel (.xls / CSV) — tudo sem dependências externas.

import { formatarMinutos, ROTULO_PAPEL } from './ui.js';

export const ROTULO_FORMATO = { presencial: 'Presencial', virtual: 'Virtual', hibrido: 'Híbrido' };
export const ROTULO_ACESSO = { gratuito: 'Gratuito', pago: 'Pago', patrocinado: 'Patrocinado' };
const ROTULO_STATUS = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function htmlRelatorio(evento, tarefas, pessoas) {
  const nomePessoa = (id) => (pessoas.find((p) => p.id === id) || {}).nome || '—';
  const pendentes = tarefas.filter((t) => t.status !== 'concluida');
  const setores = [...new Set(tarefas.map((t) => t.setor))].sort();

  const detalhes = [
    ['Tipo', evento.tipo], ['Datas', [evento.dataInicio, evento.dataFim].filter(Boolean).join(' a ') || '—'],
    ['Local', evento.local || '—'],
    ['Formato', ROTULO_FORMATO[evento.formato] || '—'],
    ['Acesso', ROTULO_ACESSO[evento.acesso] || '—'],
    ['Público estimado', evento.publicoEstimado ? `${evento.publicoEstimado} pessoas` : '—'],
    ['Tarefas', `${tarefas.length - pendentes.length}/${tarefas.length} concluídas`],
    ['Trabalho restante', `~${formatarMinutos(pendentes.reduce((s, t) => s + (t.tempoEstimadoMinutos || 0), 0))}`],
  ];

  const linhasTarefas = setores.map((setor) => {
    const doSetor = tarefas.filter((t) => t.setor === setor).sort((a, b) => b.criticidade - a.criticidade);
    return `<h3>${esc(setor)}</h3>
      <table><thead><tr><th>Tarefa</th><th>Criticidade</th><th>Status</th><th>Responsável</th><th>Tempo</th><th>Resultado esperado</th></tr></thead><tbody>` +
      doSetor.map((t) => `<tr>
        <td>${esc(t.titulo)}</td><td class="c${t.criticidade >= 4 ? 'a' : t.criticidade === 3 ? 'm' : 'b'}">${t.criticidade}</td>
        <td>${ROTULO_STATUS[t.status] || t.status}</td><td>${esc(nomePessoa(t.atribuidaA))}</td>
        <td>${formatarMinutos(t.tempoEstimadoMinutos)}</td><td>${esc(t.resultadoEsperado)}</td>
      </tr>`).join('') + '</tbody></table>';
  }).join('');

  const linhasEquipe = pessoas.length
    ? `<table><thead><tr><th>Nome</th><th>Papel</th><th>Aptidões</th><th>Contato</th></tr></thead><tbody>` +
      pessoas.map((p) => `<tr><td>${esc(p.nome)}</td><td>${ROTULO_PAPEL[p.papel] || p.papel}</td>
        <td>${esc((p.aptidoes || []).join(', '))}</td><td>${esc(p.contato)}</td></tr>`).join('') + '</tbody></table>'
    : '<p>Equipe não cadastrada.</p>';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(evento.nome)} — Documento do evento</title>
  <style>
    body { font-family: system-ui, 'Segoe UI', sans-serif; color: #1c1c28; margin: 32px; font-size: 13px; }
    h1 { font-size: 22px; margin-bottom: 2px; } h2 { font-size: 16px; margin-top: 26px; border-bottom: 2px solid #7c3aed; padding-bottom: 4px; }
    h3 { font-size: 13px; margin: 16px 0 6px; color: #4c1d95; }
    .sub { color: #6b7280; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; vertical-align: top; }
    th { background: #ede9fe; }
    td.ca { color: #b91c1c; font-weight: 700; } td.cm { color: #b45309; font-weight: 700; } td.cb { color: #047857; }
    .detalhes td:first-child { font-weight: 600; width: 180px; background: #f6f6f9; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
  <h1>${esc(evento.nome)}</h1>
  <p class="sub">Documento geral do evento — gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  ${evento.descricao ? `<p>${esc(evento.descricao)}</p>` : ''}
  <h2>Dados do evento</h2>
  <table class="detalhes"><tbody>${detalhes.map(([r, v]) => `<tr><td>${r}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
  <h2>Equipe</h2>${linhasEquipe}
  <h2>Tarefas por setor</h2>${linhasTarefas}
  </body></html>`;
}

function baixar(blob, nomeArquivo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// Nome de arquivo sem acentos: alguns navegadores descartam nomes não-ASCII.
const nomeBase = (evento) => evento.nome.trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z\d-]+/g, '_');

// PDF: abre o relatório numa janela e chama a impressão (Salvar como PDF).
export function exportarPDF(evento, tarefas, pessoas) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(htmlRelatorio(evento, tarefas, pessoas));
  win.document.close();
  win.addEventListener('load', () => setTimeout(() => win.print(), 150));
  return true;
}

// Word: arquivo .doc em HTML — o Word/LibreOffice abre e formata normalmente.
export function exportarWord(evento, tarefas, pessoas) {
  const html = htmlRelatorio(evento, tarefas, pessoas);
  baixar(new Blob(['﻿' + html], { type: 'application/msword' }), `${nomeBase(evento)}_documento.doc`);
}

// Excel: arquivo .xls em HTML de tabelas — Excel/LibreOffice/Sheets abrem direto.
export function exportarExcel(evento, tarefas, pessoas) {
  const html = htmlRelatorio(evento, tarefas, pessoas);
  baixar(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }), `${nomeBase(evento)}_documento.xls`);
}

// CSV simples só com as tarefas (formato universal).
export function exportarCSV(evento, tarefas, pessoas) {
  const nomePessoa = (id) => (pessoas.find((p) => p.id === id) || {}).nome || '';
  const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [
    ['titulo', 'setor', 'criticidade', 'status', 'responsavel', 'tempo_estimado_min', 'resultado_esperado'].join(','),
    ...tarefas.map((t) => [
      c(t.titulo), c(t.setor), t.criticidade, c(t.status), c(nomePessoa(t.atribuidaA)),
      t.tempoEstimadoMinutos || 0, c(t.resultadoEsperado),
    ].join(',')),
  ];
  baixar(new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' }), `${nomeBase(evento)}_tarefas.csv`);
}
