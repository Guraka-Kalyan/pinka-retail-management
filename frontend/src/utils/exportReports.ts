import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const fmt = (n: any): number => Math.round(Number(n) || 0);

const fmtMoney = (n: any): string => {
  const val = Math.round(Number(n) || 0);
  return "Rs. " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const fmtWt = (n: any, dec = 1): string =>
  (Number(n) || 0).toFixed(dec) + " kg";

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const downloadReportsPDF = (data: any, type: "executive" | "detailed", dateRangeStr: string) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.width;
  const PH = doc.internal.pageSize.height;
  const s = data.overallSummary || {};

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, PW, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`PINAKA - ${type === "executive" ? "Executive Summary" : "Detailed Report"}`, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Period: " + dateRangeStr, 14, 20);
  doc.text("Generated: " + new Date().toDateString(), 14, 26);

  // ── Helper: next section Y ───────────────────────────────────────────────
  const nextY = (extra = 10): number => {
    const y = ((doc as any).lastAutoTable?.finalY ?? 30) + extra;
    return y > 255 ? (doc.addPage(), 20) : y;
  };

  const sectionTitle = (title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, y);
    doc.setFont("helvetica", "normal");
  };

  // ================= PAGE 1: SUMMARY =================
  sectionTitle("1. Financial Summary", 40);
  
  // Box 1: Revenue Flow
  autoTable(doc, {
    startY: 44,
    head: [["Revenue Flow", "Amount"]],
    body: [
      ["Gross Sales", fmtMoney(s.grossSales)],
      ["Discount Given", fmtMoney(s.discountGiven)],
      ["Net Revenue", fmtMoney(s.netRevenue)]
    ],
    theme: "grid",
    headStyles: { fillColor: [46, 204, 113], textColor: [255,255,255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { right: PW / 2 + 5 }
  });

  const costY = (doc as any).lastAutoTable.finalY;

  // Box 2: Cost Breakdown
  autoTable(doc, {
    startY: 44,
    head: [["Cost Breakdown", "Amount"]],
    body: [
      ["Internal Purchase Cost", fmtMoney(s.purchaseCost)],
      ["External Purchases", fmtMoney(s.externalCost)],
      ["Operational Cost", fmtMoney(s.operationalCost)],
      ["Total Cost", fmtMoney(s.totalCost)]
    ],
    theme: "grid",
    headStyles: { fillColor: [231, 76, 60], textColor: [255,255,255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: PW / 2 + 5 }
  });

  // Box 3: Profit
  let yProfit = Math.max(costY, (doc as any).lastAutoTable.finalY) + 10;
  autoTable(doc, {
    startY: yProfit,
    head: [["Net Profit / Loss", "Amount"]],
    body: [
      ["Net Profit (Revenue - Total Cost)", fmtMoney(s.profit)]
    ],
    theme: "grid",
    headStyles: { fillColor: s.profit >= 0 ? [39, 174, 96] : [192, 57, 43], textColor: [255,255,255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold", textColor: s.profit >= 0 ? [39, 174, 96] : [192, 57, 43] } }
  });

  // ================= PAGE 2: OPERATIONS =================
  if (type === "detailed" || type === "executive") {
    doc.addPage();
    sectionTitle("2. Operations & Inventory Summary", 20);

    autoTable(doc, {
      startY: 25,
      head: [["Operational Metrics", "Value"]],
      body: [
        ["Total KG Sold", fmtWt(s.totalKgSold)],
        ["Active Shops", s.activeShops.toString()],
        ["Total Pending Stock", fmtWt(s.pendingStock)],
        ["Warehouse Stock", fmtWt(s.warehouseStock)],
        ["Cash Collection", fmtMoney(s.cashCollection)],
        ["PhonePe Collection", fmtMoney(s.phonePeCollection)],
      ],
      theme: "striped",
      headStyles: { fillColor: [142, 68, 173] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } }
    });

    let yMeat = nextY(10);
    sectionTitle("Meat Type Summary", yMeat);
    autoTable(doc, {
      startY: yMeat + 5,
      head: [["Meat Type", "KG Sold"]],
      body: (data.salesByMeatType || []).filter((m: any) => m.kgSold > 0).map((m: any) => [
        m.meatType,
        fmtWt(m.kgSold)
      ]),
      theme: "grid",
      headStyles: { fillColor: [52, 73, 94] },
      columnStyles: { 1: { halign: "right" } }
    });
  }

  // ================= PAGE 3: DEEP TABLES =================
  if (type === "detailed") {
    doc.addPage();
    sectionTitle("3. Shop Performance (Detailed)", 20);

    autoTable(doc, {
      startY: 25,
      head: [["Shop Name", "Revenue", "KG Sold", "Op. Cost", "Ext. Cost", "Status"]],
      body: (data.shopPerformance || []).map((shop: any) => [
        shop.shopName,
        fmtMoney(shop.revenue),
        fmtWt(shop.kgSold),
        fmtMoney(shop.costs),
        fmtMoney(shop.externalCost),
        shop.status
      ]),
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "center" } }
    });

    let yInv = nextY(10);
    sectionTitle("Inventory Monitoring - Per Shop", yInv);
    autoTable(doc, {
      startY: yInv + 5,
      head: [["Shop Name", "Bone (kg)", "Boneless (kg)", "Mixed (kg)", "Total Pending"]],
      body: (data.inventoryMonitoring || []).map((shop: any) => [
        shop.shopName,
        fmtWt(shop.bonePending),
        fmtWt(shop.bonelessPending),
        fmtWt(shop.mixedPending),
        fmtWt(shop.pendingStock)
      ]),
      theme: "grid",
      headStyles: { fillColor: [211, 84, 0] },
      styles: { fontSize: 8 }
    });

    let yPrep = nextY(10);
    sectionTitle("Daily Preparations (Fry & Curry)", yPrep);
    autoTable(doc, {
      startY: yPrep + 5,
      head: [["Shop Name", "Fry Prepared (kg)", "Curry Prepared (kg)", "Bone Used (kg)", "Boneless Used (kg)"]],
      body: (data.preparations || []).map((shop: any) => [
        shop.shopName,
        fmtWt(shop.fryPrepared),
        fmtWt(shop.curryPrepared),
        fmtWt(shop.boneUsed),
        fmtWt(shop.bonelessUsed)
      ]),
      theme: "grid",
      headStyles: { fillColor: [22, 160, 133] },
      styles: { fontSize: 8 }
    });

    doc.addPage();
    sectionTitle("Daily Sales Log", 20);
    autoTable(doc, {
      startY: 25,
      head: [["Date", "Shop Name", "Bone", "Boneless", "Fry", "Curry", "Mixed", "Total Rs."]],
      body: (data.dailySalesLog || []).map((log: any) => [
        log.date,
        log.shopName,
        fmtWt(log.boneSold),
        fmtWt(log.bonelessSold),
        fmtWt(log.frySold),
        fmtWt(log.currySold),
        fmtWt(log.mixedSold),
        fmtMoney(log.total)
      ]),
      theme: "grid",
      headStyles: { fillColor: [142, 68, 173] },
      styles: { fontSize: 8 }
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const total = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, PH - 16, PW - 14, PH - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated securely via PINAKA Retail Management System.", 14, PH - 10);
    doc.text("Page " + i + " of " + total, PW - 14, PH - 10, { align: "right" });
  }

  doc.save(`Pinaka_${type === "executive" ? "Executive" : "Detailed"}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const downloadReportsExcel = (data: any, dateRangeStr: string) => {
  const wb = XLSX.utils.book_new();
  const s = data.overallSummary || {};

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

  XLSX.utils.book_append_sheet(wb, wsAoa([
    ["PINAKA REPORTS & ANALYTICS"],
    ["Period", dateRangeStr],
    ["Generated", new Date().toDateString()],
    [],
    ["FINANCIAL SUMMARY"],
    ["Gross Sales", fmt(s.grossSales)],
    ["Discount Given", fmt(s.discountGiven)],
    ["Net Revenue", fmt(s.netRevenue)],
    ["Internal Purchase Cost", fmt(s.purchaseCost)],
    ["External Cost", fmt(s.externalCost)],
    ["Operational Cost", fmt(s.operationalCost)],
    ["Total Cost", fmt(s.totalCost)],
    ["Net Profit", fmt(s.profit)],
    [],
    ["OPERATIONAL SUMMARY"],
    ["Total KG Sold", s.totalKgSold],
    ["Total Pending Stock", s.pendingStock],
    ["Warehouse Stock", s.warehouseStock],
    ["Active Shops", s.activeShops]
  ], [25, 20]), "Summary");

  XLSX.utils.book_append_sheet(wb, ws(
    (data.shopPerformance || []).map((shop: any) => ({
      "Shop Name": shop.shopName,
      "Revenue": fmt(shop.revenue),
      "KG Sold": fmt(shop.kgSold),
      "Bills": shop.bills,
      "Pending Stock": fmt(shop.pendingStock),
      "Discount": fmt(shop.discount),
      "Op. Cost": fmt(shop.costs),
      "Ext. Cost": fmt(shop.externalCost),
      "Status": shop.status
    })),
    [20, 15, 10, 10, 15, 10, 15, 15, 15]
  ), "Shop Performance");

  XLSX.utils.book_append_sheet(wb, ws(
    (data.inventoryMonitoring || []).map((shop: any) => ({
      "Shop Name": shop.shopName,
      "Bone Pending (kg)": fmt(shop.bonePending),
      "Boneless Pending (kg)": fmt(shop.bonelessPending),
      "Mixed Pending (kg)": fmt(shop.mixedPending),
      "Total Pending (kg)": fmt(shop.pendingStock)
    })),
    [20, 20, 20, 20, 20]
  ), "Inventory Monitoring");

  XLSX.utils.book_append_sheet(wb, ws(
    (data.dailySalesLog || []).map((log: any) => ({
      "Date": log.date,
      "Shop Name": log.shopName,
      "Bone Sold (kg)": fmt(log.boneSold),
      "Boneless Sold (kg)": fmt(log.bonelessSold),
      "Fry Sold (kg)": fmt(log.frySold),
      "Curry Sold (kg)": fmt(log.currySold),
      "Mixed Sold (kg)": fmt(log.mixedSold),
      "Total Amount (Rs.)": fmt(log.total)
    })),
    [15, 20, 15, 15, 15, 15, 15, 15]
  ), "Daily Sales Log");

  XLSX.writeFile(wb, `Pinaka_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
