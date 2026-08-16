import { API_BASE, POLL_ALARM_NAME, POLL_PERIOD_MINUTES } from "./config.js"

function todayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildScoreMap(fixtures) {
  const map = {}
  for (const f of fixtures) map[String(f.id)] = `${f.home.goals ?? 0}-${f.away.goals ?? 0}`
  return map
}

async function checarPlacares() {
  try {
    const res = await fetch(`${API_BASE}/api/fixtures?date=${todayISO()}`)
    if (!res.ok) return

    const data = await res.json()
    const principais = (data.fixtures ?? []).filter((f) => f.category === "principais")
    const aoVivo = principais.filter((f) => f.isLive)

    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" })
    await chrome.action.setBadgeText({ text: aoVivo.length > 0 ? String(aoVivo.length) : "" })

    const { notificacoesAtivas = true } = await chrome.storage.sync.get("notificacoesAtivas")
    const novosPlacares = buildScoreMap(aoVivo)

    if (notificacoesAtivas) {
      const { ultimosPlacares = {} } = await chrome.storage.local.get("ultimosPlacares")

      for (const fixture of aoVivo) {
        const chave = String(fixture.id)
        const anterior = ultimosPlacares[chave]
        const atual = novosPlacares[chave]

        // só notifica quando já tínhamos visto esse jogo antes E o placar mudou
        // (evita notificar tudo de uma vez quando a extensão liga no meio de vários jogos)
        if (anterior !== undefined && anterior !== atual) {
          chrome.notifications.create(`jogo-${chave}`, {
            type: "basic",
            iconUrl: "icons/icon-128.png",
            title: `${fixture.home.name} ${fixture.home.goals ?? 0} x ${fixture.away.goals ?? 0} ${fixture.away.name}`,
            message: `${fixture.league.name} · ${fixture.elapsed ?? 0}'`,
            priority: 2,
          })
        }
      }
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

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: API_BASE })
})
