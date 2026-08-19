import { InvestigationDetail } from "@/components/investigations/investigation-detail";

export default async function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvestigationDetail id={id} />;
}
