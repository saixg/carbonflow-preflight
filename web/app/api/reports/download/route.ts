import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/context";
import { sampleDocs, sampleFindings, sampleRun } from "@/lib/sample";
import {
  buildEvidenceManifest,
  canonicalJsonHash,
  createEvidencePackageZip,
  generateCsvWorkbook,
  generateMarkdownReport,
  type ReportDocument,
  type ReportFinding,
} from "@/lib/reports";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId") || "sample";
  const format = (searchParams.get("format") || "zip").toLowerCase();

  let manifest;

  if (runId === "sample") {
    // Generate manifest from rich sample data
    const docs: ReportDocument[] = sampleDocs.map((d, i) => ({
      id: `doc-${i + 1}`,
      name: d.name,
      sha256: `a${i}b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef${i}`,
      media_type: d.type === "PDF" ? "application/pdf" : d.type === "Excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/zip",
      page_count: d.type === "PDF" ? 18 : undefined,
    }));

    const findings: ReportFinding[] = sampleFindings.map((f) => ({
      id: f.id,
      rule_code: f.rule,
      severity: f.severity,
      status: f.status,
      title: f.title,
      detail: f.detail,
      remediation: f.remediation,
      quotes: [`Extracted source evidence matching rule ${f.rule}`],
      review_comment: f.review_comment || (f.status === "resolved" ? "Reconciled with utility meter records." : undefined),
    }));

    manifest = buildEvidenceManifest({
      run_id: `run-sample-#${sampleRun.number}`,
      project_id: "proj-sample-01",
      monitoring_period_id: "period-sample-2023",
      org_id: "org-sample",
      project_name: "Gujarat Solar 100MW Grid Connected Project",
      methodology: `${sampleRun.methodology} (${sampleRun.rulepack})`,
      documents: docs,
      findings,
    });
  } else {
    // Live database run
    const { supabase, org, guest } = await getSession();
    if (guest || !org) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: run, error: runErr } = await supabase
      .from("runs")
      .select("id, project_id, monitoring_period_id, org_id, methodology_code, methodology_version, status, projects(name)")
      .eq("id", runId)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Fetch findings with their reviews
    const { data: rawFindings } = await supabase
      .from("findings")
      .select("id, rule_code, severity, status, title, explanation, remediation")
      .eq("run_id", runId);

    const findingList = rawFindings || [];

    // Fetch documents linked to period
    const { data: rawDocs } = await supabase
      .from("documents")
      .select("id, filename, media_type, sha256")
      .eq("monitoring_period_id", run.monitoring_period_id);

    const docList: ReportDocument[] = (rawDocs || []).map((d) => ({
      id: d.id,
      name: d.filename,
      sha256: d.sha256,
      media_type: d.media_type,
    }));

    const prName = Array.isArray(run.projects) ? run.projects[0]?.name : (run.projects as { name?: string })?.name;

    manifest = buildEvidenceManifest({
      run_id: run.id,
      project_id: run.project_id,
      monitoring_period_id: run.monitoring_period_id,
      org_id: run.org_id,
      project_name: prName || "Carbon Project",
      methodology: run.methodology_code ? `${run.methodology_code} ${run.methodology_version || ""}`.trim() : undefined,
      documents: docList,
      findings: findingList.map((f) => ({
        id: f.id,
        rule_code: f.rule_code,
        severity: f.severity,
        status: f.status,
        title: f.title,
        detail: f.explanation,
        remediation: f.remediation ?? undefined,
      })),
    });
  }

  // Handle format exports
  if (format === "markdown") {
    const md = generateMarkdownReport(manifest);
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="preflight_report_${runId}.md"`,
      },
    });
  }

  if (format === "csv") {
    const csv = generateCsvWorkbook(manifest);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="findings_workbook_${runId}.csv"`,
      },
    });
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="manifest_${runId}.json"`,
      },
    });
  }

  // Default: ZIP package bundle
  const zipBuffer = await createEvidencePackageZip(manifest);
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evidence_package_${runId}.zip"`,
    },
  });
}
