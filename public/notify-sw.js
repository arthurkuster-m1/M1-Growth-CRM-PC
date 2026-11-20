self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "show-os-notify") return;
  const title = event.data.title || "";
  const opts = event.data.opts || {};
  event.waitUntil(self.registration.showNotification(title, opts));
});

/*
 * Toque na notificação: abre o destino principal (o primeiro botão).
 * Toque num botão: abre o link daquele botão (`data.acoes[i]`, ação "acao-<i>").
 * Foca uma janela do CRM já aberta em vez de abrir outra.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let href = data.href || "";
  const m = /^acao-(\d)$/.exec(event.action || "");
  if (m && Array.isArray(data.acoes) && data.acoes[Number(m[1])]) {
    href = data.acoes[Number(m[1])].href || href;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      const origem = self.location.origin;
      const url = href ? new URL(href, origem).href : origem + "/app/inbox";
      const alvo = clientes.find((c) => "focus" in c);
      if (alvo) {
        return alvo.focus().then(() => {
          if ("navigate" in alvo) return alvo.navigate(url);
          alvo.postMessage({ type: "notify-open", href: url });
        });
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      // Com o CRM visível, quem avisa é a própria tela (o aviso no canto); o celular fica quieto.
      const clientes = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visiveis = clientes.filter((c) => c.visibilityState === "visible").length;
      if (visiveis > 0) return;
      let data = {
        title: "Nova notificação",
        body: "",
        tag: "aviso",
        href: "/app/inbox",
        icon: "",
        acoes: [],
      };
      try {
        if (event.data) data = { ...data, ...event.data.json() };
      } catch {
        // payload não-JSON
      }
      const acoes = Array.isArray(data.acoes) ? data.acoes.slice(0, 2) : [];
      await self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: data.icon || self.location.origin + "/app-icon/192",
        badge: self.location.origin + "/notification-badge",
        renotify: true,
        actions: acoes.map((a, i) => ({ action: "acao-" + i, title: a.rotulo })),
        data: { href: data.href || (acoes[0] && acoes[0].href) || "/app/inbox", acoes },
      });
    })(),
  );
});
