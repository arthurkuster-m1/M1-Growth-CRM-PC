import type { AcaoDoAviso } from "./aviso-pessoal";
import { NOTIFY_KINDS, type NotifyKind } from "./kinds";
import { areAlertsEnabled, getPermission } from "./permission";
import { ensureNotifyServiceWorker } from "./service_worker";
import { playSound, type SoundId } from "./sounds";

const BODY_MAX = 140;

export interface EmitNotificationInput {
  kind: NotifyKind;
  title: string;
  body: string;
  tag?: string;
  href?: string;
  /** Botões da notificação (só o service worker sabe desenhá-los). */
  acoes?: AcaoDoAviso[];
  icon?: string;
  sound?: SoundId;
  force?: boolean;
}

export function truncateNotifyBody(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= BODY_MAX) return t;
  return `${t.slice(0, BODY_MAX - 1)}…`;
}

function absUrl(path: string): string {
  if (!path) return "";
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

/**
 * `new Notification()` é o que o Chrome desenha na bandeja; `silent: false`
 * usa o som do SO (AudioContext some com a aba oculta). Se o construtor falha,
 * cai no `showNotification` do service worker.
 */
export function emitNotification(input: EmitNotificationInput): void {
  if (typeof window === "undefined") return;
  const perm = getPermission();
  const enabled = areAlertsEnabled();
  if (!input.force && !enabled) return;
  if (perm !== "granted") return;

  const spec = NOTIFY_KINDS[input.kind];
  const sound = input.sound ?? spec.sound;
  const body = truncateNotifyBody(input.body);
  const tag = input.tag ? `${spec.tagPrefix}:${input.tag}` : `${spec.tagPrefix}:${Date.now()}`;
  // `icon` = a imagem colorida grande (o ícone do app); `badge` = a SILHUETA para a barra de status
  // (o Android usa só a transparência: o ícone colorido virava um quadrado branco).
  const icon = absUrl(input.icon || "/app-icon/192");
  const badge = absUrl("/notification-badge");
  const href = input.href ? absUrl(input.href) : "";
  const acoes = (input.acoes ?? [])
    .slice(0, 2)
    .map((a) => ({ rotulo: a.rotulo, href: absUrl(a.href) }));
  const opts: NotificationOptions & {
    renotify?: boolean;
    actions?: Array<{ action: string; title: string }>;
  } = {
    body,
    tag,
    silent: false,
    renotify: true,
    icon,
    badge,
    data: { href, acoes },
  };

  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    try {
      playSound(sound, 1.0);
    } catch {
      // AudioContext recusa
    }
  }

  // Com botões, só o service worker desenha (`new Notification` recusa `actions`).
  if (acoes.length > 0) {
    void showInOsTray(input.title, {
      ...opts,
      actions: acoes.map((a, i) => ({ action: `acao-${i}`, title: a.rotulo })),
    } as NotificationOptions);
    return;
  }

  try {
    const n = new Notification(input.title, opts);
    n.onclick = () => {
      window.focus();
      if (href) window.location.assign(href);
      n.close();
    };
  } catch {
    void showInOsTray(input.title, opts);
  }
}

async function showInOsTray(title: string, opts: NotificationOptions): Promise<void> {
  const reg = await ensureNotifyServiceWorker();
  const ready =
    typeof navigator !== "undefined" && navigator.serviceWorker
      ? await navigator.serviceWorker.ready.catch(() => null)
      : null;
  const alvo = ready ?? reg;
  if (!alvo) return;
  try {
    await alvo.showNotification(title, opts);
  } catch {
    // SW indisponível
  }
}
