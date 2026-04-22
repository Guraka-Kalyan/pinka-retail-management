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

export const downloadDressingPDF = (records: any[], type: "executive" | "detailed", dateRangeStr: string) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.width;
  const PH = doc.internal.pageSize.height;

  // Process KPIs
  let totalAnimals = records.length;
  let totalBsw = 0;
  let totalAsw = 0;
  let totalPacked = 0;
  let totalPackedValue = 0;
  let totalCost = 0;

  records.forEach((r: any) => {
    totalBsw += Number(r.animalWeight) || 0;
    totalAsw += Number(r.totalWeight) || 0;
    totalCost += Number(r.cost) || 0;

    let pQty = 0;
    let pVal = 0;
    if (r.status === "Packed" && r.pkgItems) {
      ["bone", "boneless", "mixed"].forEach(k => {
        if (r.pkgItems[k]) {
          const q = Number(r.pkgItems[k].qty) || 0;
          const p = Number(r.pkgItems[k].pricePerKg) || 0;
          pQty += q;
          pVal += (q * p);
        }
      });
    }
    totalPacked += pQty;
    totalPackedValue += pVal;
  });

  const totalProfit = totalPackedValue - totalCost;

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(255, 107, 0);
  doc.rect(0, 0, PW, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`PINAKA - Dressing ${type === "executive" ? "Executive Summary" : "Detailed Report"}`, 14, 12);
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
  sectionTitle("1. Dressing Management Summary", 40);

  autoTable(doc, {
    startY: 44,
    head: [["Metric", "Value"]],
    body: [
      ["Total Animals Processed", `${totalAnimals}`],
      ["Before Slaughter Weight (BSW)", fmtWt(totalBsw)],
      ["After Slaughter Weight (ASW)", fmtWt(totalAsw)],
      ["Packed Meat (kg)", fmtWt(totalPacked)],
      ["Packed Meat Value", fmtMoney(totalPackedValue)],
      ["Estimated Profit Type 1", (totalProfit >= 0 ? "+ " : "- ") + fmtMoney(totalProfit)]
    ],
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: [255,255,255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  // ================= VISUAL SUMMARY ON SAME PAGE =================
  const chartsStartY = (doc as any).lastAutoTable.finalY + 15;
  sectionTitle("2. Visual Summary", chartsStartY - 5);

  const isSingleBatch = records.length === 1;

  if (isSingleBatch) {
    // ── KPI Card Grid for Single Batch ────────────────────────────────────────
    const r = records[0];
    const bsw    = Number(r.animalWeight) || 0;
    const asw    = Number(r.totalWeight)  || 0;
    const usable = Number(r.usableMeat)   || 0;
    const cost   = Number(r.cost)         || 0;
    const yield_ = bsw > 0 ? ((asw / bsw) * 100).toFixed(1) + "%" : "N/A";
    const wastage = r.wastagePercent !== "-" ? `${r.wastagePercent}%` : (bsw > 0 ? (((bsw - asw) / bsw) * 100).toFixed(1) + "%" : "N/A");
    let packedQty = 0; let packedVal = 0;
    if (r.status === "Packed" && r.pkgItems) {
      ["bone", "boneless", "mixed"].forEach(k => {
        if (r.pkgItems[k]) {
          packedQty += Number(r.pkgItems[k].qty) || 0;
          packedVal += (Number(r.pkgItems[k].qty) || 0) * (Number(r.pkgItems[k].pricePerKg) || 0);
        }
      });
    }
    const profit = packedVal - cost;

    const kpis = [
      { label: "Before Slaughter (BSW)", value: fmtWt(bsw), color: [52, 152, 219] as [number,number,number] },
      { label: "After Slaughter (ASW)",  value: fmtWt(asw), color: [231, 76, 60] as [number,number,number] },
      { label: "Yield %",                value: yield_,     color: [46, 204, 113] as [number,number,number] },
      { label: "Packed Meat",            value: fmtWt(packedQty), color: [155, 89, 182] as [number,number,number] },
      { label: "Profit / Loss",          value: (profit >= 0 ? "+ " : "- ") + fmtMoney(Math.abs(profit)), color: profit >= 0 ? [39,174,96] as [number,number,number] : [192,57,43] as [number,number,number] },
      { label: "Wastage %",              value: wastage,    color: [243, 156, 18] as [number,number,number] },
    ];

    const cardW = (PW - 28 - 10) / 3;  // 3 cards per row, 2 rows
    const cardH = 30;
    const gapX  = 5;
    const gapY  = 6;

    kpis.forEach((kpi, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx  = 14 + col * (cardW + gapX);
      const cy  = chartsStartY + row * (cardH + gapY);

      // Card background
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(cx, cy, cardW, cardH, 2, 2, "F");

      // Left accent bar
      doc.setFillColor(...kpi.color);
      doc.roundedRect(cx, cy, 3, cardH, 1, 1, "F");

      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(kpi.label, cx + 6, cy + 9);

      // Value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...kpi.color);
      doc.text(kpi.value, cx + 6, cy + 22);
    });

    // Batch info line below cards
    const infoY = chartsStartY + 2 * (cardH + gapY) + 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Batch: ${r.batchNo || r.batch || "-"}   |   Animal: ${r.animalId || "-"}   |   Date: ${r.date || "-"}   |   Status: ${r.status || "-"}`, 14, infoY);

  } else {
    // ── Bar Charts for Multi-Batch ────────────────────────────────────────────
    const chartDataBswAsw = records.map(r => ({
      label: String(r.batchNo || r.batch || "N/A"),
      value1: Number(r.animalWeight) || 0,
      value2: Number(r.totalWeight) || 0
    }));

    const chartDataYield = records.map(r => {
      const b = Number(r.animalWeight) || 0;
      const a = Number(r.totalWeight) || 0;
      return { label: String(r.batchNo || r.batch || "N/A"), value1: b > 0 ? (a/b)*100 : 0 };
    });

    const chartDataProfit = records.map(r => {
      let pVal = 0;
      if (r.status === "Packed" && r.pkgItems) {
        ["bone", "boneless", "mixed"].forEach(k => {
          if (r.pkgItems[k]) pVal += (Number(r.pkgItems[k].qty) || 0) * (Number(r.pkgItems[k].pricePerKg) || 0);
        });
      }
      const c = Number(r.cost) || 0;
      return { label: String(r.batchNo || r.batch || "N/A"), value1: pVal > 0 ? pVal - c : 0 };
    });

    drawNativeBarChart(doc, {
      x: 14, y: chartsStartY, w: (PW/2) - 20, h: 50,
      title: "Before vs After Slaughter (kg)",
      data: chartDataBswAsw,
      color1: [52, 152, 219], color2: [231, 76, 60],
      label1: "BSW", label2: "ASW"
    });

    drawNativeBarChart(doc, {
      x: PW/2 + 5, y: chartsStartY, w: (PW/2) - 20, h: 50,
      title: "Yield % by Batch",
      data: chartDataYield,
      color1: [46, 204, 113], label1: "Yield %", yAxisLabel: "%"
    });

    drawNativeBarChart(doc, {
      x: 14, y: chartsStartY + 60, w: PW - 28, h: 60,
      title: "Profit / Loss by Batch (Rs)",
      data: chartDataProfit,
      color1: [155, 89, 182], label1: "Profit", isCurrency: true
    });
  }

  // ================= PAGE 2: DETAILED TABLE =================
  if (type === "detailed") {
    doc.addPage();
    sectionTitle("3. Batch Listing (Detailed)", 20);

    const tableRows = records.map(r => {
      let pQty = 0; let pVal = 0;
      if (r.status === "Packed" && r.pkgItems) {
        ["bone", "boneless", "mixed"].forEach(k => {
          if (r.pkgItems[k]) {
            const q = Number(r.pkgItems[k].qty) || 0;
            const p = Number(r.pkgItems[k].pricePerKg) || 0;
            pQty += q; pVal += (q * p);
          }
        });
      }

      let bsStr = "0"; let asStr = "0";
      const c = Number(r.cost) || 0;
      const bsw = Number(r.animalWeight) || 0;
      const uMeat = Number(r.usableMeat) || 0;
      if (bsw > 0) bsStr = Math.round(c/bsw).toString();
      if (uMeat > 0) asStr = Math.round(c/uMeat).toString();

      return [
        r.batchNo || r.batch || "-",
        r.animalId || "-",
        r.date || "-",
        fmtWt(r.animalWeight),
        r.status === "Unslaughtered" ? "-" : fmtWt(r.totalWeight),
        r.usableMeat === "-" ? "-" : fmtWt(r.usableMeat),
        r.status === "Packed" ? fmtWt(pQty) : "-",
        r.wastagePercent === "-" ? "-" : `${r.wastagePercent}%`,
        r.cost ? fmtMoney(r.cost) : "-",
        `${bsStr} / ${asStr}`,
        r.status === "Packed" ? fmtMoney(pVal) : "-",
        r.status
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [["Batch", "Animal ID", "Date", "BSW", "ASW", "Usable", "Packed Meat", "Wastage %", "Total Cost", "Price/kg\n(BS/AS)", "Packed Val", "Status"]],
      body: tableRows.length ? tableRows : [["No data available", "","","","","","","","","","",""]],
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185], fontSize: 7, halign: "center" },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
        6: { halign: "right" }, 7: { halign: "center" }, 8: { halign: "right" },
        9: { halign: "center" }, 10: { halign: "right" }, 11: { halign: "center" }
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
    doc.text("Generated securely via PINAKA. Dressing Management System.", 14, PH - 10);
    doc.text("Page " + i + " of " + total, PW - 14, PH - 10, { align: "right" });
  }

  doc.save(`Pinaka_Dressing_${type === "executive" ? "Executive" : "Detailed"}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const downloadDressingExcel = (records: any[], dateRangeStr: string) => {
  const wb = XLSX.utils.book_new();

  let totalAnimals = records.length;
  let totalBsw = 0; let totalAsw = 0; let totalPacked = 0; let totalPackedValue = 0; let totalCost = 0;
  records.forEach((r: any) => {
    totalBsw += Number(r.animalWeight) || 0;
    totalAsw += Number(r.totalWeight) || 0;
    totalCost += Number(r.cost) || 0;
    if (r.status === "Packed" && r.pkgItems) {
      ["bone", "boneless", "mixed"].forEach(k => {
        if (r.pkgItems[k]) {
          totalPacked += Number(r.pkgItems[k].qty) || 0;
          totalPackedValue += (Number(r.pkgItems[k].qty) || 0) * (Number(r.pkgItems[k].pricePerKg) || 0);
        }
      });
    }
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

  XLSX.utils.book_append_sheet(wb, wsAoa([
    ["PINAKA DRESSING MANAGEMENT"],
    ["Period", dateRangeStr],
    ["Generated", new Date().toDateString()],
    [],
    ["SUMMARY METRICS", "VALUE"],
    ["Total Animals Processed", totalAnimals],
    ["Before Slaughter Weight (BSW)", fmt(totalBsw)],
    ["After Slaughter Weight (ASW)", fmt(totalAsw)],
    ["Packed Meat Weight (kg)", fmt(totalPacked)],
    ["Packed Meat Value (Rs)", fmt(totalPackedValue)],
    ["Total Purchase Cost (Rs)", fmt(totalCost)],
    ["Estimated Profit (Rs)", fmt(totalPackedValue - totalCost)]
  ], [30, 20]), "Summary");

  XLSX.utils.book_append_sheet(wb, ws(
    records.map((r: any) => {
      let pQty = 0; let pVal = 0;
      if (r.status === "Packed" && r.pkgItems) {
        ["bone", "boneless", "mixed"].forEach(k => {
          if (r.pkgItems[k]) {
            const q = Number(r.pkgItems[k].qty) || 0;
            const p = Number(r.pkgItems[k].pricePerKg) || 0;
            pQty += q; pVal += (q * p);
          }
        });
      }
      return {
        "Batch No": r.batchNo || r.batch || "-",
        "Animal ID": r.animalId || "-",
        "Date": r.date || "-",
        "BSW (kg)": Number(r.animalWeight) || 0,
        "ASW (kg)": r.status === "Unslaughtered" ? "-" : (Number(r.totalWeight) || 0),
        "Usable Meat (kg)": r.usableMeat === "-" ? "-" : (Number(r.usableMeat) || 0),
        "Packed Meat (kg)": r.status === "Packed" ? pQty : "-",
        "Wastage %": r.wastagePercent === "-" ? "-" : Number(r.wastagePercent) || 0,
        "Total Cost (Rs)": Number(r.cost) || 0,
        "Packed Value (Rs)": r.status === "Packed" ? pVal : "-",
        "Status": r.status
      };
    }),
    [15, 15, 12, 12, 12, 16, 16, 12, 16, 16, 15]
  ), "Batch Records");

  XLSX.writeFile(wb, `Pinaka_Dressing_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
