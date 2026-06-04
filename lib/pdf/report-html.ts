import { reportStyles } from "./report-styles";

export type ReportChecklistItem = {
  id: string;
  label: string;
  score: string;
  remarks: string;
  hasBeforePhoto: boolean;
  hasAfterPhoto: boolean;
};

export type ReportSection = {
  code: string;
  name: string;
  items: ReportChecklistItem[];
};

export type ReportPhotoEvidence = {
  id: string;
  itemLabel: string;
  photoType: string;
  capturedAt: string;
  gps: string;
  imageUrl: string;
};

export type InspectionReportData = {
  title: string;
  vesselName: string;
  inspectionDate: string;
  place: string;
  inspectorName: string;
  scoreLegend: Array<{ score: string; label: string }>;
  summary: {
    totalItems: number;
    completedItems: number;
    scoreDistribution: Array<{ score: string; count: number }>;
    findingsCount: number;
    drydockCount: number;
  };
  findings: Array<{ itemLabel: string; score: string; remarks: string }>;
  drydockItems: Array<{ itemLabel: string; remarks: string }>;
  sections: ReportSection[];
  photos: ReportPhotoEvidence[];
  runningHours: Array<{ equipment: string; value: string }>;
  otherComments: string;
  generatedAt: string;
  reportVersion: string;
  checksum: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function empty(value: string, fallback = "-") {
  return value.trim() ? value : fallback;
}

function rows<T>(
  entries: T[],
  render: (entry: T) => string,
  emptyMessage: string,
  colSpan: number,
) {
  if (entries.length === 0) {
    return `<tr><td colspan="${colSpan}">${escapeHtml(emptyMessage)}</td></tr>`;
  }

  return entries.map(render).join("");
}

export function renderInspectionReportHtml(data: InspectionReportData) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>${reportStyles}</style>
</head>
<body>
  <header class="header">
    <div>
      <p class="brand">Klodware</p>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="muted">Generated ${escapeHtml(data.generatedAt)}</p>
    </div>
    <div class="small checksum">
      <p>Version: ${escapeHtml(data.reportVersion)}</p>
      <p>Checksum: ${escapeHtml(data.checksum)}</p>
    </div>
  </header>

  <section class="meta-grid">
    <div><span class="field-label">Vessel</span><span class="field-value">${escapeHtml(empty(data.vesselName))}</span></div>
    <div><span class="field-label">Inspection date</span><span class="field-value">${escapeHtml(empty(data.inspectionDate))}</span></div>
    <div><span class="field-label">Place</span><span class="field-value">${escapeHtml(empty(data.place))}</span></div>
    <div><span class="field-label">Inspector</span><span class="field-value">${escapeHtml(empty(data.inspectorName))}</span></div>
  </section>

  <h2>Score Legend</h2>
  <table>
    <tbody>
      ${data.scoreLegend
        .map(
          (entry) =>
            `<tr><th class="score">${escapeHtml(entry.score)}</th><td>${escapeHtml(entry.label)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Summary</h2>
  <section class="summary-grid">
    <div><span class="field-label">Total items</span><span class="metric">${data.summary.totalItems}</span></div>
    <div><span class="field-label">Completed items</span><span class="metric">${data.summary.completedItems}</span></div>
    <div><span class="field-label">Findings</span><span class="metric">${data.summary.findingsCount}</span></div>
    <div><span class="field-label">Drydock</span><span class="metric">${data.summary.drydockCount}</span></div>
  </section>
  <h3>Score Distribution</h3>
  <table>
    <thead><tr><th>Score</th><th>Count</th></tr></thead>
    <tbody>
      ${data.summary.scoreDistribution
        .map(
          (entry) =>
            `<tr><td>${escapeHtml(entry.score)}</td><td>${entry.count}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Findings Summary</h2>
  <table>
    <thead><tr><th>Item</th><th>Score</th><th>Remarks</th></tr></thead>
    <tbody>
      ${rows(
        data.findings,
        (finding) =>
          `<tr><td>${escapeHtml(finding.itemLabel)}</td><td>${escapeHtml(finding.score)}</td><td>${escapeHtml(empty(finding.remarks))}</td></tr>`,
        "No findings.",
        3,
      )}
    </tbody>
  </table>

  <h2>Drydock Item Summary</h2>
  <table>
    <thead><tr><th>Item</th><th>Remarks</th></tr></thead>
    <tbody>
      ${rows(
        data.drydockItems,
        (item) =>
          `<tr><td>${escapeHtml(item.itemLabel)}</td><td>${escapeHtml(empty(item.remarks))}</td></tr>`,
        "No drydock items.",
        2,
      )}
    </tbody>
  </table>

  <h2>Detailed Checklist</h2>
  <table>
    <thead>
      <tr><th>Item</th><th class="score">Score</th><th>Remarks</th><th class="indicator">Before</th><th class="indicator">After</th></tr>
    </thead>
    <tbody>
      ${data.sections
        .map(
          (section) => `
            <tr><td class="section-title" colspan="5">${escapeHtml(section.code)} ${escapeHtml(section.name)}</td></tr>
            ${section.items
              .map(
                (item) => `
                <tr>
                  <td>${escapeHtml(item.label)}</td>
                  <td class="score">${escapeHtml(empty(item.score))}</td>
                  <td class="remarks">${escapeHtml(empty(item.remarks))}</td>
                  <td class="indicator">${item.hasBeforePhoto ? "Yes" : "No"}</td>
                  <td class="indicator">${item.hasAfterPhoto ? "Yes" : "No"}</td>
                </tr>`,
              )
              .join("")}`,
        )
        .join("")}
    </tbody>
  </table>

  <h2>Photo Evidence</h2>
  <section class="photo-grid">
    ${
      data.photos.length
        ? data.photos
            .map(
              (photo) => `
              <article class="photo-card">
                <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(photo.itemLabel)} ${escapeHtml(photo.photoType)}" />
                <p><strong>${escapeHtml(photo.itemLabel)}</strong></p>
                <p>Type: ${escapeHtml(photo.photoType)}</p>
                <p>Captured: ${escapeHtml(empty(photo.capturedAt))}</p>
                <p>GPS: ${escapeHtml(empty(photo.gps))}</p>
              </article>`,
            )
            .join("")
        : "<p>No uploaded photo evidence.</p>"
    }
  </section>

  <h2>Running Hours</h2>
  <table>
    <thead><tr><th>Equipment</th><th>Value</th></tr></thead>
    <tbody>
      ${rows(
        data.runningHours,
        (entry) =>
          `<tr><td>${escapeHtml(entry.equipment)}</td><td>${escapeHtml(empty(entry.value))}</td></tr>`,
        "No running hour values.",
        2,
      )}
    </tbody>
  </table>

  <h2>Other Comments</h2>
  <p>${escapeHtml(empty(data.otherComments, "No comments."))}</p>

  <footer class="footer">
    <p>Klodware inspection report. Generated timestamp, version, and checksum are included for traceability.</p>
  </footer>
</body>
</html>`;
}
