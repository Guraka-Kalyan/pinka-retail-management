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

  const chartDataBswAsw = records.map(r => ({
    label: String(r.batchNo || r.batch || "N/A"),
    value1: Number(r.animalWeight) || 0,
    value2: Number(r.totalWeight) || 0
  }));

  const chartDataYield = records.map(r => {
    const b = Number(r.animalWeight) || 0;
    const a = Number(r.totalWeight) || 0;
    return {
      label: String(r.batchNo || r.batch || "N/A"),
      value1: b > 0 ? (a/b)*100 : 0
    };
  });

  const chartDataProfit = records.map(r => {
    let pVal = 0;
    if (r.status === "Packed" && r.pkgItems) {
      ["bone", "boneless", "mixed"].forEach(k => {
        if (r.pkgItems[k]) {
          pVal += (Number(r.pkgItems[k].qty) || 0) * (Number(r.pkgItems[k].pricePerKg) || 0);
        }
      });
    }
    const c = Number(r.cost) || 0;
    return {
      label: String(r.batchNo || r.batch || "N/A"),
      value1: pVal > 0 ? pVal - c : 0
    };
  });

  // Split into 4 quadrants
  // Chart 1: BSW vs ASW
  drawNativeBarChart(doc, {
    x: 14, y: chartsStartY, w: (PW/2) - 20, h: 50,
    title: "Before vs After Slaughter (kg)",
    data: chartDataBswAsw,
    color1: [52, 152, 219],
    color2: [231, 76, 60],
    label1: "BSW", label2: "ASW"
  });

  // Chart 2: Yield %
  drawNativeBarChart(doc, {
    x: PW/2 + 5, y: chartsStartY, w: (PW/2) - 20, h: 50,
    title: "Yield % by Batch",
    data: chartDataYield,
    color1: [46, 204, 113],
    label1: "Yield %",
    yAxisLabel: "%"
  });

  // Chart 3: Profit by Batch
  drawNativeBarChart(doc, {
    x: 14, y: chartsStartY + 60, w: PW - 28, h: 60,
    title: "Profit / Loss by Batch (Rs)",
    data: chartDataProfit,
    color1: [155, 89, 182],
    label1: "Profit",
    isCurrency: true
  });

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
