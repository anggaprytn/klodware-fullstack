export const reportStyles = `
@page {
  size: A4;
  margin: 14mm 12mm;
}

* {
  box-sizing: border-box;
}

body {
  color: #202428;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  line-height: 1.35;
  margin: 0;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 22px;
}

h2 {
  border-bottom: 1px solid #cfd6dd;
  font-size: 14px;
  margin: 20px 0 8px;
  padding-bottom: 4px;
}

h3 {
  font-size: 12px;
  margin: 12px 0 6px;
}

.header {
  align-items: flex-start;
  border-bottom: 2px solid #0f766e;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 10px;
}

.brand {
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.meta-grid,
.summary-grid {
  display: grid;
  gap: 6px 14px;
  grid-template-columns: repeat(2, 1fr);
  margin-top: 10px;
}

.summary-grid {
  grid-template-columns: repeat(4, 1fr);
}

.field-label {
  color: #66727f;
  display: block;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.field-value,
.metric {
  font-weight: 700;
}

.muted {
  color: #66727f;
}

table {
  border-collapse: collapse;
  page-break-inside: auto;
  width: 100%;
}

tr {
  page-break-inside: avoid;
}

th,
td {
  border: 1px solid #d9dee4;
  padding: 5px 6px;
  text-align: left;
  vertical-align: top;
}

th {
  background: #eef5f4;
  color: #30363d;
  font-size: 10px;
}

.section-title {
  background: #30363d;
  color: #fff;
  font-weight: 700;
}

.score {
  font-weight: 700;
  text-align: center;
  width: 36px;
}

.indicator {
  text-align: center;
  width: 42px;
}

.remarks {
  overflow-wrap: anywhere;
}

.photo-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, 1fr);
}

.photo-card {
  border: 1px solid #d9dee4;
  break-inside: avoid;
  padding: 8px;
}

.photo-card img {
  display: block;
  height: 140px;
  margin-bottom: 6px;
  object-fit: contain;
  width: 100%;
}

.small {
  font-size: 9px;
}

.checksum {
  font-family: "Courier New", Courier, monospace;
  overflow-wrap: anywhere;
}

.footer {
  border-top: 1px solid #d9dee4;
  color: #66727f;
  font-size: 9px;
  margin-top: 18px;
  padding-top: 8px;
}
`;
