# Central de Jogos — Extensão Chrome

Extensão que mostra os jogos principais do dia (Brasileirão e Europa) num
popup, com **notificação nativa do Chrome** quando o placar de um jogo ao
vivo muda, e um **contador no ícone** com quantos jogos estão ao vivo agora.

Não duplica nenhuma lógica de busca de jogos — é um cliente leve da API que já
roda em [central-de-jogos-eight.vercel.app](https://central-de-jogos-eight.vercel.app)
(rota `/api/fixtures`).

## Como funciona

- `popup.html` / `popup.js` / `popup.css` — o que aparece ao clicar no ícone:
  lista os jogos de hoje que envolvem um **time principal** (`lib/main-teams.js`
  — mesma lista do site, precisa ser mantida sincronizada manualmente já que
  são repositórios separados), agrupados por competição, com placar e link
  pra abrir o jogo no site. Pra jogos ao vivo, busca em qual canal
  autorizado está passando (`/api/videos` do site) e mostra o logo do canal
  com um botão que abre a transmissão direto.
- `background.js` — service worker (Manifest V3) que roda em segundo plano:
  a cada 1 minuto (`chrome.alarms`), busca `/api/fixtures` e, **só pros jogos
  que a pessoa marcou no sino do popup** (`chrome.storage.sync`):
  - atualiza o número no ícone com a quantidade de jogos selecionados ao vivo
  - se o placar de um jogo selecionado ao vivo mudou desde a última checagem,
    dispara uma `chrome.notifications` nativa do sistema operacional
  - remove da lista de selecionados os jogos que já terminaram
- `config.js` — só a URL base da API, num lugar só, fácil de trocar.

## Instalar em modo desenvolvedor (antes de publicar na Chrome Web Store)

1. `chrome://extensions`
2. Ativa "Modo do desenvolvedor" (canto superior direito)
3. "Carregar sem compactação" → seleciona a pasta deste repositório
4. Pronto — o ícone aparece na barra de extensões

## Ajustar o domínio da API

Se o site mudar de domínio, edite `API_BASE` em `config.js` **e** o
`host_permissions` em `manifest.json` (os dois precisam bater).

## Publicar na Chrome Web Store

1. Gera um `.zip` da pasta (sem incluir `.git`)
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) →
   taxa única de US$5 pra conta de desenvolvedor
3. Sobe o `.zip`, preenche descrição/screenshots, envia pra revisão


## Meu time (favorito)

Campo de busca no topo do popup — digita o nome do time (ex.: "Coritiba")
e a extensão:

1. Se o nome bater com um time da lista rápida (`lib/main-teams.js`,
   ~30 clubes grandes), mostra sugestões com escudo clicáveis.
2. Se não bater com nenhum da lista (ou você clicar em "Buscar nos
   jogos"), procura de verdade nos jogos reais — hoje e, se não achar,
   dia a dia (até 14 dias à frente) — até encontrar um jogo com um time
   cujo nome contenha o texto digitado. Funciona pra **qualquer** time,
   não só os da lista rápida (escudo e ID vêm direto do jogo encontrado,
   sem precisar cadastrar o time em lugar nenhum).

Depois de escolhido, mostra o próximo jogo (ou "nenhum jogo encontrado"
se passar dos 14 dias sem achar), com o mesmo card de jogo (sino de
notificar, canal de transmissão) usado no resto da lista.

## Apoiar via Pix

O popup tem um botão "☕ Apoiar" que abre um painel com QR Code e código
Pix "copia e cola" — gerado inteiramente no navegador (`lib/pix.js`), sem
nenhuma chamada de rede (exigência do Manifest V3 pra não rodar código
remoto).

Pra configurar sua própria chave: edite `PIX_KEY`, `MERCHANT_NAME` e
`MERCHANT_CITY` em `lib/pix.js`. Nome e cidade precisam ser ASCII
maiúsculo sem acento (nome até 25 caracteres, cidade até 15). Enquanto
`PIX_KEY` estiver vazio, o botão "Apoiar" fica escondido automaticamente.
