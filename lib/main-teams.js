// Mesma lista de times do site (repositório meus-jogos, lib/config.ts,
// MAIN_TEAM_IDS). Se adicionar/tirar um time lá, espelhe aqui também —
// são repositórios separados, não dá pra importar direto.
export const MAIN_TEAMS = [
  // Brasil
  { id: 127, name: "Flamengo" },
  { id: 121, name: "Palmeiras" },
  { id: 131, name: "Corinthians" },
  { id: 126, name: "São Paulo" },
  { id: 124, name: "Fluminense" },
  { id: 133, name: "Vasco" },
  { id: 120, name: "Botafogo" },
  { id: 130, name: "Grêmio" },
  { id: 119, name: "Internacional" },
  { id: 1062, name: "Atlético-MG" },
  { id: 128, name: "Santos" },
  { id: 134, name: "Cruzeiro" },
  { id: 118, name: "Bahia" },
  { id: 794, name: "Athletico-PR" },
  { id: 144, name: "Fortaleza" },
  // Europa
  { id: 541, name: "Real Madrid" },
  { id: 529, name: "Barcelona" },
  { id: 530, name: "Atlético de Madrid" },
  { id: 50, name: "Manchester City" },
  { id: 33, name: "Manchester United" },
  { id: 40, name: "Liverpool" },
  { id: 42, name: "Arsenal" },
  { id: 49, name: "Chelsea" },
  { id: 47, name: "Tottenham" },
  { id: 157, name: "Bayern de Munique" },
  { id: 165, name: "Borussia Dortmund" },
  { id: 85, name: "Paris Saint-Germain" },
  { id: 496, name: "Juventus" },
  { id: 505, name: "Inter de Milão" },
  { id: 489, name: "AC Milan" },
  { id: 492, name: "Napoli" },
  { id: 212, name: "FC Porto" },
]

export const MAIN_TEAM_IDS = new Set(MAIN_TEAMS.map((t) => t.id))
