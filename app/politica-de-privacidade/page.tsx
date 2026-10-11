import type { Metadata } from "next";

import PrivacyPage from "../legal/privacy/page";

// Endereço em português da mesma página (o que se cadastra em formulários, como o do Google).
// `dynamic` e `metadata` ficam declarados aqui: o Next não aceita reexportá-los.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de Privacidade" };

export default PrivacyPage;
