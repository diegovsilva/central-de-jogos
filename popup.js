import { API_BASE } from "./config.js"
import { MAIN_TEAM_IDS } from "./lib/main-teams.js"
import { PIX_KEY, PIX_AMOUNTS, PIX_DEFAULT_AMOUNT, buildPixCode } from "./lib/pix.js"

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function tempoLabel(fixture) {
  if (fixture.isLive) return `${fixture.elapsed ?? 0}'`
  if (["FT", "AET", "PEN"].includes(fixture.statusShort)) return "Fim"
  const data = new Date(fixture.timestamp * 1000)
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function envolveTimePrincipal(fixture) {
  return MAIN_TEAM_IDS.has(fixture.home.id) || MAIN_TEAM_IDS.has(fixture.away.id)
}

let jogosSelecionados = new Set()

async function carregarSelecionados() {
  const { jogosSelecionados: salvos = [] } = await chrome.storage.sync.get("jogosSelecionados")
  jogosSelecionados = new Set(salvos.map(String))
}

async function alternarSelecao(fixtureId, botao) {
  const chave = String(fixtureId)
  const ligado = jogosSelecionados.has(chave)

  if (ligado) {
    jogosSelecionados.delete(chave)
  } else {
    jogosSelecionados.add(chave)
  }

  botao.classList.toggle("jogo__sino--ativo", !ligado)
  botao.setAttribute("aria-pressed", String(!ligado))
  botao.title = !ligado ? "Notificando esse jogo" : "Notificar esse jogo"

  await chrome.storage.sync.set({ jogosSelecionados: Array.from(jogosSelecionados) })
  chrome.runtime.sendMessage({ type: "jogos-selecionados-mudou" })
}

// Busca em qual canal autorizado o jogo está passando (só pra jogos ao vivo
// — não faz sentido gastar a busca em jogos que nem começaram).
async function buscarTransmissao(fixture) {
  const params = new URLSearchParams({
    home: fixture.home.name,
    away: fixture.away.name,
    league: fixture.league.name,
    country: fixture.league.country || "",
    date: todayISO(),
    event: "live",
  })

  try {
    const res = await fetch(`${API_BASE}/api/videos?${params.toString()}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.video || null
  } catch {
    return null
  }
}

function renderTransmissao(container, video) {
  container.innerHTML = ""
  if (!video) return

  const link = document.createElement("a")
  link.className = "jogo__canal"
  link.href = video.url
  link.target = "_blank"
  link.rel = "noopener noreferrer"
  link.title = `Assistir no ${video.channelTitle}`

  if (video.channelLogo) {
    const img = document.createElement("img")
    img.src = video.channelLogo
    img.alt = ""
    link.appendChild(img)
  }

  const texto = document.createElement("span")
  texto.textContent = video.channelTitle
  link.appendChild(texto)

  container.appendChild(link)
}

function renderCard(fixture) {
  const card = document.createElement("div")
  card.className = "jogo"

  const link = document.createElement("a")
  link.className = "jogo__link"
  link.href = `${API_BASE}/?match=${fixture.id}`
  link.target = "_blank"
  link.rel = "noopener noreferrer"

  const times = document.createElement("div")
  times.className = "jogo__times"

  for (const lado of [fixture.home, fixture.away]) {
    const linha = document.createElement("div")
    linha.className = "jogo__time"

    const escudo = document.createElement("img")
    escudo.src = lado.logo || "icons/icon-32.png"
    escudo.alt = ""
    escudo.loading = "lazy"

    const nome = document.createElement("span")
    nome.textContent = lado.name

    const gols = document.createElement("b")
    gols.textContent = lado.goals ?? "-"

    linha.append(escudo, nome, gols)
    times.appendChild(linha)
  }

  const status = document.createElement("div")
  status.className = `jogo__status ${fixture.isLive ? "jogo__status--vivo" : ""}`
  status.textContent = (fixture.isLive ? "● " : "") + tempoLabel(fixture)

  link.append(times, status)

  const sino = document.createElement("button")
  const jaSelecionado = jogosSelecionados.has(String(fixture.id))
  sino.className = `jogo__sino ${jaSelecionado ? "jogo__sino--ativo" : ""}`
  sino.type = "button"
  sino.setAttribute("aria-pressed", String(jaSelecionado))
  sino.title = jaSelecionado ? "Notificando esse jogo" : "Notificar esse jogo"
  sino.textContent = "🔔"
  sino.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()
    alternarSelecao(fixture.id, sino)
  })

  const topo = document.createElement("div")
  topo.className = "jogo__topo"
  topo.append(link, sino)

  card.appendChild(topo)

  if (fixture.isLive) {
    const canalBox = document.createElement("div")
    canalBox.className = "jogo__canal-box"
    canalBox.textContent = "Buscando transmissão…"
    card.appendChild(canalBox)

    buscarTransmissao(fixture).then((video) => {
      if (!video) {
        canalBox.remove()
        return
      }
      renderTransmissao(canalBox, video)
    })
  }

  return card
}

function renderGrupos(fixtures, container) {
  const grupos = new Map()

  for (const fixture of fixtures) {
    const chave = fixture.league.id
    if (!grupos.has(chave)) {
      grupos.set(chave, { nome: fixture.league.name, logo: fixture.league.logo, jogos: [] })
    }
    grupos.get(chave).jogos.push(fixture)
  }

  for (const grupo of grupos.values()) {
    const secao = document.createElement("section")
    secao.className = "grupo"

    const titulo = document.createElement("div")
    titulo.className = "grupo__titulo"

    const logo = document.createElement("img")
    logo.src = grupo.logo || "icons/icon-32.png"
    logo.alt = ""

    const nome = document.createElement("span")
    nome.textContent = grupo.nome

    titulo.append(logo, nome)
    secao.appendChild(titulo)

    for (const jogo of grupo.jogos) {
      secao.appendChild(renderCard(jogo))
    }

    container.appendChild(secao)
  }
}

async function carregarJogos() {
  const status = document.getElementById("status")
  const lista = document.getElementById("lista")

  try {
    const res = await fetch(`${API_BASE}/api/fixtures?date=${todayISO()}`)
    const data = await res.json()

    if (!res.ok || data.error) {
      status.textContent = data.error || "Não deu pra carregar os jogos."
      return
    }

    // só jogos "principais" E que envolvem um time grande — evita poluir o
    // popup com todos os jogos das ligas principais (ex.: toda rodada do
    // Brasileirão, mesmo entre times pequenos)
    const jogos = (data.fixtures ?? [])
      .filter((f) => f.category === "principais" && envolveTimePrincipal(f))
      .sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
        return a.timestamp - b.timestamp
      })

    if (jogos.length === 0) {
      status.textContent = "Nenhum jogo de time principal hoje."
      return
    }

    status.remove()
    renderGrupos(jogos, lista)
  } catch {
    status.textContent = "Não deu pra carregar os jogos."
  }
}

document.getElementById("abrir-site").href = API_BASE

carregarSelecionados().then(carregarJogos)

// ---------- Painel "Apoiar" (Pix) ----------

function iniciarPainelApoio() {
  const toggle = document.getElementById("apoiar-toggle")
  const painel = document.getElementById("apoiar-painel")
  const valoresEl = document.getElementById("apoiar-valores")
  const qrEl = document.getElementById("apoiar-qr")
  const copiarBtn = document.getElementById("apoiar-copiar")

  if (!PIX_KEY) {
    // sem chave configurada ainda — não expõe o botão em vez de mostrar
    // um painel quebrado
    toggle.remove()
    return
  }

  let valorAtual = PIX_DEFAULT_AMOUNT

  function renderValores() {
    valoresEl.innerHTML = ""
    for (const valor of PIX_AMOUNTS) {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "apoiar__valor"
      chip.setAttribute("role", "radio")
      chip.setAttribute("aria-checked", String(valor === valorAtual))
      chip.textContent = `R$ ${valor}`
      chip.addEventListener("click", () => {
        valorAtual = valor
        renderValores()
        renderPix()
      })
      valoresEl.appendChild(chip)
    }
  }

  function renderPix() {
    const codigo = buildPixCode(valorAtual)
    copiarBtn.dataset.codigo = codigo
    copiarBtn.classList.remove("copiado")
    copiarBtn.textContent = "Copiar código Pix"

    qrEl.textContent = ""
    if (typeof window.qrcode === "function") {
      try {
        const qr = window.qrcode(0, "M")
        qr.addData(codigo)
        qr.make()
        qrEl.innerHTML = qr.createSvgTag({ cellSize: 4, scalable: true })
      } catch {
        qrEl.textContent = "Não deu pra gerar o QR Code."
      }
    }
  }

  toggle.addEventListener("click", () => {
    const aberto = toggle.getAttribute("aria-expanded") === "true"
    toggle.setAttribute("aria-expanded", String(!aberto))
    painel.hidden = aberto
    if (!aberto) renderPix()
  })

  copiarBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copiarBtn.dataset.codigo || "")
      copiarBtn.classList.add("copiado")
      copiarBtn.textContent = "Copiado!"
      setTimeout(() => {
        copiarBtn.classList.remove("copiado")
        copiarBtn.textContent = "Copiar código Pix"
      }, 2000)
    } catch {
      // clipboard indisponível (ex.: sem permissão) — sem tratamento especial
    }
  })

  renderValores()
}

iniciarPainelApoio()
