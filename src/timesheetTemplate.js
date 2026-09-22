// Reproduces the BIS company timesheet Excel template (VDC-Timesheets-*.xlsx) cell-for-cell:
// layout, merges, fonts, borders, number formats and formulas, reverse-engineered from a
// completed sample. Requires ExcelJS (window.ExcelJS) for cell styling — SheetJS community
// edition cannot write borders/fonts/number formats.

const BLACK = { argb: "FF000000" };
const bd = style => ({ style, color: BLACK });
const M = "medium", T = "thin", TH = "thick", D = "double";

function border({ top, right, bottom, left } = {}) {
  const o = {};
  if (top) o.top = bd(top);
  if (right) o.right = bd(right);
  if (bottom) o.bottom = bd(bottom);
  if (left) o.left = bd(left);
  return o;
}

const FONT = {
  label: { name: "Arial", size: 10, bold: true },
  value14b: { name: "Arial", size: 14, bold: true },
  signature: { name: "Lucida Handwriting", size: 14, bold: true },
  header12b: { name: "Arial", size: 12, bold: true },
  plain12: { name: "Arial", size: 12 },
  total14: { name: "Arial", size: 14 },
};

const CTR = { horizontal: "center" };
const CTR_MID = { horizontal: "center", vertical: "middle" };
const CTR_MID_WRAP = { horizontal: "center", vertical: "middle", wrapText: true };

const COLS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","AA","AB"];
// 8 groups of 3 columns each: 7 days (Mon..Sun) + Total Hours
const GROUPS = [
  { label: "MONDAY", cols: ["E","F","G"] },
  { label: "TUESDAY", cols: ["H","I","J"] },
  { label: "WEDNESDAY", cols: ["K","L","M"] },
  { label: "THURSDAY", cols: ["N","O","P"] },
  { label: "FRIDAY", cols: ["Q","R","S"] },
  { label: "SATURDAY", cols: ["T","U","V"] },
  { label: "SUNDAY", cols: ["W","X","Y"] },
  { label: "TOTAL HOURS", cols: ["Z","AA","AB"] },
];

function setCell(ws, ref, value, { font, align, brd, numFmt } = {}) {
  const c = ws.getCell(ref);
  if (value !== undefined) c.value = value;
  if (font) c.font = font;
  if (align) c.alignment = align;
  if (brd) c.border = border(brd);
  if (numFmt) c.numFmt = numFmt;
  return c;
}

function mergeSet(ws, range, value, opts) {
  ws.mergeCells(range);
  setCell(ws, range.split(":")[0], value, opts);
}

// entries: array of { project_id, day_name, reg_hours, ot_hours, dt_hours } for one employee's timesheet
// projects: array of { id, project_num, task_num, expense_type, project_name } assigned to that employee
// DAYS: ["Monday",...,"Sunday"] in that order (module-level constant already used by src/App.js)
export function buildTimesheetSheet(wb, sheetName, { emp, projects, entries, weekEndDate, supervisorName, DAYS }) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: false, zoomScale: 70 }],
    pageSetup: {
      orientation: "landscape", scale: 60, horizontalCentered: true,
      margins: { left: 0, right: 0.25, top: 1.47, bottom: 0.5, header: 0.75, footer: 0.51 },
    },
    headerFooter: { oddHeader: '&C&"Arial,Bold Italic"&28&ETIMESHEET' },
  });

  // Column widths
  ws.getColumn(1).width = 24.43;
  ws.getColumn(2).width = 14.29;
  ws.getColumn(3).width = 14.29;
  ws.getColumn(4).width = 25.43;
  for (let c = 5; c <= 25; c++) ws.getColumn(c).width = 5.71; // E..Y
  for (let c = 26; c <= 28; c++) ws.getColumn(c).width = 7.57; // Z..AB

  const empProjs = projects.filter(p => entries.some(e => e.project_id === p.id));
  const numDataRows = Math.max(8, empProjs.length);
  const DATA_START = 13;
  const DATA_END = DATA_START + numDataRows - 1;
  const TOTAL_ROW = DATA_END + 1;
  const CLOSE_ROW = TOTAL_ROW + 1;

  // ---- Header block (rows 1-9) ----
  ws.getRow(2).height = 25.5;
  ws.getRow(5).height = 20.25;
  ws.getRow(8).height = 20.25;

  mergeSet(ws, "A2:E2", emp.emp_no || "PENDING", { font: FONT.value14b, align: CTR, brd: { bottom: M } });
  mergeSet(ws, "I2:S2", emp.name || "", { font: FONT.value14b, align: CTR, brd: { bottom: M } });
  mergeSet(ws, "A3:E3", "EMPLOYEE NO.", { font: FONT.label, align: CTR, brd: { top: M } });
  mergeSet(ws, "I3:S3", "EMPLOYEE NAME", { font: FONT.label, align: CTR, brd: { top: M } });

  mergeSet(ws, "A5:E5", weekEndDate, { font: FONT.value14b, align: CTR, brd: { bottom: M }, numFmt: "m/d/yyyy" });
  mergeSet(ws, "I5:S5", emp.name || "", { font: FONT.signature, align: CTR, brd: { bottom: M } });
  mergeSet(ws, "A6:E6", "WEEK/PERIOD ENDING", { font: FONT.label, align: CTR, brd: { top: M } });
  mergeSet(ws, "I6:S6", "EMPLOYEE SIGNATURE", { font: FONT.label, align: CTR, brd: { top: M } });

  mergeSet(ws, "A8:E8", supervisorName || "", { font: FONT.signature, align: CTR, brd: { bottom: M } });
  mergeSet(ws, "I8:S8", "", { font: FONT.header12b, align: CTR, brd: { bottom: M } });
  mergeSet(ws, "A9:E9", "SUPERVISOR'S SIGNATURE", { font: FONT.label, align: CTR, brd: { top: M } });
  mergeSet(ws, "I9:S9", "SITE/FOREMAN", { font: FONT.label, align: CTR, brd: { top: M } });

  // ---- Row 10: per-day dates, computed backward by formula from the week-ending date ----
  ws.getRow(10).height = 18;
  const dateCols = GROUPS.slice(0, 7).map(g => g.cols[0]); // E,H,K,N,Q,T,W
  for (let i = dateCols.length - 1; i >= 0; i--) {
    const col = dateCols[i];
    const range = `${col}10:${GROUPS[i].cols[2]}10`;
    ws.mergeCells(range);
    const cell = ws.getCell(`${col}10`);
    const dayDate = new Date(weekEndDate); dayDate.setDate(dayDate.getDate() - (6 - i));
    if (i === dateCols.length - 1) {
      cell.value = { formula: "A5", result: dayDate };
    } else {
      const nextCol = dateCols[i + 1];
      cell.value = { formula: `${nextCol}10-1`, result: dayDate };
    }
    cell.font = FONT.header12b;
    cell.alignment = CTR;
    cell.border = border({ bottom: M });
    cell.numFmt = "m/d/yyyy";
  }

  // ---- Row 11: day-of-week headers; Row 12: REG/OT/DT sub-headers ----
  ws.getRow(11).height = 27.75;
  ws.getRow(12).height = 36;

  mergeSet(ws, "A11:A12", "PROJECT #", { font: FONT.header12b, align: CTR_MID, brd: { left: M, top: M, bottom: M } });
  mergeSet(ws, "B11:B12", "TASK #", { font: FONT.header12b, align: CTR_MID, brd: { top: M, bottom: M } });
  mergeSet(ws, "C11:C12", "EXPENSE TYPE", { font: FONT.header12b, align: CTR_MID_WRAP, brd: { top: M, bottom: M } });
  mergeSet(ws, "D11:D12", "PROJECT DESCRIPTION", { font: FONT.header12b, align: CTR_MID_WRAP, brd: { top: M, bottom: M } });

  GROUPS.forEach((g, gi) => {
    const [c0, c1, c2] = g.cols;
    const isMonday = gi === 0;
    const edge = isMonday ? TH : M;
    ws.mergeCells(`${c0}11:${c2}11`);
    setCell(ws, `${c0}11`, g.label, { font: FONT.header12b, align: CTR, brd: { left: M, right: edge, top: M, bottom: M } });
    setCell(ws, `${c1}11`, undefined, { font: FONT.header12b, align: CTR, brd: { left: edge, right: edge, top: M, bottom: M } });
    setCell(ws, `${c2}11`, undefined, { font: FONT.header12b, align: CTR, brd: { left: edge, right: M, top: M, bottom: M } });

    setCell(ws, `${c0}12`, "REG", { font: FONT.header12b, align: CTR, brd: { left: M, top: M, bottom: M } });
    setCell(ws, `${c1}12`, "OT", { font: FONT.header12b, align: CTR, brd: { left: M, right: M, top: M, bottom: M } });
    setCell(ws, `${c2}12`, "DT", { font: FONT.header12b, align: CTR, brd: { right: M, top: M, bottom: M } });
  });

  // ---- Data rows (project #, task #, expense type, description, REG/OT/DT per day) ----
  const colReg = Array(7).fill(0), colOt = Array(7).fill(0), colDt = Array(7).fill(0);
  for (let r = DATA_START; r <= DATA_END; r++) {
    ws.getRow(r).height = 34.5;
    const proj = empProjs[r - DATA_START];
    let rowReg = 0, rowOt = 0, rowDt = 0;

    setCell(ws, `A${r}`, proj ? proj.project_num || "" : "", { font: FONT.header12b, align: CTR_MID, brd: { left: T, right: T, top: T, bottom: T } });
    setCell(ws, `B${r}`, proj ? proj.task_num || "" : "", { font: FONT.header12b, align: CTR_MID, brd: { left: M, right: M, top: T, bottom: T } });
    setCell(ws, `C${r}`, proj ? proj.expense_type || "" : "", { font: FONT.header12b, align: CTR_MID, brd: { left: M, right: M, top: T, bottom: T } });
    setCell(ws, `D${r}`, proj ? proj.project_name || "" : "", { font: FONT.header12b, align: CTR_MID_WRAP, brd: { left: M, top: T, bottom: T } });

    GROUPS.slice(0, 7).forEach((g, gi) => {
      const [regCol, otCol, dtCol] = g.cols;
      const dayName = DAYS[gi];
      const e = proj ? entries.find(en => en.project_id === proj.id && en.day_name === dayName) : null;
      const reg = parseFloat(e?.reg_hours) || 0, ot = parseFloat(e?.ot_hours) || 0, dt = parseFloat(e?.dt_hours) || 0;
      rowReg += reg; rowOt += ot; rowDt += dt;
      colReg[gi] += reg; colOt[gi] += ot; colDt[gi] += dt;
      const isSun = gi === 6;
      const font = isSun ? FONT.plain12 : FONT.header12b;
      setCell(ws, `${regCol}${r}`, reg || null, { font: FONT.header12b, align: CTR, brd: { left: M, top: T, bottom: T }, numFmt: "0" });
      setCell(ws, `${otCol}${r}`, ot || null, { font: FONT.header12b, align: CTR, brd: { left: M, right: M, top: T, bottom: T }, numFmt: "0" });
      setCell(ws, `${dtCol}${r}`, dt || null, { font, align: CTR, brd: { right: M, top: T, bottom: T }, numFmt: "0" });
    });

    // Per-row totals (Total Hours group), full medium box each row
    setCell(ws, `Z${r}`, { formula: `E${r}+H${r}+K${r}+N${r}+Q${r}+T${r}+W${r}`, result: rowReg }, { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M, bottom: M }, numFmt: "0" });
    setCell(ws, `AA${r}`, { formula: `F${r}+I${r}+L${r}+O${r}+R${r}+U${r}+X${r}`, result: rowOt }, { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M, bottom: M }, numFmt: "0" });
    setCell(ws, `AB${r}`, { formula: `G${r}+J${r}+M${r}+P${r}+S${r}+V${r}+Y${r}`, result: rowDt }, { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M, bottom: M }, numFmt: "0" });
  }

  // ---- Totals row ----
  ws.getRow(TOTAL_ROW).height = 34.5;
  // Left unmerged (unlike a plain blank cell) so the PROJECT #/TASK #/EXPENSE TYPE column
  // dividers keep running straight down into the TOTAL row, matching the reference template.
  setCell(ws, `A${TOTAL_ROW}`, "", { font: FONT.header12b, align: CTR, brd: { left: M, right: T, top: T, bottom: T } });
  setCell(ws, `B${TOTAL_ROW}`, "", { font: FONT.header12b, align: CTR, brd: { left: M, right: M, top: T, bottom: T } });
  setCell(ws, `C${TOTAL_ROW}`, "", { font: FONT.header12b, align: CTR, brd: { left: M, right: M, top: T, bottom: T } });
  setCell(ws, `D${TOTAL_ROW}`, "TOTAL", { font: FONT.header12b, align: CTR, brd: { left: M, top: T, bottom: T } });
  GROUPS.slice(0, 7).forEach((g, gi) => {
    const [regCol, otCol, dtCol] = g.cols;
    setCell(ws, `${regCol}${TOTAL_ROW}`, { formula: `SUM(${regCol}${DATA_START}:${regCol}${DATA_END})`, result: colReg[gi] }, { font: FONT.header12b, align: CTR, brd: { left: M, bottom: M }, numFmt: "0" });
    setCell(ws, `${otCol}${TOTAL_ROW}`, { formula: `SUM(${otCol}${DATA_START}:${otCol}${DATA_END})`, result: colOt[gi] }, { font: FONT.header12b, align: CTR, brd: { left: M, right: M, bottom: M }, numFmt: "0" });
    setCell(ws, `${dtCol}${TOTAL_ROW}`, { formula: `SUM(${dtCol}${DATA_START}:${dtCol}${DATA_END})`, result: colDt[gi] }, { font: FONT.header12b, align: CTR, brd: { right: M, bottom: M }, numFmt: "0" });
  });
  const grandReg = colReg.reduce((a, b) => a + b, 0), grandOt = colOt.reduce((a, b) => a + b, 0), grandDt = colDt.reduce((a, b) => a + b, 0);
  setCell(ws, `Z${TOTAL_ROW}`, { formula: `SUM(Z${DATA_START}:Z${DATA_END})`, result: grandReg }, { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M }, numFmt: "0" });
  setCell(ws, `AA${TOTAL_ROW}`, { formula: `SUM(AA${DATA_START}:AA${DATA_END})`, result: grandOt }, { font: FONT.total14, align: CTR, brd: { right: M, top: M }, numFmt: "0" });
  setCell(ws, `AB${TOTAL_ROW}`, { formula: `SUM(AB${DATA_START}:AB${DATA_END})`, result: grandDt }, { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M }, numFmt: "0" });

  // ---- Closing double-rule row ----
  ws.getRow(CLOSE_ROW).height = 34.5;
  for (const col of COLS) {
    setCell(ws, `${col}${CLOSE_ROW}`, "", { font: FONT.total14, align: CTR, brd: { left: M, right: M, top: M, bottom: D } });
  }

  // ---- Footer spacer rows (blank below the closing rule, matches the real template) ----
  ws.getRow(CLOSE_ROW + 1).height = 12;
  ws.getRow(CLOSE_ROW + 2).height = 12;
  ws.getRow(CLOSE_ROW + 3).height = 15;

  ws.pageSetup.printArea = `A1:AB${CLOSE_ROW + 3}`;

  return ws;
}
