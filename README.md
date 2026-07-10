# 🎭 Produção Cultural

App **PWA offline-first** de gestão inteligente de produção cultural, para produtores, organizadores de eventos e coletivos. Sem conta, sem servidor, sem rastreadores: **todos os dados ficam no seu dispositivo**.

## Funcionalidades

- **Eventos com modelos prontos** — Seminário, Show/Festival e Manifestação de rua já vêm com listas de tarefas típicas (pré-produção, infraestrutura, divulgação, recepção…); no wizard você **desmarca as tarefas sugeridas que não fizerem sentido** antes de criar.
- **Ficha completa do evento** — além de nome, tipo, datas e descrição: local, público estimado, formato (presencial/virtual/híbrido) e acesso (gratuito/pago/patrocinado).
- **Tarefas completas** — criticidade 1–5 (🔒 vermelho = bloqueante), setor, tempo estimado, resultado esperado, subtarefas e dependências (tarefas bloqueadas ficam sinalizadas; concluir uma bloqueante solta confete e libera as dependentes 🎉).
- **Equipe** — papéis (coordenador, voluntário, terceirizado), aptidões (tags), disponibilidade e carga horária por pessoa.
- **Distribuição inteligente** — o botão “🪄 Distribuir tarefas” ordena por criticidade e dependências (ordenação topológica) e **sugere** responsáveis: críticas vão para coordenadores com menor carga, leves para voluntários com aptidão compatível. Você confirma com um toque — nada é forçado.
- **Visualizações** — kanban por setor (com barra de progresso e soma de tempo restante), cargas por pessoa e lista por criticidade.
- **Chatbot em português** — conectado ao [Ollama](https://ollama.com) local quando disponível (streaming, conversas 100% no dispositivo). Sem Ollama, funciona um assistente por regras que entende comandos como:
  - `Adicionar tarefa: contratar segurança, criticidade 5, setor infraestrutura, 3 horas`
  - `Quais tarefas estão sem responsável?`
  - `Sugira quem pode cuidar da divulgação`
  - `Quanto tempo falta no setor de infraestrutura?`
  - `Me dê um resumo do evento`
- **Exportação do documento geral do evento** — relatório completo (ficha, equipe e tarefas por setor) em **PDF** (via impressão do navegador), **Word (.doc)** e **Excel (.xls)**, além de **CSV** só com as tarefas. Tudo gerado no dispositivo, sem serviços externos.
- **PWA instalável**, modo claro/escuro (🌙/☀️ no topo), mobile-first e acessível (fontes generosas, alvos de toque grandes, foco visível, `prefers-reduced-motion` respeitado).
- **Feito para quem nunca usou um gestor de tarefas:**
  - 🔦 **Tour guiado** no primeiro uso (5 passos com holofote sobre a interface, revisitável pelo ❓);
  - 👉 **Cartão "Próximo passo"** que sempre indica a única próxima ação e leva até ela;
  - 🎓 **"Começar com um exemplo"** — cria um evento de demonstração com tarefas e equipe fictícia para aprender explorando;
  - 🪄 botão de distribuir **pulsa** quando há tarefa sem responsável, e a aba Tarefas mostra um **selo com as pendências**;
  - **A− / A+** no topo para diminuir/aumentar o tamanho do texto (persistente);
  - ❓ **Central de ajuda** com a legenda dos cadeados, das cores da equipe e frases que o Chat entende.

## Como rodar

É um app estático — não precisa de build nem de dependências:

```bash
# qualquer servidor estático serve, por exemplo:
python3 -m http.server 8080
# e abra http://localhost:8080
```

Para instalar como app: abra no navegador (Chrome/Edge/Firefox mobile) e use “Adicionar à tela inicial / Instalar app”.

### Chatbot com Ollama (opcional)

1. Instale o [Ollama](https://ollama.com) e rode um modelo: `ollama pull llama3:8b` (ou `mistral:7b`).
2. Para o navegador poder acessar, inicie o Ollama com CORS liberado para a origem do app:
   `OLLAMA_ORIGINS='*' ollama serve`
3. Abra a aba **Chat** — a detecção é automática (⚙️ permite trocar URL/modelo).

Sem Ollama o chat continua funcionando em modo básico (regras), inclusive criando tarefas por comando.

## Arquitetura

```
[PWA Frontend]  ←→  [IndexedDB]        (offline-first, local-first)
       │ (opcional)
[Ollama API]    http://localhost:11434 (LLM local, privado)
```

- **Frontend:** HTML5 + CSS3 + JavaScript puro (ES Modules) — zero dependências, zero build.
- **Dados:** IndexedDB (stores `eventos`, `pessoas`, `tarefas`), wrapper próprio em `js/db.js`.
- **Offline:** service worker (`sw.js`) com precache do app shell.

```
index.html            app shell (abas Evento | Tarefas | Equipe | Chat)
css/style.css         tema claro/escuro, mobile-first
js/app.js             orquestrador (estado, abas, seletor de evento, tema)
js/db.js              camada IndexedDB
js/templates.js       modelos de evento com tarefas típicas
js/distribuir.js      algoritmo de distribuição (topológica + carga + aptidão)
js/relatorio.js       documento geral do evento (PDF/Word/Excel/CSV)
js/ui.js              helpers (modal, toast, confete, avatar)
js/views/*.js         telas: evento, tarefas, equipe, chat
sw.js                 service worker (offline)
```

## Privacidade (privacy by design)

- Dados só em IndexedDB, no dispositivo. Sem conta obrigatória, sem analytics, sem rastreadores.
- O chatbot roda via Ollama **local**; nenhuma conversa sai do dispositivo (a menos que você configure um servidor Ollama próprio).
- O service worker nunca intercepta chamadas a outras origens.

## Roadmap

- [x] **Fase 1 — MVP:** CRUD de eventos/tarefas com templates, IndexedDB, visualização por setor, equipe e atribuição manual
- [x] **Fase 2 — Inteligência:** algoritmo de sugestão de delegação, aptidões, visão por pessoa, subtarefas e dependências
- [x] **Fase 3 — Chatbot:** integração Ollama com detecção automática + fallback por regras
- [x] **Fase 4 — Polimento (parcial):** PWA offline, exportação CSV, modo escuro, acessibilidade
- [ ] **Fase 5 — Notificações e automação:** Notification Worker local (node-cron) com lembretes por Telegram/e-mail/WhatsApp, resumos diários e envio automático de link de reunião (Jitsi Meet)
- [ ] Sincronização multiusuário opcional (backend leve com criptografia de ponta a ponta)

## Licença

MIT
