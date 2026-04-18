import { jsPDF } from "jspdf";

export interface ChartData {
  label: string;
  value1: number;
  value2?: number; // Optional second bar for comparison
}

export interface ChartOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  data: ChartData[];
  color1?: [number, number, number]; // RGB array
  color2?: [number, number, number];
  label1?: string;
  label2?: string;
  yAxisLabel?: string;
  isCurrency?: boolean;
}

const fmt = (num: number, isCurrency: boolean = false) => {
  const val = Math.round(Number(num) || 0);
  if (isCurrency) return "Rs. " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return val.toString();
};

export const drawNativeBarChart = (doc: jsPDF, options: ChartOptions) => {
  const { 
    x, y, w, h, title, data, 
    color1 = [41, 128, 185], // default blue
    color2 = [39, 174, 96],  // default green
    label1 = "Value 1",
    label2 = "Value 2",
    yAxisLabel = "",
    isCurrency = false
  } = options;

  // Draw Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(title, x, y);
  
  if (!data || data.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    // "No data available for selected period" centered in the area
    doc.text("No data available for selected period", x + w/2, y + h/2, { align: "center" });
    return;
  }

  const isDuo = data.some(d => d.value2 !== undefined);

  // Draw Legend Custom
  let legendY = y + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  // Legend 1
  doc.setFillColor(...color1);
  doc.rect(x, legendY - 3, 4, 4, "F");
  doc.setTextColor(80, 80, 80);
  doc.text(label1, x + 6, legendY);

  if (isDuo) {
    // Legend 2
    const offset = doc.getTextWidth(label1) + 15;
    doc.setFillColor(...color2);
    doc.rect(x + offset, legendY - 3, 4, 4, "F");
    doc.text(label2, x + offset + 6, legendY);
  }

  // Determine Max Y Value
  let maxVal = 0;
  data.forEach(d => {
    if (d.value1 > maxVal) maxVal = d.value1;
    if (d.value2 && d.value2 > maxVal) maxVal = d.value2;
  });
  
  // Create some headroom
  maxVal = maxVal > 0 ? maxVal * 1.15 : 10;
  
  const chartX = x + 15; // left margin for Y axis
  const chartY = legendY + 5; 
  const chartW = w - 15;
  const chartH = h - 15;

  // Y axis line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(chartX, chartY, chartX, chartY + chartH);
  
  // X axis line
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
  
  // Y axis labels (Min / Mid / Max)
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (maxVal / ySteps) * i;
    const yPos = chartY + chartH - (chartH / ySteps) * i;
    
    // Grid line
    doc.setDrawColor(240, 240, 240);
    if(i > 0) doc.line(chartX, yPos, chartX + chartW, yPos);
    
    // Label
    let labelVal = Math.round(val).toString();
    if (val >= 1000) labelVal = (val/1000).toFixed(1) + "k";
    
    doc.text(labelVal, chartX - 2, yPos + 2, { align: "right" });
  }

  if (yAxisLabel) {
    doc.text(yAxisLabel, chartX - 12, chartY - 2);
  }

  // Draw Bars
  const itemW = chartW / data.length;
  const barGap = itemW * 0.2;
  let barFullW = itemW - barGap;
  if(barFullW > 25) barFullW = 25; // max width

  data.forEach((d, i) => {
    const startX = chartX + (i * itemW) + (itemW - barFullW) / 2;
    
    if (!isDuo) {
      // Single Bar
      const barH = (d.value1 / maxVal) * chartH;
      doc.setFillColor(...color1);
      doc.rect(startX, chartY + chartH - barH, barFullW, barH, "F");
      
      // Value Label
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      const valStr = fmt(d.value1, isCurrency);
      doc.text(valStr, startX + barFullW/2, chartY + chartH - barH - 2, { align: "center" });
    } else {
      // Grouped Bars
      const halfW = barFullW / 2;
      
      const bar1H = (d.value1 / maxVal) * chartH;
      doc.setFillColor(...color1);
      doc.rect(startX, chartY + chartH - bar1H, halfW - 1, bar1H, "F");
      
      const v2 = d.value2 || 0;
      const bar2H = (v2 / maxVal) * chartH;
      doc.setFillColor(...color2);
      doc.rect(startX + halfW, chartY + chartH - bar2H, halfW - 1, bar2H, "F");

      // We only show label if it fits, else show tooltip? no tooltip in PDF. 
      // Skip inline values if grouped, or show very tiny
    }
    
    // X axis label
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    // Truncate label if too long
    let lbl = d.label || "";
    if (lbl.length > 8) lbl = lbl.substring(0, 6) + "..";
    doc.text(lbl, startX + barFullW/2, chartY + chartH + 5, { align: "center" });
  });

};
