# Central de Jogos — Extensão Chrome

Extensão que mostra os jogos principais do dia (Brasileirão e Europa) num
popup, com **notificação nativa do Chrome** quando o placar de um jogo ao
vivo muda, e um **contador no ícone** com quantos jogos estão ao vivo agora.

Não duplica nenhuma lógica de busca de jogos — é um cliente leve da API que já
roda em [central-de-jogos-git-main-vieiradiego18-gmailcoms-projects.vercel.app](https://central-de-jogos-git-main-vieiradiego18-gmailcoms-projects.vercel.app)
(rota `/api/fixtures`).

## Como funciona

- `popup.html` / `popup.js` / `popup.css` — o que aparece ao clicar no ícone:
  lista os jogos "principais" de hoje (mesma categorização usada no site),
  agrupados por competição, com placar e link pra abrir o jogo no site.
- `background.js` — service worker (Manifest V3) que roda em segundo plano:
  a cada 1 minuto (`chrome.alarms`), busca `/api/fixtures` e:
  - atualiza o número no ícone com a quantidade de jogos "principais" ao vivo
  - se o placar de um jogo ao vivo mudou desde a última checagem, dispara uma
    `chrome.notifications` nativa do sistema operacional
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
