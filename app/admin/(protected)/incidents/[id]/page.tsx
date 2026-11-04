import { IncidentDetailClient } from "./_client";

export const metadata = { title: "Detalhe do Incidente — Modo agência" };

export default async function AdminIncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IncidentDetailClient id={id} />;
}
