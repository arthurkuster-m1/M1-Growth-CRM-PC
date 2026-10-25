// @vitest-environment node
import { describe, expect, it } from "vitest";

import { caminhoDoAudio, caminhoNaConversa, farejarAudio, nomeDoAudio } from "./audio-da-abordagem";

const bytes = (...b: number[]) => Uint8Array.from([...b, ...new Array(16).fill(0)]);
const texto = (t: string, deslocamento = 0) =>
  Uint8Array.from([
    ...new Array(deslocamento).fill(0),
    ...[...t].map((c) => c.charCodeAt(0)),
    ...new Array(16).fill(0),
  ]);

describe("farejarAudio", () => {
  it("reconhece os formatos pelos bytes", () => {
    expect(farejarAudio(texto("OggS"))).toBe("audio/ogg");
    expect(farejarAudio(texto("ID3"))).toBe("audio/mpeg");
    expect(farejarAudio(bytes(0xff, 0xfb))).toBe("audio/mpeg");
    expect(farejarAudio(bytes(0xff, 0xf1))).toBe("audio/aac");
    expect(farejarAudio(texto("ftypM4A ", 4))).toBe("audio/mp4");
    expect(
      farejarAudio(
        Uint8Array.from([...texto("RIFF").slice(0, 8), ...texto("WAVE").slice(0, 4), 0, 0, 0, 0]),
      ),
    ).toBe("audio/wav");
    expect(farejarAudio(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("audio/webm");
    expect(farejarAudio(texto("#!AMR\n"))).toBe("audio/amr");
  });

  it("recusa o que não é áudio, mesmo com nome de áudio", () => {
    expect(farejarAudio(texto("%PDF-1.7"))).toBeNull();
    expect(farejarAudio(texto("MZ"))).toBeNull();
    expect(farejarAudio(Uint8Array.from([1, 2, 3]))).toBeNull();
  });
});

describe("caminhos e nome", () => {
  it("o arquivo da biblioteca fica na pasta própria da organização", () => {
    expect(caminhoDoAudio("org", "id", "audio/ogg")).toBe("org/audios-da-abordagem/id.ogg");
  });

  it("a cópia da conversa segue o formato que o envio de mídia exige", () => {
    expect(caminhoNaConversa("org", "conv", "msg", "audio/mpeg")).toBe("org/conv/msg.mp3");
  });

  it("o nome perde a extensão e os espaços sobrando", () => {
    expect(nomeDoAudio("  Minha   apresentação.ogg ")).toBe("Minha apresentação");
    expect(nomeDoAudio("x".repeat(300)).length).toBe(120);
  });
});
