# 🤖 Worker de lembretes (opcional)

O app **não precisa** deste worker: quando você abre a aba Convidados, ele já mostra e dispara tudo que
está na hora. O worker existe para quem quer os lembretes saindo sozinhos, sem abrir o app — num PC
ligado, por exemplo. Ele envia **só por Telegram** (WhatsApp exige o toque de um humano, por design).

## Requisitos

- Node 18+ (usa `fetch` nativo). Sem `npm install`: zero dependências.
- Um bot do Telegram (crie no `@BotFather`) e os convidados tendo dado `/start` nele.

## Uso

1. No app: **Convidados → 🤖 Worker → ⬇️ Baixar dados.json**
2. No terminal, dentro do repositório:

```bash
node automacao/worker.mjs dados.json --simular
```

`--simular` mostra o que sairia, sem enviar nada. Confira e rode de verdade:

```bash
node automacao/worker.mjs dados.json --loop 3600
```

`--loop SEGUNDOS` repete a rodada nesse intervalo (3600 = de hora em hora). Sem `--loop`, roda uma vez e sai.

3. Volte ao app: **Convidados → 🤖 Worker → 3. Traga de volta o que ele fez** e escolha o `dados.json`
   atualizado. Os envios já feitos e as respostas coletadas entram na sua lista.

## O que ele faz por rodada

1. Lê as respostas novas que chegaram ao bot (`getUpdates`) e converte *SIM / NÃO / TALVEZ* em situação do convidado.
2. Envia as mensagens que as regras mandam enviar hoje — convite, confirmação (7 dias antes), cobrança (3),
   lembrete de véspera (1) e agradecimento — **só para quem tem `telegramChatId`**.
3. Manda o resumo diário no grupo da equipe, uma vez por dia, se `chatEquipeTelegram` estiver configurado.
4. Regrava o `dados.json` com o que foi enviado e o que foi respondido.

As regras e os textos vêm de `js/automacao.js` e `js/mensagens.js` — os mesmos do app, importados
diretamente. Alterou no app, valeu para o worker.

## Cuidado com o arquivo

`dados.json` contém o **token do seu bot** e os **contatos dos convidados**. Guarde-o como você guardaria a
planilha original: fora de repositório público, fora de pasta sincronizada com terceiros. O `.gitignore`
do projeto já ignora `dados.json`.
