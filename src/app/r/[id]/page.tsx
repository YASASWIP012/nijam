import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { loadReport } from "@/lib/store";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) notFound();
  return (
    <main className="report">
      <div className="container">
        <ReportView report={report} />
      </div>
    </main>
  );
}
