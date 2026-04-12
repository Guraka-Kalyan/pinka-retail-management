import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportData {
  timeframe: string;
  customStart: string;
  customEnd: string;
  pipeline: any;
  dressingData: any[];
  supplyData: any[];
  shopSalesData: any[];
  fInvIn: any[];
  fSupplies: any[];
  fSales: any[];
}

// ── Pure ASCII formatters (no Unicode, no toLocaleString) ─────────────────
const fmt = (n: any): number => Math.round(Math.abs(Number(n) || 0));

const fmtMoney = (n: any): string => {
  const val = fmt(n);
  // Manual comma-separation, pure ASCII only
  return "Rs. " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const fmtWt = (n: any, dec = 1): string =>
  (Number(n) || 0).toFixed(dec) + " kg";

const dtRange = (d: ExportData): string =>
  d.timeframe === "Custom"
    ? d.customStart + " to " + d.customEnd
    : d.timeframe;

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const downloadDashboardPDF = (data: ExportData) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.width;
  const PH = doc.internal.pageSize.height;
  const p  = data.pipeline || {};

  // ── Orange header band ──────────────────────────────────────────────────
  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, PW, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("PINAKA - Financial Dashboard Report", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Period: " + dtRange(data), 14, 20);
  doc.text("Generated: " + new Date().toDateString(), 14, 26);

  // ── Helper: next section Y ───────────────────────────────────────────────
  const nextY = (extra = 10): number => {
    const y = ((doc as any).lastAutoTable?.finalY ?? 30) + extra;
    return y > 255 ? (doc.addPage(), 15) : y;
  };

  const sectionTitle = (title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, y);
    doc.setFont("helvetica", "normal");
  };

  // ── 1. KPI Summary ───────────────────────────────────────────────────────
  sectionTitle("1. Overall Financial Pipeline", 40);
  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Packed Meat Value",         fmtMoney(p.packedMeatValue)],
      ["Packed Meat Weight",              fmtWt(p.packedMeatWeight, 2)],
      ["Total Sales Revenue",             fmtMoney(p.totalRevenue)],
      ["Sales Weight",                    fmtWt(p.totalRevenueWeight, 2)],
      ["Total Deductions (Operational)",  fmtMoney(p.totalDeductions)],
      ["Net Profit / Loss",               (Number(p.netProfit) >= 0 ? "+ " : "- ") + fmtMoney(p.netProfit)],
    ],
    theme: "grid",
    headStyles: { fillColor: [255, 107, 0], textColor: [255,255,255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30,30,30] },
    columnStyles: { 0: { cellWidth: 110 }, 1: { halign: "right", fontStyle: "bold" } },
  });

  // ── 2. Dressing ──────────────────────────────────────────────────────────
  let y2 = nextY(8);
  sectionTitle("2. Slaughter & Dressing Summary", y2);
  autoTable(doc, {
    startY: y2 + 4,
    head: [["Batch", "Before (kg)", "After (kg)", "Packed (kg)", "Yield", "Profit / Loss"]],
    body: data.dressingData.map(d => [
      String(d.name || ""),
      fmtWt(d.before),
      fmtWt(d.after),
      fmtWt(d.packed),
      d.before > 0 ? Math.round((d.after / d.before) * 100) + "%" : "0%",
      fmtMoney(d.profit),
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: [255,255,255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30 }, 1: { halign: "right" }, 2: { halign: "right" },
      3: { halign: "right" }, 4: { halign: "center" }, 5: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── 3. Supply ────────────────────────────────────────────────────────────
  let y3 = nextY(8);
  sectionTitle("3. Inventory & Supply Distributed", y3);
  autoTable(doc, {
    startY: y3 + 4,
    head: [["Batch", "Packed (kg)", "Shop Supply", "Other Supply", "Total Value"]],
    body: data.supplyData.map(s => [
      String(s.name || ""),
      fmtWt(s.weight),
      fmtMoney(s.shop),
      fmtMoney(s.other),
      fmtMoney(s.value),
    ]),
    theme: "grid",
    headStyles: { fillColor: [39, 174, 96], textColor: [255,255,255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30 }, 1: { halign: "right" }, 2: { halign: "right" },
      3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── 4. Shop Sales ────────────────────────────────────────────────────────
  let y4 = nextY(8);
  sectionTitle("4. Shop Sales & Revenue per Batch (Estimated)", y4);
  autoTable(doc, {
    startY: y4 + 4,
    head: [["Batch", "Inv. In", "Inv.Wt", "Ext.Added", "Ext.Wt", "Sales (Est.)", "Disc. (Est.)", "Net Revenue"]],
    body: data.shopSalesData.map(s => [
      String(s.name || ""),
      fmtMoney(s.inventoryIn),
      fmtWt(s.inventoryInKg),
      fmtMoney(s.externalAdded),
      fmtWt(s.externalAddedKg),
      fmtMoney(s.salesValue),
      fmtMoney(s.discount),
      fmtMoney(s.shopProfit),
    ]),
    theme: "grid",
    headStyles: { fillColor: [142, 68, 173], textColor: [255,255,255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24 }, 1: { halign: "right" }, 2: { halign: "right" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
      6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── 5. Cost Pipeline ────────────────────────────────────────────────────
  let y5 = nextY(8);
  sectionTitle("5. Cost Pipeline Breakdown", y5);
  autoTable(doc, {
    startY: y5 + 4,
    head: [["Component", "Type", "Amount"]],
    body: (p.waterfall || []).map((item: any) => [
      String(item.fullLabel || item.name || ""),
      item.type === "revenue" ? "Revenue" : item.type === "profit" ? "Profit" : item.type === "loss" ? "Loss" : "Cost",
      (item.type === "loss" || item.type === "cost" ? "- " : "+ ") + fmtMoney(item.value),
    ]),
    theme: "striped",
    headStyles: { fillColor: [60, 60, 60], textColor: [255,255,255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 28, halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
    didParseCell: (hook: any) => {
      if (hook.section === "body" && hook.column.index === 2) {
        const t = hook.row.raw[1];
        hook.cell.styles.textColor = (t === "Revenue" || t === "Profit") ? [22, 163, 74] : [220, 38, 38];
      }
    },
  });

  // ── Footer on every page ─────────────────────────────────────────────────
  const total = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, PH - 16, PW - 14, PH - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Note: Estimated values are proportionally allocated based on inventory value. Generated from PINAKA.", 14, PH - 10);
    doc.text("Page " + i + " of " + total, PW - 14, PH - 10, { align: "right" });
  }

  doc.save("Pinaka_Report_" + new Date().toISOString().slice(0, 10) + ".pdf");
};

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const downloadDashboardExcel = (data: ExportData) => {
  const wb = XLSX.utils.book_new();
  const p  = data.pipeline || {};

  const ws = (rows: any[], widths: number[]) => {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    sheet["!cols"] = widths.map(w => ({ wch: w }));
    return sheet;
  };

  const wsAoa = (rows: any[][], widths: number[]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = widths.map(w => ({ wch: w }));
    return sheet;
  };

  // Sheet 1: Summary
  XLSX.utils.book_append_sheet(wb, wsAoa([
    ["PINAKA FINANCIAL DASHBOARD"],
    ["Period",       dtRange(data)],
    ["Generated At", new Date().toDateString()],
    [],
    ["Metric",                              "Amount (Rs.)",  "Weight (kg)"],
    ["Total Packed Meat Value",              fmt(p.packedMeatValue),  +(p.packedMeatWeight  || 0).toFixed(2)],
    ["Total Sales Revenue",                  fmt(p.totalRevenue),     +(p.totalRevenueWeight|| 0).toFixed(2)],
    ["Total Deductions (Operational)",       fmt(p.totalDeductions),  ""],
    ["Net Profit / Loss",                    fmt(p.netProfit),        ""],
  ], [40, 20, 16]), "Summary");

  // Sheet 2: Dressing
  XLSX.utils.book_append_sheet(wb, ws(
    data.dressingData.map(d => ({
      "Batch No":              d.name,
      "Before Slaughter (kg)": +(d.before    || 0).toFixed(1),
      "Purchase Value (Rs.)":  fmt(d.beforeCost),
      "After Slaughter (kg)":  +(d.after     || 0).toFixed(1),
      "Packed Weight (kg)":    +(d.packed    || 0).toFixed(1),
      "Packed Value (Rs.)":    fmt(d.packedVal),
      "Yield %":               d.before > 0 ? Math.round((d.after / d.before) * 100) : 0,
      "Profit / Loss (Rs.)":   fmt(d.profit),
    })),
    [14, 22, 22, 22, 20, 22, 10, 22]
  ), "Dressing Data");

  // Sheet 3: Inventory In
  XLSX.utils.book_append_sheet(wb, ws(
    data.fInvIn.map(i => ({
      "Date":                i.date ? new Date(i.date).toLocaleDateString("en-IN") : "",
      "Batch No":            i.batch || "",
      "Type":                i.type === "external" ? "External Purchase" : "Central Supply",
      "Weight (kg)":         +(i.totalWeight  || 0).toFixed(1),
      "Value (Rs.)":         fmt(i.totalAmount),
      "Vendor / Transport":  i.vendorName || i.transport || "",
      "Notes":               i.notes || "",
    })),
    [14, 16, 22, 14, 16, 28, 30]
  ), "Inventory In");

  // Sheet 4: Supply
  XLSX.utils.book_append_sheet(wb, ws(
    data.fSupplies.map(s => ({
      "Date":             s.date ? new Date(s.date).toLocaleDateString("en-IN") : "",
      "Batch No":         s.batch || "",
      "Destination":      s.shopId ? "Shop" : "Wholesale / Other",
      "Bone (kg)":        +(s.bone      || 0).toFixed(1),
      "Boneless (kg)":    +(s.boneless  || 0).toFixed(1),
      "Mixed (kg)":       +(s.mixed     || 0).toFixed(1),
      "Total Value (Rs.)":fmt(s.totalAmount),
    })),
    [14, 16, 22, 12, 14, 12, 20]
  ), "Supply");

  // Sheet 5: Sales
  XLSX.utils.book_append_sheet(wb, ws(
    data.fSales.map(s => ({
      "Date":                   s.date ? new Date(s.date).toLocaleDateString("en-IN") : "",
      "Bill ID":                s.billId || "",
      "Shop ID":                s.shopId || "",
      "Total Sold (Rs.)":       fmt(s.total),
      "Discount (Rs.)":         fmt(s.discountGiven),
      "Cash (Rs.)":             fmt(s.cash),
      "PhonePe (Rs.)":          fmt(s.phonePe),
      "Bone Sold (kg)":         +(s.boneSold     || 0).toFixed(1),
      "Boneless Sold (kg)":     +(s.bonelessSold || 0).toFixed(1),
      "Mixed Sold (kg)":        +(s.mixedSold    || 0).toFixed(1),
    })),
    [14, 16, 16, 18, 16, 14, 14, 16, 18, 16]
  ), "Sales");

  // Sheet 6: Profit Calculation
  XLSX.utils.book_append_sheet(wb, ws(
    data.shopSalesData.map(s => ({
      "Batch No":                   s.name,
      "Central Inv. In (Rs.)":      fmt(s.inventoryIn),
      "Central Inv. Weight (kg)":   +(s.inventoryInKg   || 0).toFixed(1),
      "External Added (Rs.)":       fmt(s.externalAdded),
      "External Weight (kg)":       +(s.externalAddedKg || 0).toFixed(1),
      "Total Cost (Rs.)":           fmt((s.inventoryIn || 0) + (s.externalAdded || 0)),
      "Est. Sales (Rs.)":           fmt(s.salesValue),
      "Est. Discount (Rs.)":        fmt(s.discount),
      "Est. Net Revenue (Rs.)":     fmt(s.shopProfit),
    })),
    [16, 24, 26, 24, 22, 20, 20, 22, 26]
  ), "Profit Calculation");

  XLSX.writeFile(wb, "Pinaka_Report_" + new Date().toISOString().slice(0, 10) + ".xlsx");
};
