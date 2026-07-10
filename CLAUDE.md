# 🎭 Produção Cultural — Documentação para Claude Code

## Visão geral

App **PWA offline-first** de gestão inteligente de produção cultural. Zero dependências externas, zero build, 100% local-first. Todos os dados ficam no dispositivo do usuário (IndexedDB).

## Stack tecnológico

- **Frontend:** HTML5 + CSS3 + JavaScript puro (ES Modules)
- **Dados:** IndexedDB (3 stores: eventos, pessoas, tarefas)
- **Offline:** Service Worker com precache do app shell
- **LLM (opcional):** Ollama local (fallback: assistente por regras em português)
- **Exportação:** PDF (print), Word .doc, Excel .xls, CSV — tudo gerado no dispositivo

## Estrutura de arquivos

```
.
├── index.html              # App shell: 4 abas (Evento | Tarefas | Equipe | Chat)
├── manifest.webmanifest    # Metadados PWA
├── sw.js                   # Service Worker (offline-first)
├── css/
│   └── style.css           # 240+ linhas; tema claro/escuro; mobile-first
├── js/
│   ├── app.js              # Orquestrador: estado, abas, tema, fonte
│   ├── db.js               # Wrapper IndexedDB (eventos, pessoas, tarefas)
│   ├── templates.js        # 3 modelos de eventos (Seminário, Show, Manifestação)
│   ├── distribuir.js       # Algoritmo topológico + carga + aptidão
│   ├── relatorio.js        # Exportação (PDF/Word/Excel/CSV)
│   ├── ui.js               # Helpers: modal, toast, confete, avatar, ícones
│   ├── ajuda.js            # Onboarding: tour, próximo passo, central de ajuda
│   └── views/
│       ├── evento.js       # Wizard de criação + ficha detalhada
│       ├── tarefas.js      # Kanban por setor (+ person/criticality views)
│       ├── equipe.js       # Roster com papéis, aptidões, carga
│       └── chat.js         # Chat em português (Ollama + regras)
├── icons/
│   ├── icon.svg            # 🎭 ícone do app
│   ├── icon-192.png        # PWA home screen
│   └── icon-512.png        # PWA splash screen
├── README.md               # Guia completo de funcionalidades e instalação
├── CLAUDE.md               # Este arquivo
└── LICENSE                 # MIT

```

## Como rodar localmente (desenvolvimento)

```bash
cd producao-eventos

# Qualquer servidor estático funciona
python3 -m http.server 8080
# ou
npx http-server -p 8080

# Abra http://localhost:8080
```

## Fluxo de dados (model)

### Stores IndexedDB

1. **eventos**
   - `id, nome, tipo, dataInicio, dataFim, descricao, local, formato, acesso, publicoEstimado, criadoEm`

2. **pessoas**
   - `id, nome, papel (coordenador|voluntario|terceirizado), aptidoes[], contato, disponibilidade, criadoEm`

3. **tarefas**
   - `id, eventoId, titulo, setor, criticidade (1-5), status (pendente|em_andamento|concluida), atribuidaA (pessoa.id), tempoEstimadoMinutos, resultadoEsperado, dependeDe[], subtarefas[], criadoEm`

## Funcionalidades principais

### 1. Eventos com modelos prontos (views/evento.js)

- Wizard com 3 templates: Seminário (9 tarefas), Show/Festival (10), Manifestação (8)
- Usuário pode **desmarcar tarefas** que não façam sentido antes de criar
- Ficha do evento mostra: nome, tipo, datas, descrição, local, formato, acesso, público estimado
- Botão "Começar com um exemplo" cria um evento de demonstração para leigos

### 2. Tarefas inteligentes (views/tarefas.js)

- Criticidade 1–5: 🔒 (vermelho = bloqueante; amarelo = média; verde = leve)
- Dependências: tarefa bloqueada fica sinalizada; concluir bloqueante libera dependentes (🎉 confete)
- Subtarefas inline
- 3 visualizações: kanban por setor (default), cargas por pessoa, lista por criticidade
- Badge na aba mostra número de pendências
- Botão "Distribuir tarefas" pulsa quando há tarefas sem dono

### 3. Distribuição inteligente (distribuir.js)

- **Ordenação topológica:** respeita dependências entre tarefas
- **Criticidade → papel:**
  - Críticas (4-5): apenas coordenadores, preferindo menor carga
  - Média (3): coordenadores + voluntários com aptidão
  - Leve (1-2): qualquer pessoa, peso para aptidão + papel voluntário
- **Sugestões, nunca forçadas:** usuário confirma com "Aceitar todas" ou revisa

### 4. Equipe e papéis (views/equipe.js)

- Papéis: coordenador (púrpura), voluntário (verde), terceirizado (laranja)
- Aptidões: tags personalizadas (design, redes sociais, etc.)
- Carga horária por pessoa
- Disponibilidade (disponível / indisponível)

### 5. Chatbot em português (views/chat.js)

- **Com Ollama:** conecta a `http://localhost:11434` (configurável via ⚙️), streaming em tempo real
- **Sem Ollama:** fallback para assistente por regras que entende:
  - `Adicionar tarefa: [título], criticidade [1-5], setor [setor], [tempo] horas`
  - `Quais tarefas estão sem responsável?`
  - `Sugira quem pode cuidar de [setor]`
  - `Quanto tempo falta em [setor]?`
  - `Me dê um resumo do evento`
  - Conversas privadas: tudo roda no dispositivo

### 6. Exportação (relatorio.js)

- **PDF:** abre print dialog (Ctrl+P → Salvar como PDF)
- **Word (.doc):** arquivo HTML com styling — abre em Word/LibreOffice
- **Excel (.xls):** arquivo HTML em formato tabela — abre em Sheets/Excel
- **CSV:** apenas tarefas, formato universal
- Nomes de arquivo sem acentos para compatibilidade com Chromium

### 7. Onboarding para leigos (ajuda.js)

- **Tour guiado:** 5 passos com holofote na primeira visita (revisitável)
- **Cartão "Próximo passo":** indica única ação prioritária
- **"Começar com um exemplo":** evento + equipe fictícia para explorar
- **Central de ajuda:** legenda de cadeados, cores, comandos do chat
- **A− / A+:** ajusta tamanho da fonte (min 14px, max 22px, persistente)
- **🌙/☀️ tema:** claro/escuro (respeitando `prefers-color-scheme`, com toggle)
- **Pulso + badge:** botão "Distribuir" pulsa e aba mostra selo quando há pendência

## Estados e rendering

### app.js (orquestrador)

```javascript
const ctx = {
  eventos: [],        // Array de todos os eventos
  evento: null,       // Evento selecionado
  tarefas: [],        // Tarefas do evento ativo
  pessoas: [],        // Todas as pessoas
  abaAtiva: 'evento', // aba visível (localStorage)
  recarregar,         // Fn: carrega dados + renderiza
  selecionarEvento,   // Fn: muda evento ativo
  irParaAba,          // Fn: muda aba
};
```

- **Persistência:** localStorage para `abaAtiva`, `eventoAtivo`, `tamanhoFonte`, `tema`, `tourVisto`
- **Renderização:** cada view (`VIEWS[abaAtiva]`) recebe `ctx` e redesiña o `#conteudo`

## Temas e acessibilidade

### CSS custom properties (tokens)

```css
:root {
  --primaria: #7c3aed;           /* roxo */
  --fundo: #f6f6f9;              /* ligeiramente cinzento */
  --superficie: #ffffff;         /* branco */
  --texto: #1c1c28;              /* quase preto */
  --texto-suave: #6b7280;        /* cinza */
  --perigo: #dc2626;             /* vermelho (crítica) */
  --ok: #059669;                 /* verde (concluído) */
  --alerta: #d97706;             /* laranja (terceirizado) */
}

/* Dark mode automático + toggle manual */
@media (prefers-color-scheme: dark) { /* default */ }
:root[data-tema="escuro"] { /* toggle override */ }
:root[data-tema="claro"] { /* toggle override */ }
```

### Acessibilidade

- **Foco visível:** `outline: 2px solid var(--primaria); outline-offset: 2px`
- **Alvos de toque:** `min-height: 40px` (recomendado 48px)
- **Reduced motion:** `prefers-reduced-motion: reduce` — desativa pulso, confete, transições
- **ARIA labels:** buttons, abas, modal, etc. têm `aria-label`, `role`, `aria-selected`
- **Semantic HTML:** `<button>`, `<nav>`, `<main>`, `<section>`, etc.

## Workflow recomendado para desenvolvimento

1. **Alterar arquivo JS/CSS:**
   - Servidor HTTP roda, F5 para refetch
   - Editar em `js/` e `css/`, salvar
   - Service Worker: necessário hard-refresh (Ctrl+Shift+R) em caso de mudança em `sw.js`

2. **Testar offline:**
   - DevTools → Application → Service Workers → Check "Offline"
   - App continua funcionando; dados vêm de IndexedDB

3. **Testar PWA:**
   - Chrome: Menu ⋮ → Instalar
   - Comporta como app nativo, funciona offline

4. **Testar Ollama (opcional):**
   - `ollama pull llama3:8b`
   - `OLLAMA_ORIGINS='*' ollama serve`
   - Na aba Chat, app detecta automaticamente

## Commits e versionamento

- Versão atual: **v1.0** (MVP completo)
  - ✅ Fase 1-4: core features, inteligência, chatbot, polimento
  - ⏳ Fase 5: notificações + automação (não implementado)

- Branch: `main` (stable)
- Todos os dados vêm do GitHub: https://github.com/FinweeJur/producao-eventos

## Scripts úteis (CLI)

```bash
# Inicie o servidor de desenvolvimento
python3 -m http.server 8080

# Verifique o JSON do manifest
cat manifest.webmanifest | jq .

# Teste com Ollama
OLLAMA_ORIGINS='*' ollama serve &
curl http://localhost:11434/api/generate -d '{"model":"llama3:8b","prompt":"Olá"}'
```

## Próximas melhorias (Fase 5+)

- [ ] Sincronização multiusuário (backend leve + E2E encryption)
- [ ] Notificações (Telegram, e-mail, WhatsApp via Notification Worker)
- [ ] Lembretes automáticos + resumos diários
- [ ] Integração Jitsi Meet (gerar links de reunião)
- [ ] Importação de CSV/Excel
- [ ] Undo/Redo (histórico)

## Licença

MIT — Use, modifique, distribua livremente.
