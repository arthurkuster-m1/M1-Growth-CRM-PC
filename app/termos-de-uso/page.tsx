import type { Metadata } from "next";

import TermsPage from "../legal/terms/page";

// Endereço em português da mesma página. `dynamic` e `metadata` ficam declarados aqui: o Next
// não aceita reexportá-los.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Termos de Uso" };

export default TermsPage;
