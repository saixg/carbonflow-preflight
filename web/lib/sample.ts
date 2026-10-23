// SAMPLE DATA ONLY. Used to preview screens that need documents, extraction and rule runs,
// which are not built yet. Every screen that imports this must render <SampleBanner />.

export type Severity = "critical" | "material" | "minor";
export type FindingStatus = "open" | "acknowledged" | "resolved";

export type SampleFinding = {
  id: string;
  rule: string;
  severity: Severity;
  status: FindingStatus;
  title: string;
  detail: string;
  sources: number;
  remediation: string;
};

export const sampleFindings: SampleFinding[] = [
  {
    id: "f1", rule: "CALC-001", severity: "critical", status: "open",
    title: "Net electricity export mismatch",
    detail: "The net electricity exported in the monitoring report (152,345 MWh) does not match the sum of monthly meter readings (149,120 MWh).",
    sources: 3, remediation: "Reconcile the report total with the monthly meter log and correct whichever figure is wrong.",
  },
  {
    id: "f2", rule: "DATE-004", severity: "critical", status: "open",
    title: "Gap in meter data coverage",
    detail: "No readings were found for 14 to 19 March 2023. Monitoring periods must be covered without gaps.",
    sources: 2, remediation: "Attach the missing readings or document the outage with supporting evidence.",
  },
  {
    id: "f3", rule: "DOC-002", severity: "critical", status: "acknowledged",
    title: "Calibration certificate expired",
    detail: "The meter calibration certificate expired on 30 September 2023, before the end of the monitoring period.",
    sources: 1, remediation: "Provide a valid certificate covering the full period.",
  },
  {
    id: "f4", rule: "UNIT-003", severity: "material", status: "open",
    title: "Unit inconsistency in emission factor",
    detail: "The grid emission factor is reported as 0.82 t/MWh in one table and 820 kg/MWh in another. Values agree once converted.",
    sources: 2, remediation: "Use one unit across the report and state the conversion.",
  },
  {
    id: "f5", rule: "CONS-007", severity: "material", status: "open",
    title: "Installed capacity differs between documents",
    detail: "The monitoring report states 100 MW, the PPA states 98.5 MW.",
    sources: 2, remediation: "Confirm the as-built capacity and align both documents.",
  },
  {
    id: "f6", rule: "DOC-009", severity: "material", status: "resolved",
    title: "Stakeholder consultation record undated",
    detail: "The consultation record does not show a date, so it cannot be tied to the monitoring period.",
    sources: 1, remediation: "Add the consultation date and signatory.",
  },
  {
    id: "f7", rule: "PLAU-002", severity: "material", status: "open",
    title: "Capacity factor above plausible range",
    detail: "The implied capacity factor is higher than the configured upper bound for this project type. Confirm the generation figure.",
    sources: 2, remediation: "Check generation data for double counting.",
  },
  {
    id: "f8", rule: "DOC-011", severity: "material", status: "open",
    title: "Report version not recorded",
    detail: "The monitoring report has no version number or issue date on its cover page.",
    sources: 1, remediation: "Add document control details.",
  },
  {
    id: "f9", rule: "FMT-001", severity: "minor", status: "open",
    title: "Inconsistent date format",
    detail: "Dates appear as DD/MM/YYYY and YYYY-MM-DD in the same report.",
    sources: 1, remediation: "Standardize to one format.",
  },
  {
    id: "f10", rule: "FMT-004", severity: "minor", status: "open",
    title: "Missing figure caption",
    detail: "Figure 3 has no caption or source note.",
    sources: 1, remediation: "Add a caption with the data source.",
  },
];

export const sampleExtracted = [
  { id: "x1", label: "Net electricity exported", value: "152,345", unit: "MWh", confidence: 0.95, page: 12, tier: "high", key: "152,345 MWh" },
  { id: "x2", label: "Monitoring period start", value: "01 Jan 2023", unit: "", confidence: 0.98, page: 3, tier: "high", key: "01 January 2023" },
  { id: "x3", label: "Monitoring period end", value: "31 Dec 2023", unit: "", confidence: 0.98, page: 3, tier: "high", key: "31 December 2023" },
  { id: "x4", label: "Installed capacity", value: "100", unit: "MW", confidence: 0.71, page: 5, tier: "review", key: "100 MW" },
  { id: "x5", label: "Grid emission factor", value: "0.82", unit: "tCO2/MWh", confidence: 0.93, page: 14, tier: "high", key: "0.82 tCO2/MWh" },
] as const;

export const sampleRun = {
  number: 4,
  when: "12 Jun 2024, 14:32",
  methodology: "Sample methodology",
  rulepack: "sample-rules v0.2",
  engine: "engine v0.1",
  passed: 41,
  total: 52,
};

export const sampleDocs = [
  { name: "Monitoring_Report_2023.pdf", type: "PDF", size: "4.2 MB", status: "Processed", at: "12 Jun 2024, 10:24" },
  { name: "Meter_Readings_Jan-Dec.xlsx", type: "Excel", size: "1.1 MB", status: "Processing", at: "12 Jun 2024, 09:11" },
  { name: "PPA_Agreement.pdf", type: "PDF", size: "2.8 MB", status: "Processed", at: "11 Jun 2024, 16:03" },
  { name: "Site_Photos.zip", type: "ZIP", size: "48 MB", status: "Queued", at: "11 Jun 2024, 15:20" },
];

export const sampleTrend = [3, 5, 4, 8, 7, 12, 11, 15, 14, 19];
