import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ExtensionsManager } from "@/components/extensions/ExtensionsManager";
import { OrientacoesInstaladas } from "@/components/extensions/OrientacoesInstaladas";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { loadCrmExtensions } from "@/lib/extensions/service";
import type { ExtensionGuideView } from "@/lib/extensions/view";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Extensões" };

export default async function ExtensionsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  let extensionGuides: ExtensionGuideView[] = [];
  let extensionsUnavailable = false;
  try {
    extensionGuides = await loadCrmExtensions(activeOrg.orgId);
  } catch (error) {
    // A gestão continua útil sem os cartões; a falha precisa ser distinguível de uma lista vazia.
    const code = (error as { code?: unknown } | null)?.code;
    logger.warn("[extensions] página aberta sem as orientações instaladas", {
      organization_id: activeOrg.orgId,
      error_code: typeof code === "string" ? code : null,
    });
    extensionsUnavailable = true;
  }

  return (
    <>
      <div className="px-6 pt-6">
        <OrientacoesInstaladas
          extensionGuides={extensionGuides}
          extensionsUnavailable={extensionsUnavailable}
          locale={user.idioma}
        />
      </div>
      <ExtensionsManager
        key={activeOrg.orgId}
        organizationId={activeOrg.orgId}
        actorId={user.id}
        supportMode={Boolean(user.support)}
      />
    </>
  );
}
