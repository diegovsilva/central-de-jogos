// Gera o código "PIX copia e cola" (padrão BR Code / EMV-MPM do Banco
// Central) inteiramente no navegador — sem nenhuma chamada de rede, exigido
// pela política do Chrome Manifest V3 de não rodar código remoto.
//
// Referência do padrão (público): manual "BR Code" do Bacen / EMVCo QR
// Code Specification for Payment Systems (Merchant-Presented Mode).
//
// Pra trocar quem recebe: edite as três constantes abaixo. Nome e cidade
// precisam ser ASCII maiúsculo, sem acento (nome até 25 caracteres, cidade
// até 15).

export const PIX_KEY = "e69ead6d-b56c-4161-9da2-ee2061858338"
export const MERCHANT_NAME = "DIEGO VIEIRA DA SILVA"
export const MERCHANT_CITY = "S J DOS PINHAIS"

export const PIX_AMOUNTS = [5, 10, 20, 50]
export const PIX_DEFAULT_AMOUNT = 10

// Um campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor.
function campo(id, valor) {
  return id + String(valor.length).padStart(2, "0") + valor
}

// CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF) sobre o
// payload inteiro (incluindo a tag "6304"), como 4 dígitos hexadecimais
// maiúsculos — exatamente como o padrão BR Code exige.
export function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

/**
 * Monta o "copia e cola" completo. Passe um valor positivo pra travar o
 * valor da doação, ou 0/undefined pra deixar aberto (quem paga digita no
 * próprio app do banco).
 */
export function buildPixCode(amount) {
  const merchantAccountInfo = campo("00", "br.gov.bcb.pix") + campo("01", PIX_KEY)
  const temValor = Number.isFinite(amount) && amount > 0 && amount < 1e9

  const corpo =
    campo("00", "01") + // Payload Format Indicator
    campo("26", merchantAccountInfo) + // Informações da conta (Pix)
    campo("52", "0000") + // Merchant Category Code
    campo("53", "986") + // Moeda = BRL
    (temValor ? campo("54", amount.toFixed(2)) : "") + // Valor da transação
    campo("58", "BR") + // País
    campo("59", MERCHANT_NAME) + // Nome de quem recebe
    campo("60", MERCHANT_CITY) + // Cidade de quem recebe
    campo("62", campo("05", "***")) + // Dados adicionais (txid = ***)
    "6304" // tag + tamanho do CRC

  return corpo + crc16(corpo)
}
