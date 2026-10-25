/**
 * O ÁUDIO GRAVADO de uma abordagem (migration 0667): um arquivo de voz que a pessoa grava uma vez
 * e reaproveita nos passos de áudio de qualquer abordagem. O arquivo mora no bucket privado
 * `whatsapp-media`, na pasta `<org>/audios-da-abordagem/`; no envio ele é copiado para a pasta da
 * conversa (é lá que o envio de mídia exige que ele esteja).
 */
export const BUCKET_DOS_AUDIOS = "whatsapp-media";
export const PASTA_DOS_AUDIOS = "audios-da-abordagem";
export const TAMANHO_MAXIMO_DO_AUDIO = 8 * 1024 * 1024;

/** O caminho do arquivo da biblioteca. O nome é um uuid: saber a organização não dá o caminho. */
export function caminhoDoAudio(organizationId: string, audioId: string, mime: string): string {
  return `${organizationId}/${PASTA_DOS_AUDIOS}/${audioId}.${extensaoDoAudio(mime)}`;
}

/** O caminho da cópia na pasta da conversa — o formato que o envio de mídia reconhece. */
export function caminhoNaConversa(
  organizationId: string,
  conversationId: string,
  mensagemId: string,
  mime: string,
): string {
  return `${organizationId}/${conversationId}/${mensagemId}.${extensaoDoAudio(mime)}`;
}

/**
 * Ogg com Opus: o que a API oficial exige (`audio/ogg` puro, sem o codec, é recusado) e o que o
 * navegador grava quando passa pela conversão do upload. A mesma string de `VOICE_MIME`.
 */
export const MIME_OGG_OPUS = "audio/ogg;codecs=opus";

const EXTENSAO: Record<string, string> = {
  "audio/ogg": "ogg",
  [MIME_OGG_OPUS]: "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/aac": "aac",
  "audio/amr": "amr",
};

export function extensaoDoAudio(mime: string): string {
  return EXTENSAO[mime] ?? "bin";
}

/**
 * Descobre o tipo pelos BYTES, nunca pelo `Content-Type` que o cliente mandou. Devolve null para
 * o que não é áudio que o WhatsApp aceite.
 */
export function farejarAudio(b: Uint8Array): string | null {
  const ascii = (de: number, ate: number) => String.fromCharCode(...b.slice(de, ate));
  if (b.length < 12) return null;
  if (ascii(0, 4) === "OggS") {
    // O cabeçalho do primeiro pacote diz o codec: só Opus serve ao WhatsApp oficial.
    return ascii(0, Math.min(b.length, 128)).includes("OpusHead") ? MIME_OGG_OPUS : "audio/ogg";
  }
  // ADTS (AAC): sincronia 0xFFF e camada 00. Vem antes do MP3, que usa a camada 01/10/11.
  if (b[0] === 0xff && (b[1]! & 0xf6) === 0xf0) return "audio/aac";
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (ascii(0, 5) === "#!AMR") return "audio/amr";
  return null;
}

/** O nome que a pessoa vê: sem extensão, sem espaços sobrando, no máximo 120 caracteres. */
export function nomeDoAudio(bruto: string): string {
  return bruto
    .trim()
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Os formatos que a API oficial (Meta) não aceita como áudio (ogg só serve com Opus). O upload os guarda — o número não
 * oficial os envia —, mas o envio por canal oficial é recusado antes, com a explicação.
 */
const FORMATOS_SEM_CANAL_OFICIAL = new Set(["audio/wav", "audio/webm", "audio/ogg"]);

export function aceitoNoCanalOficial(mime: string): boolean {
  return !FORMATOS_SEM_CANAL_OFICIAL.has(mime);
}

export const AVISO_DO_FORMATO_NO_CANAL_OFICIAL =
  "A API oficial não envia áudio em wav, webm ou ogg que não seja Opus. Envie de novo o arquivo em ogg (Opus), mp3, m4a, aac ou amr, ou use um número não oficial.";
