import { API_BASE } from "./config.js"
import { MAIN_TEAM_IDS, MAIN_TEAMS } from "./lib/main-teams.js"
import { PIX_KEY, PIX_AMOUNTS, PIX_DEFAULT_AMOUNT, buildPixCode } from "./lib/pix.js"

function ymd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function todayISO() {
  return ymd(new Date())
}

function tempoLabel(fixture) {
  if (fixture.isLive) return `${fixture.elapsed ?? 0}'`
  if (["FT", "AET", "PEN"].includes(fixture.statusShort)) return "Fim"

  const data = new Date(fixture.timestamp * 1000)
  const horario = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

  if (ymd(data) === todayISO()) return horario

  const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
  const diaMes = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `${diaSemana} ${diaMes} · ${horario}`
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
    const res = await fetch(`${API_BASE}/api/videos?${params.toString()}`, { cache: "no-store" })
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
    card.appendChild(canalBox)

    if (fixture.__video !== undefined) {
      // já buscamos antes (jogo sem time grande, incluído por ter
      // transmissão confirmada) — não busca de novo
      if (fixture.__video) {
        renderTransmissao(canalBox, fixture.__video)
      } else {
        canalBox.remove()
      }
    } else {
      canalBox.textContent = "Buscando transmissão…"
      buscarTransmissao(fixture).then((video) => {
        if (!video) {
          canalBox.remove()
          return
        }
        renderTransmissao(canalBox, video)
      })
    }
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
    const res = await fetch(`${API_BASE}/api/fixtures?date=${todayISO()}`, { cache: "no-store" })
    const data = await res.json()

    if (!res.ok || data.error) {
      status.textContent = data.error || "Não deu pra carregar os jogos."
      return
    }

    const principais = (data.fixtures ?? []).filter((f) => f.category === "principais")

    // regra 1: jogos com time grande sempre entram
    const comTimeGrande = principais.filter(envolveTimePrincipal)

    // regra 2: jogos ao vivo sem time grande também entram, mas só se
    // tiverem transmissão confirmada num canal autorizado (senão a lista
    // fica poluída com jogo pequeno que ninguém vai conseguir assistir)
    const semTimeGrandeAoVivo = principais.filter((f) => f.isLive && !envolveTimePrincipal(f))

    await Promise.all(
      semTimeGrandeAoVivo.map(async (f) => {
        f.__video = await buscarTransmissao(f) // guarda pra não buscar de novo no render do card
      }),
    )
    const comTransmissaoExtra = semTimeGrandeAoVivo.filter((f) => f.__video)

    const jogos = [...comTimeGrande, ...comTransmissaoExtra]
      // remove duplicata, caso um jogo já esteja nos dois grupos por algum motivo
      .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i)
      .sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1
        return a.timestamp - b.timestamp
      })

    if (jogos.length === 0) {
      status.textContent = "Nenhum jogo de time principal ou com transmissão agora."
      return
    }

    status.remove()
    renderGrupos(jogos, lista)
  } catch {
    status.textContent = "Não deu pra carregar os jogos."
  }
}

document.getElementById("abrir-site").href = API_BASE

carregarSelecionados().then(() => {
  carregarJogos()
  iniciarSelecaoTimeFavorito()
})

// ---------- Painel "Apoiar" (Pix) ----------

function iniciarPainelApoio() {
  const toggle = document.getElementById("apoiar-toggle")
  const painel = document.getElementById("apoiar-painel")
  const valoresEl = document.getElementById("apoiar-valores")
  const valorLivreEl = document.getElementById("apoiar-valor-livre")
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
        valorLivreEl.value = ""
        renderValores()
        renderPix()
      })
      valoresEl.appendChild(chip)
    }
  }

  valorLivreEl.addEventListener("input", () => {
    const digitado = Number(valorLivreEl.value)
    if (digitado > 0) {
      valorAtual = digitado
      renderValores() // desmarca os chips, já que agora vale o valor digitado
      renderPix()
    }
  })

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

// ---------- Meu time (favorito) ----------

const DIAS_MAX_BUSCA_PROXIMO_JOGO = 14

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

// Busca dia a dia (hoje + próximos DIAS_MAX_BUSCA_PROXIMO_JOGO) até achar
// um jogo do time. Funciona tanto por ID (times da lista rápida) quanto por
// nome (qualquer time, ex.: "Coritiba") — nesse segundo caso, a mesma
// varredura já resolve "quem é esse time" (ID e escudo tirados do próprio
// jogo encontrado) e "qual o próximo jogo dele" de uma vez só.
async function buscarProximoJogoPorId(id) {
  const idNum = Number(id)

  for (let i = 0; i <= DIAS_MAX_BUSCA_PROXIMO_JOGO; i++) {
    const data = new Date()
    data.setDate(data.getDate() + i)
    const dataISO = ymd(data)

    try {
      const res = await fetch(`${API_BASE}/api/fixtures?date=${dataISO}`, { cache: "no-store" })
      if (!res.ok) continue
      const json = await res.json()
      const jogo = (json.fixtures ?? []).find((f) => f.home.id === idNum || f.away.id === idNum)
      if (jogo) return jogo
    } catch {
      continue // um dia falhar não impede de continuar procurando nos próximos
    }
  }

  return null
}

async function ativarNotificacaoAutomatica(jogoId) {
  const chave = String(jogoId)
  const { meuTimeUltimoJogoAutoNotificado } = await chrome.storage.sync.get("meuTimeUltimoJogoAutoNotificado")

  // só força ligado na primeira vez que EsSE jogo específico aparece como
  // "próximo jogo do meu time" — se o usuário desligar o sino manualmente
  // depois, reabrir o popup não liga de novo sozinho
  if (meuTimeUltimoJogoAutoNotificado === chave) return

  if (!jogosSelecionados.has(chave)) {
    jogosSelecionados.add(chave)
    await chrome.storage.sync.set({ jogosSelecionados: Array.from(jogosSelecionados) })
    chrome.runtime.sendMessage({ type: "jogos-selecionados-mudou" })
  }

  await chrome.storage.sync.set({ meuTimeUltimoJogoAutoNotificado: chave })
}

async function atualizarMeuTime() {
  const container = document.getElementById("meu-time-jogo")
  const { timeFavorito } = await chrome.storage.sync.get("timeFavorito")

  if (!timeFavorito) {
    container.innerHTML = ""
    return
  }

  container.innerHTML = ""
  const carregando = document.createElement("p")
  carregando.className = "meu-time__status"
  carregando.textContent = "Procurando o próximo jogo…"
  container.appendChild(carregando)

  const jogo = await buscarProximoJogoPorId(timeFavorito.id)

  container.innerHTML = ""
  if (!jogo) {
    const vazio = document.createElement("p")
    vazio.className = "meu-time__status"
    vazio.textContent = `Nenhum jogo encontrado nos próximos ${DIAS_MAX_BUSCA_PROXIMO_JOGO} dias.`
    container.appendChild(vazio)
    return
  }

  await ativarNotificacaoAutomatica(jogo.id)

  const wrapper = document.createElement("div")
  wrapper.className = "meu-time__jogo"
  wrapper.appendChild(renderCard(jogo))
  container.appendChild(wrapper)
}

function mostrarPerfilTimeFavorito(time) {
  document.getElementById("meu-time-avatar").src = time.logo
  document.getElementById("meu-time-nome").textContent = time.name
  document.getElementById("meu-time-perfil").hidden = false
  document.getElementById("meu-time-busca-wrap").hidden = true
}

function mostrarBuscaTimeFavorito() {
  document.getElementById("meu-time-perfil").hidden = true
  document.getElementById("meu-time-busca-wrap").hidden = false
  const input = document.getElementById("time-favorito-busca")
  input.value = ""
  input.focus()
}

async function definirTimeFavorito(time) {
  await chrome.storage.sync.set({ timeFavorito: time })
  document.getElementById("time-favorito-sugestoes").hidden = true
  mostrarPerfilTimeFavorito(time)
  atualizarMeuTime()
}

function renderSugestoes(lista, painel, textoDigitado) {
  painel.innerHTML = ""

  for (const time of lista) {
    const item = document.createElement("button")
    item.type = "button"
    item.className = "meu-time__sugestao"

    const img = document.createElement("img")
    img.src = time.logo
    img.alt = ""
    img.loading = "lazy"

    const nome = document.createElement("span")
    nome.textContent = time.name

    item.append(img, nome)
    item.addEventListener("click", () => definirTimeFavorito(time))
    painel.appendChild(item)
  }

  if (textoDigitado.trim().length >= 3) {
    const buscar = document.createElement("button")
    buscar.type = "button"
    buscar.className = "meu-time__sugestao meu-time__sugestao--buscar"
    buscar.textContent = `🔍 Buscar "${textoDigitado.trim()}" nos jogos`
    buscar.addEventListener("click", () => buscarEDefinirPorNome(textoDigitado.trim()))
    painel.appendChild(buscar)
  }

  painel.hidden = painel.children.length === 0
}

// Varre os próximos dias coletando TODOS os times distintos cujo nome bate
// com o texto buscado (não só o primeiro jogo encontrado) — evita
// confirmar sozinho um time errado quando a busca é ambígua (ex.: "Madrid"
// bate em Real Madrid E Atlético de Madrid; "Paraná" bate em Paraná Clube
// E Athletico Paranaense).
async function buscarTimesPorNome(nomeDigitado) {
  try {
    const res = await fetch(`${API_BASE}/api/teams?search=${encodeURIComponent(nomeDigitado)}`, {
      cache: "no-store",
    })
    if (!res.ok) return []
    const json = await res.json()
    return (json.teams ?? []).slice(0, 8)
  } catch {
    return []
  }
}

async function buscarEDefinirPorNome(nomeDigitado) {
  const painel = document.getElementById("time-favorito-sugestoes")
  painel.innerHTML = '<p class="meu-time__status">Procurando "' + nomeDigitado + '"…</p>'
  painel.hidden = false

  const candidatos = await buscarTimesPorNome(nomeDigitado)

  if (candidatos.length === 0) {
    painel.innerHTML = `<p class="meu-time__status">Não achei nenhum time chamado "${nomeDigitado}". Confira a grafia.</p>`
    return
  }

  if (candidatos.length === 1) {
    // só um time bate com o texto — pode confirmar direto
    await definirTimeFavorito(candidatos[0])
    return
  }

  // mais de um time bate (ex.: "Madrid") — mostra pra escolher, não
  // seleciona sozinho
  renderSugestoes(candidatos, painel, "")
}

function iniciarSelecaoTimeFavorito() {
  const input = document.getElementById("time-favorito-busca")
  const painel = document.getElementById("time-favorito-sugestoes")
  const trocarBtn = document.getElementById("meu-time-trocar")

  chrome.storage.sync.get("timeFavorito").then(({ timeFavorito }) => {
    if (timeFavorito) {
      mostrarPerfilTimeFavorito(timeFavorito)
    }
    atualizarMeuTime()
  })

  trocarBtn.addEventListener("click", mostrarBuscaTimeFavorito)

  input.addEventListener("input", () => {
    const texto = input.value
    if (texto.trim().length === 0) {
      painel.hidden = true
      return
    }

    const textoNorm = normalizarTexto(texto)
    const encontrados = MAIN_TEAMS.filter((t) => normalizarTexto(t.name).includes(textoNorm)).slice(0, 6)
    renderSugestoes(encontrados, painel, texto)
  })

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim().length >= 3) {
      buscarEDefinirPorNome(input.value.trim())
    }
  })

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".meu-time__busca")) painel.hidden = true
  })
}
