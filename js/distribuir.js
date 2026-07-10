// Algoritmo de distribuição inteligente de tarefas.
// Gera SUGESTÕES (nunca atribuição forçada) seguindo as regras:
//   criticidade 4-5 → apenas coordenadores, preferindo o de menor carga;
//   criticidade 3   → balanceia coordenadores e voluntários com aptidão;
//   criticidade 1-2 → qualquer pessoa, com peso para aptidões e papel voluntário.

export function ordenarTopologicamente(tarefas) {
  const porId = new Map(tarefas.map((t) => [t.id, t]));
  const visitado = new Set();
  const ordem = [];
  function visitar(t, trilha) {
    if (visitado.has(t.id) || trilha.has(t.id)) return; // ciclo: ignora a aresta
    trilha.add(t.id);
    for (const dep of t.dependeDe || []) {
      const d = porId.get(dep);
      if (d) visitar(d, trilha);
    }
    trilha.delete(t.id);
    visitado.add(t.id);
    ordem.push(t);
  }
  const porPrioridade = [...tarefas].sort((a, b) => b.criticidade - a.criticidade);
  for (const t of porPrioridade) visitar(t, new Set());
  return ordem;
}

export function cargaPorPessoa(tarefas) {
  const carga = new Map();
  for (const t of tarefas) {
    if (t.atribuidaA && t.status !== 'concluida') {
      carga.set(t.atribuidaA, (carga.get(t.atribuidaA) || 0) + (t.tempoEstimadoMinutos || 0));
    }
  }
  return carga;
}

function pontuacaoAptidao(tarefa, pessoa) {
  const texto = `${tarefa.titulo} ${tarefa.setor} ${tarefa.descricao || ''}`.toLowerCase();
  let pontos = 0;
  for (const apt of pessoa.aptidoes || []) {
    if (apt && texto.includes(apt.toLowerCase())) pontos += 10;
  }
  return pontos;
}

export function distribuirTarefas(tarefas, pessoas) {
  const sugestoes = [];
  const conflitos = [];
  const carga = cargaPorPessoa(tarefas);
  const disponiveis = pessoas.filter((p) => p.disponibilidade !== 'indisponivel');
  const coordenadores = disponiveis.filter((p) => p.papel === 'coordenador');

  const pendentes = ordenarTopologicamente(
    tarefas.filter((t) => !t.atribuidaA && t.status !== 'concluida')
  );

  for (const tarefa of pendentes) {
    let candidatos;
    if (tarefa.criticidade >= 4) {
      candidatos = coordenadores;
    } else if (tarefa.criticidade === 3) {
      candidatos = disponiveis.filter((p) => p.papel !== 'terceirizado' || pontuacaoAptidao(tarefa, p) > 0);
    } else {
      candidatos = disponiveis;
    }

    if (!candidatos.length) {
      if (tarefa.criticidade >= 4) {
        conflitos.push({ tarefa, motivo: 'Tarefa crítica sem coordenador disponível' });
      } else {
        conflitos.push({ tarefa, motivo: 'Nenhuma pessoa disponível para esta tarefa' });
      }
      continue;
    }

    // Pontuação: menor carga é melhor; aptidão e papel adequado somam pontos.
    let melhor = null;
    let melhorPontos = -Infinity;
    for (const p of candidatos) {
      let pontos = -((carga.get(p.id) || 0) / 60); // cada hora de carga desconta 1 ponto
      pontos += pontuacaoAptidao(tarefa, p);
      if (tarefa.criticidade <= 2 && p.papel === 'voluntario') pontos += 3;
      if (tarefa.criticidade === 3 && p.papel === 'coordenador') pontos += 1;
      if (pontos > melhorPontos) { melhorPontos = pontos; melhor = p; }
    }

    const motivo = [];
    if (tarefa.criticidade >= 4) motivo.push('crítica → coordenador');
    if (pontuacaoAptidao(tarefa, melhor) > 0) motivo.push('aptidão compatível');
    motivo.push(`carga atual: ${Math.round((carga.get(melhor.id) || 0) / 60 * 10) / 10}h`);

    sugestoes.push({ tarefa, pessoa: melhor, motivo: motivo.join(' · ') });
    carga.set(melhor.id, (carga.get(melhor.id) || 0) + (tarefa.tempoEstimadoMinutos || 0));
  }

  return { sugestoes, conflitos };
}

// Uma tarefa está bloqueada se depende de tarefa não concluída.
export function tarefaBloqueada(tarefa, todas) {
  const porId = new Map(todas.map((t) => [t.id, t]));
  return (tarefa.dependeDe || []).some((id) => {
    const dep = porId.get(id);
    return dep && dep.status !== 'concluida';
  });
}
