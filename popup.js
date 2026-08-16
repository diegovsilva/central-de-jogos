import { API_BASE } from "./config.js"

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

function renderCard(fixture) {
  const card = document.createElement("a")
  card.className = "jogo"
  card.href = `${API_BASE}/?match=${fixture.id}`
  card.target = "_blank"
  card.rel = "noopener noreferrer"

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

  card.append(times, status)
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

    const principais = (data.fixtures ?? [])
      .filter((f) => f.category === "principais")
      .sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
        return a.timestamp - b.timestamp
      })

    if (principais.length === 0) {
      status.textContent = "Nenhum jogo principal hoje."
      return
    }

    status.remove()
    renderGrupos(principais, lista)
  } catch {
    status.textContent = "Não deu pra carregar os jogos."
  }
}

async function iniciarToggleNotificacoes() {
  const toggle = document.getElementById("toggle-notif")
  const { notificacoesAtivas = true } = await chrome.storage.sync.get("notificacoesAtivas")
  toggle.checked = notificacoesAtivas

  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ notificacoesAtivas: toggle.checked })
  })
}

document.getElementById("abrir-site").href = API_BASE

carregarJogos()
iniciarToggleNotificacoes()
