// Lista de convidados: importação de planilha (CSV), normalização de telefone
// e estatísticas de confirmação. Tudo no dispositivo, sem servidor.

export const STATUS_CONVIDADO = {
  pendente: 'Sem resposta',
  convidado: 'Convite enviado',
  confirmado: 'Confirmado',
  talvez: 'Talvez',
  recusado: 'Não vem',
};

export const EMOJI_STATUS = {
  pendente: '⚪', convidado: '📨', confirmado: '✅', talvez: '🤔', recusado: '❌',
};

// Cabeçalhos aceitos na planilha — o produtor exporta do Excel/Sheets como está.
const ALIASES = {
  nome: ['nome', 'name', 'convidado', 'convidada', 'pessoa'],
  telefone: ['telefone', 'celular', 'whatsapp', 'zap', 'fone', 'phone', 'contato'],
  email: ['email', 'e-mail', 'mail'],
  telegram: ['telegram', 'chat_id', 'chatid', 'telegram_id'],
  grupo: ['grupo', 'categoria', 'lista', 'setor', 'tipo'],
  acompanhantes: ['acompanhantes', 'acompanhante', 'convites', 'vagas'],
  observacao: ['observacao', 'observação', 'obs', 'nota', 'notas'],
};

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Telefone brasileiro em formato internacional só com dígitos (wa.me exige assim).
export function normalizarTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;      // DDD + número
  if (d.length === 8 || d.length === 9) return '';            // sem DDD: não dá para discar
  return d;
}

export function telefoneLegivel(e164) {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (e164 || '');
}

// Divisor de CSV que respeita aspas e aceita vírgula ou ponto e vírgula.
function separarLinha(linha, sep) {
  const campos = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else aspas = !aspas;
    } else if (c === sep && !aspas) {
      campos.push(atual); atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function detectarSeparador(cabecalho) {
  const conta = (s) => cabecalho.split(s).length;
  return conta('\t') > 1 ? '\t' : conta(';') >= conta(',') ? ';' : ',';
}

function mapearColunas(cabecalho) {
  const mapa = {};
  cabecalho.forEach((titulo, i) => {
    const t = semAcento(titulo);
    for (const [campo, nomes] of Object.entries(ALIASES)) {
      if (mapa[campo] === undefined && nomes.includes(t)) mapa[campo] = i;
    }
  });
  return mapa;
}

/**
 * Lê texto de planilha (CSV/TSV colado ou arquivo) e devolve convidados prontos.
 * Sem cabeçalho reconhecível, assume "nome, telefone, email".
 * @returns {{convidados: object[], ignorados: number, colunas: string[]}}
 */
export function lerPlanilha(texto) {
  const linhas = String(texto || '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { convidados: [], ignorados: 0, colunas: [] };

  const sep = detectarSeparador(linhas[0]);
  const primeira = separarLinha(linhas[0], sep);
  let mapa = mapearColunas(primeira);
  let inicio = 1;

  if (mapa.nome === undefined) {          // sem cabeçalho: posição fixa
    mapa = { nome: 0, telefone: 1, email: 2 };
    inicio = 0;
  }

  const convidados = [];
  let ignorados = 0;
  for (let i = inicio; i < linhas.length; i++) {
    const campos = separarLinha(linhas[i], sep);
    const pega = (c) => (mapa[c] === undefined ? '' : (campos[mapa[c]] || '').trim());
    const nome = pega('nome');
    if (!nome) { ignorados++; continue; }
    convidados.push({
      nome,
      telefone: normalizarTelefone(pega('telefone')),
      email: pega('email'),
      telegramChatId: pega('telegram'),
      grupo: pega('grupo'),
      acompanhantes: Number(pega('acompanhantes')) || 0,
      observacao: pega('observacao'),
      status: 'pendente',
    });
  }
  return { convidados, ignorados, colunas: inicio === 1 ? primeira : [] };
}

// Mesmo telefone (ou mesmo nome, quando não há telefone) = mesma pessoa.
export function chaveDedupe(c) {
  return c.telefone || c.email.toLowerCase() || semAcento(c.nome);
}

export function estatisticas(convidados) {
  const base = { total: convidados.length, pendente: 0, convidado: 0, confirmado: 0, talvez: 0, recusado: 0, publico: 0 };
  for (const c of convidados) {
    base[c.status] = (base[c.status] || 0) + 1;
    if (c.status === 'confirmado') base.publico += 1 + (Number(c.acompanhantes) || 0);
  }
  base.semResposta = base.pendente + base.convidado;
  base.taxaResposta = base.total ? Math.round(((base.total - base.semResposta) / base.total) * 100) : 0;
  return base;
}

// Interpreta a resposta livre do convidado ("sim", "não vou", "talvez").
export function interpretarResposta(texto) {
  const t = semAcento(texto);
  if (!t) return null;
  if (/\b(nao|nao vou|nao posso|infelizmente|n)\b/.test(t)) return 'recusado';
  if (/\b(talvez|acho que|depende|vou tentar)\b/.test(t)) return 'talvez';
  if (/\b(sim|vou|confirmo|confirmado|estarei|conte comigo|s|bora)\b/.test(t)) return 'confirmado';
  return null;
}
