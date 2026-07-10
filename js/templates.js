// Modelos de eventos com tarefas típicas pré-configuradas.
// criticidade: 5 = bloqueante (coordenador), 3 = média, 1-2 = operacional.

export const TIPOS_EVENTO = [
  { id: 'seminario', nome: 'Seminário' },
  { id: 'show', nome: 'Show / Festival' },
  { id: 'manifestacao', nome: 'Manifestação de rua' },
  { id: 'outro', nome: 'Outro (em branco)' },
];

export const TEMPLATES = {
  seminario: [
    { titulo: 'Definir tema e público-alvo', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 120, resultadoEsperado: 'Tema, formato e público definidos por escrito' },
    { titulo: 'Fechar local (contrato/alvará)', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 240, resultadoEsperado: 'Contrato assinado e alvará em mãos' },
    { titulo: 'Contratar/confirmar palestrantes', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 300, resultadoEsperado: 'Todos os palestrantes confirmados com horário' },
    { titulo: 'Equipamentos de som e projeção', setor: 'Infraestrutura', criticidade: 3, tempoEstimadoMinutos: 180, resultadoEsperado: 'Som e projetor testados no local' },
    { titulo: 'Disposição das cadeiras e sinalização', setor: 'Infraestrutura', criticidade: 3, tempoEstimadoMinutos: 90, resultadoEsperado: 'Sala montada conforme o público esperado' },
    { titulo: 'Criar arte de divulgação', setor: 'Divulgação', criticidade: 2, tempoEstimadoMinutos: 120, resultadoEsperado: 'Arte aprovada nos formatos das redes' },
    { titulo: 'Postar nas redes sociais', setor: 'Divulgação', criticidade: 2, tempoEstimadoMinutos: 60, resultadoEsperado: 'Publicações agendadas em todas as redes' },
    { titulo: 'Lista de presença', setor: 'Recepção', criticidade: 1, tempoEstimadoMinutos: 30, resultadoEsperado: 'Lista impressa ou formulário digital pronto' },
    { titulo: 'Coffee break', setor: 'Recepção', criticidade: 1, tempoEstimadoMinutos: 120, resultadoEsperado: 'Fornecedor contratado e cardápio definido' },
  ],
  show: [
    { titulo: 'Fechar local e alvará', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 360, resultadoEsperado: 'Local contratado com alvará de funcionamento' },
    { titulo: 'Contratar atrações', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 480, resultadoEsperado: 'Contratos das atrações assinados' },
    { titulo: 'Plano de segurança e brigada', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 240, resultadoEsperado: 'Plano aprovado e equipe de segurança contratada' },
    { titulo: 'Montar palco', setor: 'Infraestrutura', criticidade: 4, tempoEstimadoMinutos: 480, resultadoEsperado: 'Palco montado e vistoriado' },
    { titulo: 'Som e iluminação (passagem de som)', setor: 'Infraestrutura', criticidade: 4, tempoEstimadoMinutos: 300, resultadoEsperado: 'Rider técnico atendido e passagem feita' },
    { titulo: 'Camarim e hospitalidade', setor: 'Infraestrutura', criticidade: 3, tempoEstimadoMinutos: 120, resultadoEsperado: 'Camarins prontos conforme rider' },
    { titulo: 'Venda/controle de ingressos', setor: 'Produção', criticidade: 3, tempoEstimadoMinutos: 180, resultadoEsperado: 'Plataforma de ingressos configurada' },
    { titulo: 'Criar arte e vídeo de divulgação', setor: 'Divulgação', criticidade: 2, tempoEstimadoMinutos: 240, resultadoEsperado: 'Peças aprovadas e publicadas' },
    { titulo: 'Bar e alimentação', setor: 'Produção', criticidade: 2, tempoEstimadoMinutos: 180, resultadoEsperado: 'Fornecedores definidos e abastecidos' },
    { titulo: 'Equipe de portaria e credenciamento', setor: 'Recepção', criticidade: 2, tempoEstimadoMinutos: 90, resultadoEsperado: 'Escala de portaria fechada' },
  ],
  manifestacao: [
    { titulo: 'Comunicar trajeto aos órgãos competentes', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 180, resultadoEsperado: 'Protocolo de comunicação prévia registrado' },
    { titulo: 'Definir trajeto e ponto de concentração', setor: 'Pré-produção', criticidade: 5, tempoEstimadoMinutos: 120, resultadoEsperado: 'Trajeto mapeado com horários' },
    { titulo: 'Carro de som', setor: 'Infraestrutura', criticidade: 4, tempoEstimadoMinutos: 180, resultadoEsperado: 'Carro de som contratado com motorista' },
    { titulo: 'Equipe de segurança/apoio jurídico', setor: 'Pré-produção', criticidade: 4, tempoEstimadoMinutos: 120, resultadoEsperado: 'Advogados de plantão e brigada definidos' },
    { titulo: 'Faixas e cartazes', setor: 'Divulgação', criticidade: 2, tempoEstimadoMinutos: 240, resultadoEsperado: 'Material visual produzido' },
    { titulo: 'Convocatória nas redes', setor: 'Divulgação', criticidade: 2, tempoEstimadoMinutos: 90, resultadoEsperado: 'Convocatória publicada e impulsionada organicamente' },
    { titulo: 'Água e primeiros socorros', setor: 'Apoio', criticidade: 2, tempoEstimadoMinutos: 60, resultadoEsperado: 'Pontos de hidratação e kit de primeiros socorros' },
    { titulo: 'Registro em foto e vídeo', setor: 'Apoio', criticidade: 1, tempoEstimadoMinutos: 120, resultadoEsperado: 'Equipe de registro escalada' },
  ],
  outro: [],
};

export function tarefasDoTemplate(tipo, eventoId, novoId) {
  return (TEMPLATES[tipo] || []).map((t) => ({
    id: novoId(),
    eventoId,
    titulo: t.titulo,
    descricao: '',
    setor: t.setor,
    criticidade: t.criticidade,
    tempoEstimadoMinutos: t.tempoEstimadoMinutos,
    resultadoEsperado: t.resultadoEsperado,
    dependeDe: [],
    status: 'pendente',
    atribuidaA: null,
    parentId: null,
    criadoEm: Date.now(),
  }));
}
