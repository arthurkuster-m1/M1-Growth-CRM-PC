import type { ReactNode } from "react";

import type { ModuloDaEstrategia } from "@/lib/marketing/modulos";
import {
  Binoculars,
  Briefcase,
  Compass,
  Eye,
  Funnel,
  Handshake,
  InstagramLogo,
  Lightbulb,
  Magnet,
  Megaphone,
  Package,
  Palette,
  Rocket,
  ShareNetwork,
  Target,
  UsersThree,
} from "@/lib/ui/icons";

const ICONES: Record<ModuloDaEstrategia["icone"], typeof Rocket> = {
  Rocket,
  Funnel,
  Compass,
  Eye,
  Palette,
  UsersThree,
  Binoculars,
  Briefcase,
  Package,
  Magnet,
  Lightbulb,
  Target,
  Megaphone,
  Handshake,
  ShareNetwork,
  InstagramLogo,
};

/** O ícone de um módulo, no tamanho pedido. */
export function iconeDoModulo(nome: ModuloDaEstrategia["icone"], size = 20): ReactNode {
  const Icone = ICONES[nome];
  return <Icone size={size} weight="duotone" aria-hidden />;
}
