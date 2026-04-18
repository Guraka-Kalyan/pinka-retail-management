import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawNativeBarChart } from "./pdfChartHelper";

const fmt = (n: any): number => Math.round(Number(n) || 0);

const fmtMoney = (n: any): string => {
  const val = Math.round(Number(n) || 0);
  return "Rs. " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const fmtWt = (n: any, dec = 1): string =>
  (Number(n) || 0).toFixed(dec) + " kg";

export const downloadSupplyPDF = (inventoryIn: any[], suppliesOut: any[], type: "executive" | "detailed", dateRangeStr: string) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.width;
  const PH = doc.internal.pageSize.height;

  // Process KPIs
  let totalPackedStockWt = 0;
  let totalPackedStockAmt = 0;
  inventoryIn.forEach(i => {
    totalPackedStockWt += Number(i.totalWeight || i.total_weight || i.total) || 0;
    totalPackedStockAmt += Number(i.totalAmount || i.total_amount) || 0;
  });

  let totalSupplyOutWt = 0;
  let shopSupplyAmt = 0;
  let otherSupplyAmt = 0;
  let totalExtra = 0;

  // Grouping for charts
  const revByBatchMap: { [key: string]: number } = {};
  const wtByBatchMap: { [key: string]: { inv: number, sup: number } } = {};

  inventoryIn.forEach(i => {
    const b = i.batchNo || i.batch || "N/A";
    if (!wtByBatchMap[b]) wtByBatchMap[b] = { inv: 0, sup: 0 };
    wtByBatchMap[b].inv += Number(i.totalWeight || i.total_weight || i.total) || 0;
  });

  suppliesOut.forEach(s => {
    const tWt = (Number(s.bone)||0) + (Number(s.boneless)||0) + (Number(s.mixed)||0);
    const amt = Number(s.totalAmount) || 0;
    const ext = Number(s.extra) || 0;

    totalSupplyOutWt += tWt;
    totalExtra += ext;

    if (s.shopId && s.shopNo && !s.shopNo.startsWith("Others")) {
      shopSupplyAmt += amt;
    } else {
      otherSupplyAmt += amt;
    }

    const b = s.batchNo || s.batch || "N/A";
    if (!revByBatchMap[b]) revByBatchMap[b] = 0;
    revByBatchMap[b] += amt;

    if (!wtByBatchMap[b]) wtByBatchMap[b] = { inv: 0, sup: 0 };
    wtByBatchMap[b].sup += tWt;
  });

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(46, 204, 113);
  doc.rect(0, 0, PW, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`PINAKA - Supply & Inventory ${type === "executive" ? "Executive Summary" : "Detailed Report"}`, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Period: " + dateRangeStr, 14, 20);
  doc.text("Generated: " + new Date().toDateString(), 14, 26);

  // Helper
  const sectionTitle = (title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, y);
    doc.setFont("helvetica", "normal");
  };

  // ================= PAGE 1: SUMMARY =================
  sectionTitle("1. Inventory & Supply Summary", 40);

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Packed Stock (Inventory In)", fmtWt(totalPackedStockWt)],
      ["Packed Stock Value", fmtMoney(totalPackedStockAmt)],
      ["Total Supply Out", fmtWt(totalSupplyOutWt)],
      ["Shop Supply Value", fmtMoney(shopSupplyAmt)],
      ["Other / External Supply Value", fmtMoney(otherSupplyAmt)],
      ["Extra Charges", fmtMoney(totalExtra)]
    ],
    theme: "grid",
    headStyles: { fillColor: [39, 174, 96], textColor: [255,255,255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  // ================= VISUAL SUMMARY ON SAME PAGE =================
  const chartsStartY = (doc as any).lastAutoTable.finalY + 15;
  sectionTitle("2. Visual Summary", chartsStartY - 5);

  const chartDataInv = inventoryIn.map(i => ({
    label: String(i.batchNo || i.batch || "N/A"),
    value1: Number(i.totalWeight || i.total_weight || i.total) || 0
  }));

  const chartDataVs = [
    { label: "Shop Supply", value1: shopSupplyAmt },
    { label: "Other Supply", value1: otherSupplyAmt }
  ];

  const chartDataRev = Object.keys(revByBatchMap).map(k => ({
    label: k,
    value1: revByBatchMap[k]
  }));

  const chartDataWtMv = Object.keys(wtByBatchMap).map(k => ({
    label: k,
    value1: wtByBatchMap[k].inv,
    value2: wtByBatchMap[k].sup
  }));

  // Chart 1: Stock by Batch (In)
  drawNativeBarChart(doc, {
    x: 14, y: chartsStartY, w: (PW/2) - 20, h: 50,
    title: "Packed Stock by Batch (kg)",
    data: chartDataInv,
    color1: [52, 152, 219],
    label1: "Weight In"
  });

  // Chart 2: Shop vs Other
  drawNativeBarChart(doc, {
    x: PW/2 + 5, y: chartsStartY, w: (PW/2) - 20, h: 50,
    title: "Shop Supply vs Other Supply",
    data: chartDataVs,
    color1: [142, 68, 173],
    label1: "Revenue",
    isCurrency: true
  });

  // Chart 3: Supply Revenue by Batch
  drawNativeBarChart(doc, {
    x: 14, y: chartsStartY + 60, w: (PW/2) - 20, h: 50,
    title: "Supply Revenue by Batch (Rs)",
    data: chartDataRev,
    color1: [230, 126, 34],
    label1: "Revenue",
    isCurrency: true
  });

  // Chart 4: Weight Movement (In vs Out)
  drawNativeBarChart(doc, {
    x: PW/2 + 5, y: chartsStartY + 60, w: (PW/2) - 20, h: 50,
    title: "Weight Movement: In vs Out (kg)",
    data: chartDataWtMv,
    color1: [46, 204, 113],
    color2: [231, 76, 60],
    label1: "Inv In", label2: "Supplied Out"
  });

  // ================= PAGE 2: DETAILED TABLE =================
  if (type === "detailed") {
    doc.addPage();
    sectionTitle("3. Inventory In (Central Packed Meat)", 20);

    const invRows = inventoryIn.map(i => {
      const w = Number(i.totalWeight || i.total_weight || i.total) || 0;
      const amt = Number(i.totalAmount || i.total_amount) || 0;
      const rate = w > 0 ? Math.round(amt/w) : 0;
      return [
        i.date || "-",
        i.batchNo || i.batch || "-",
        fmtWt(w),
        `Rs. ${rate}/kg`,
        fmtMoney(amt),
        w > 0 ? "Available" : "Empty"
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Batch", "Weight", "Rate/kg", "Total Amount", "Status"]],
      body: invRows.length ? invRows : [["No data available", "","","","",""]],
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "right" }, 5: { halign: "center" } }
    });

    const supY = (doc as any).lastAutoTable.finalY + 10;
    sectionTitle("4. Inventory Out (Supplied to Shops/Others)", supY);

    const supRows = suppliesOut.map(s => {
      const tw = (Number(s.bone)||0) + (Number(s.boneless)||0) + (Number(s.mixed)||0);
      const calcAmt = (Number(s.totalAmount)||0) - (Number(s.extra)||0);
      return [
        s.date || "-",
        s.shopNo || "-",
        s.batchNo || s.batch || "-",
        fmtWt(s.bone),
        fmtWt(s.boneless),
        fmtWt(s.mixed),
        fmtWt(tw),
        fmtMoney(calcAmt),
        fmtMoney(s.extra),
        fmtMoney(s.totalAmount)
      ];
    });

    autoTable(doc, {
      startY: supY + 5,
      head: [["Date", "Shop Name", "Batch", "Bone", "Boneless", "Mixed", "Total Wt.", "Calc Amt", "Extra", "Grand Total"]],
      body: supRows.length ? supRows : [["No data available", "","","","","","","","",""]],
      theme: "grid",
      headStyles: { fillColor: [39, 174, 96], fontSize: 7, halign: "center" },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
        6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right", fontStyle: "bold" }
      }
    });
  }

  // Footer
  const total = (doc.internal as any).pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, PH - 16, PW - 14, PH - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated securely via PINAKA. Inventory & Supply Management System.", 14, PH - 10);
    doc.text("Page " + i + " of " + total, PW - 14, PH - 10, { align: "right" });
  }

  doc.save(`Pinaka_Supply_${type === "executive" ? "Executive" : "Detailed"}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const downloadSupplyExcel = (inventoryIn: any[], suppliesOut: any[], dateRangeStr: string) => {
  const wb = XLSX.utils.book_new();

  let totalPackedStockWt = 0; let totalPackedStockAmt = 0;
  inventoryIn.forEach(i => {
    totalPackedStockWt += Number(i.totalWeight || i.total_weight || i.total) || 0;
    totalPackedStockAmt += Number(i.totalAmount || i.total_amount) || 0;
  });

  let totalSupplyOutWt = 0; let shopSupplyAmt = 0; let otherSupplyAmt = 0; let totalExtra = 0;
  suppliesOut.forEach(s => {
    const tWt = (Number(s.bone)||0) + (Number(s.boneless)||0) + (Number(s.mixed)||0);
    totalSupplyOutWt += tWt;
    totalExtra += Number(s.extra) || 0;
    if (s.shopId && s.shopNo && !s.shopNo.startsWith("Others")) shopSupplyAmt += Number(s.totalAmount) || 0;
    else otherSupplyAmt += Number(s.totalAmount) || 0;
  });

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

  // Summary Sheet
  XLSX.utils.book_append_sheet(wb, wsAoa([
    ["PINAKA INVENTORY & SUPPLY MANAGEMENT"],
    ["Period", dateRangeStr],
    ["Generated", new Date().toDateString()],
    [],
    ["SUMMARY METRICS", "VALUE"],
    ["Total Packed Stock (kg)", fmt(totalPackedStockWt)],
    ["Packed Stock Value (Rs)", fmt(totalPackedStockAmt)],
    ["Total Supply Out (kg)", fmt(totalSupplyOutWt)],
    ["Shop Supply Revenue (Rs)", fmt(shopSupplyAmt)],
    ["Other Supply Revenue (Rs)", fmt(otherSupplyAmt)],
    ["Extra Charges Collected (Rs)", fmt(totalExtra)]
  ], [35, 20]), "Summary");

  // Inventory In Sheet
  XLSX.utils.book_append_sheet(wb, ws(
    inventoryIn.map((i: any) => {
      const w = Number(i.totalWeight || i.total_weight || i.total) || 0;
      const amt = Number(i.totalAmount || i.total_amount) || 0;
      return {
        "Date": i.date || "-",
        "Batch": i.batchNo || i.batch || "-",
        "Weight (kg)": w,
        "Rate/kg (Rs)": w > 0 ? Math.round(amt/w) : 0,
        "Total Amount (Rs)": amt,
        "Status": w > 0 ? "Available" : "Empty"
      };
    }),
    [15, 15, 15, 15, 20, 15]
  ), "Inventory In");

  // Supply Out Sheet
  XLSX.utils.book_append_sheet(wb, ws(
    suppliesOut.map((s: any) => {
      const tw = (Number(s.bone)||0) + (Number(s.boneless)||0) + (Number(s.mixed)||0);
      const calcAmt = (Number(s.totalAmount)||0) - (Number(s.extra)||0);
      return {
        "Date": s.date || "-",
        "Shop Name": s.shopNo || "-",
        "Batch": s.batchNo || s.batch || "-",
        "Bone (kg)": Number(s.bone) || 0,
        "Boneless (kg)": Number(s.boneless) || 0,
        "Mixed (kg)": Number(s.mixed) || 0,
        "Total Weight (kg)": tw,
        "Calculated Amount (Rs)": calcAmt,
        "Extra Charges (Rs)": Number(s.extra) || 0,
        "Grand Total (Rs)": Number(s.totalAmount) || 0
      };
    }),
    [15, 25, 15, 12, 12, 12, 16, 22, 18, 20]
  ), "Supply Out");

  XLSX.writeFile(wb, `Pinaka_Supply_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
