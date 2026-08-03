// Canais de envio: WhatsApp (link wa.me, sem API e sem servidor) e Telegram
// (Bot API chamada direto do navegador). Nada sai do aparelho sem ação sua:
// o WhatsApp abre o app com a mensagem pronta e o Telegram só funciona depois
// que VOCÊ cadastra um token de bot nas configurações.

const CHAVE_CONFIG = 'automacao';

const CONFIG_PADRAO = {
  canal: 'whatsapp',        // whatsapp | telegram
  assinatura: 'Produção',
  tokenTelegram: '',
  chatEquipeTelegram: '',   // grupo da equipe, para o resumo diário
  modelos: {},              // sobrescreve MODELOS_PADRAO quando editado
  regras: {},               // { confirmacao: true, cobranca: true, ... }
  ultimoUpdateTelegram: 0,
};

export function lerConfig() {
  try {
    return { ...CONFIG_PADRAO, ...JSON.parse(localStorage.getItem(CHAVE_CONFIG) || '{}') };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

export function salvarConfig(parcial) {
  const novo = { ...lerConfig(), ...parcial };
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(novo));
  return novo;
}

export function telegramConfigurado() {
  return Boolean(lerConfig().tokenTelegram);
}

// ---------- WhatsApp ----------

// wa.me abre o WhatsApp Web/app com o texto pronto — o envio é um toque seu.
export function linkWhatsApp(telefone, texto) {
  const numero = String(telefone || '').replace(/\D/g, '');
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function abrirWhatsApp(telefone, texto) {
  const win = window.open(linkWhatsApp(telefone, texto), '_blank', 'noopener');
  return Boolean(win);
}

// ---------- Telegram ----------

async function chamarTelegram(token, metodo, params) {
  const resp = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const dados = await resp.json().catch(() => ({}));
  if (!dados.ok) throw new Error(dados.description || `Telegram respondeu ${resp.status}`);
  return dados.result;
}

export async function testarTelegram(token) {
  const bot = await chamarTelegram(token, 'getMe', {});
  return bot.username ? `@${bot.username}` : 'bot';
}

// Markdown do WhatsApp (*negrito*) já é compatível com o modo Markdown legado.
export function enviarTelegram(token, chatId, texto) {
  return chamarTelegram(token, 'sendMessage', {
    chat_id: chatId, text: texto, parse_mode: 'Markdown', disable_web_page_preview: true,
  });
}

/**
 * Busca respostas novas recebidas pelo bot (long polling curto).
 * @returns {{mensagens: {chatId: string, usuario: string, texto: string}[], ultimo: number}}
 */
export async function buscarRespostasTelegram(token, offset = 0) {
  const updates = await chamarTelegram(token, 'getUpdates', {
    offset: offset ? offset + 1 : undefined, timeout: 0, allowed_updates: ['message'],
  });
  const mensagens = [];
  let ultimo = offset;
  for (const u of updates || []) {
    ultimo = Math.max(ultimo, u.update_id);
    const m = u.message;
    if (!m || !m.text) continue;
    mensagens.push({
      chatId: String(m.chat.id),
      usuario: m.from?.username ? '@' + m.from.username : (m.from?.first_name || ''),
      telefone: m.contact?.phone_number || '',
      texto: m.text,
    });
  }
  return { mensagens, ultimo };
}

// ---------- Genéricos ----------

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

// Sala on-line gerada a partir do nome do evento — sem cadastro, sem servidor nosso.
export function linkReuniao(evento) {
  if (!evento) return '';
  if (/^https?:\/\//i.test(evento.local || '')) return evento.local;
  const sala = String(evento.nome || 'evento').normalize('NFD').replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 28) || 'Evento';
  return `https://meet.jit.si/${sala}-${String(evento.id || '').slice(0, 6)}`;
}
