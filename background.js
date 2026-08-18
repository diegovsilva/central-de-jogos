import { API_BASE, POLL_ALARM_NAME, POLL_PERIOD_MINUTES } from "./config.js"

const FINALIZADOS = new Set(["FT", "AET", "PEN"])

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

async function checarPlacares() {
  try {
    const { jogosSelecionados = [] } = await chrome.storage.sync.get("jogosSelecionados")
    if (jogosSelecionados.length === 0) {
      await chrome.action.setBadgeText({ text: "" })
      return
    }

    const selecionadosSet = new Set(jogosSelecionados.map(String))

    const res = await fetch(`${API_BASE}/api/fixtures?date=${todayISO()}`, { cache: "no-store" })
    if (!res.ok) return

    const data = await res.json()
    const fixtures = data.fixtures ?? []

    // só os jogos que a pessoa marcou pra notificar, e que existem hoje
    const selecionados = fixtures.filter((f) => selecionadosSet.has(String(f.id)))
    const selecionadosAoVivo = selecionados.filter((f) => f.isLive)

    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" })
    await chrome.action.setBadgeText({ text: selecionadosAoVivo.length > 0 ? String(selecionadosAoVivo.length) : "" })

    const { ultimosPlacares = {} } = await chrome.storage.local.get("ultimosPlacares")
    const novosPlacares = { ...ultimosPlacares }

    for (const fixture of selecionadosAoVivo) {
      const chave = String(fixture.id)
      const anterior = ultimosPlacares[chave]
      const atual = `${fixture.home.goals ?? 0}-${fixture.away.goals ?? 0}`

      // só notifica quando já tínhamos visto esse jogo antes E o placar mudou
      // (evita notificar tudo de uma vez quando a extensão liga no meio do jogo)
      if (anterior !== undefined && anterior !== atual) {
        chrome.notifications.create(`jogo-${chave}`, {
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: `${fixture.home.name} ${fixture.home.goals ?? 0} x ${fixture.away.goals ?? 0} ${fixture.away.name}`,
          message: `${fixture.league.name} · ${fixture.elapsed ?? 0}'`,
          priority: 2,
        })
      }

      novosPlacares[chave] = atual
    }

    // limpeza: tira da lista de selecionados os jogos que já terminaram,
    // pra não ficar acumulando pra sempre
    const finalizados = selecionados.filter((f) => FINALIZADOS.has(f.statusShort)).map((f) => String(f.id))
    if (finalizados.length > 0) {
      const restantes = jogosSelecionados.filter((id) => !finalizados.includes(String(id)))
      await chrome.storage.sync.set({ jogosSelecionados: restantes })
      for (const chave of finalizados) delete novosPlacares[chave]
    }

    await chrome.storage.local.set({ ultimosPlacares: novosPlacares })
  } catch (err) {
    console.warn("[central-de-jogos] falha ao checar placares:", err)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: POLL_PERIOD_MINUTES })
  checarPlacares()
})

chrome.runtime.onStartup.addListener(() => {
  checarPlacares()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM_NAME) checarPlacares()
})

// o popup dispara isso assim que a pessoa liga/desliga a notificação de um
// jogo, pra badge e placar-base atualizarem na hora (sem esperar 1 minuto)
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "jogos-selecionados-mudou") {
    checarPlacares()
  }
})

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: API_BASE })
})
