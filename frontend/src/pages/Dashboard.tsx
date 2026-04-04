import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell, ComposedChart, Line, ReferenceLine, LabelList,
  LineChart,
} from "recharts";
import api from "@/lib/api";

// ── Default packaging prices (matches batch.controller.js) ─────────────────
const PKG_PRICES = { bone: 350, boneless: 400, mixed: 380 };

// ── Colours ───────────────────────────────────────────────────────────────────
const C_PRIMARY = "#FF6B00";
const C_RED     = "#DC2626";
const C_BLUE    = "#2563EB";
const C_GREEN   = "#16A34A";
const C_ORANGE  = "#F59E0B";
const C_PURPLE  = "#9333EA";

// ── Helpers ───────────────────────────────────────────────────────────────────
const rupee = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const numWeight = (v: any): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopRec   { _id: string; name: string; }
interface NoteRec   { _id: string; shopId: { _id: string; name: string } | string; text: string; date: string; }
interface BatchRec  {
  _id: string; batchNo: string; animalId: string; animalWeight: number;
  rate: number; cost: number; date: string; status: string;
  totalWeight: any; usableMeat: any; wastagePercent: any; head: number; ribs: number; ham: number; offals: number;
  pkgItems: { bone: number; boneless: number; mixed: number; };
}
interface SupplyRec { _id: string; shopId: { _id: string } | null; externalRecipient: { name: string }; batch: string; total: number; totalAmount: number; date: string; }
interface SaleRec   { shopId: string; date: string; billId: string; cash: number; phonePe: number; total: number; discountGiven: number; }
interface CostRec   { shopId: string; date: string; total: number; }
interface InvInRec  { shopId: string; batch: string; date: string; totalAmount: number; }

// ── Tooltip components ────────────────────────────────────────────────────────
const WfTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = d.type === "revenue" ? C_BLUE : d.type === "profit" ? C_GREEN : d.type === "loss" ? C_RED : C_RED;
  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow">
      <p className="font-bold mb-1">{d.fullLabel}</p>
      <p style={{ color }}>{d.value < 0 ? "−" : ""}{rupee(d.value)}</p>
    </div>
  );
};
const DressingTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  
  const beforePricePerKg = d.before > 0 ? d.beforeCost / d.before : 0;
  const afterPricePerKg = d.after > 0 ? d.afterValue / d.after : 0;
  const yieldPct = d.before > 0 ? Math.round((d.after / d.before) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[180px]">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 border-b border-border pb-1">Batch: {label}</p>
      
      <div className="space-y-3 mt-2">
        <div className="space-y-1">
          <p className="font-bold text-orange-500 uppercase text-[9px] tracking-wider">Before Slaughter</p>
          <div className="flex justify-between">
            <span>Weight:</span>
            <span className="font-bold">{d.before} kg</span>
          </div>
          <div className="flex justify-between">
            <span>Value:</span>
            <span className="font-bold">{rupee(d.beforeCost)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Price/kg:</span>
            <span>{rupee(beforePricePerKg)}</span>
          </div>
        </div>

        {d.after > 0 && (
          <div className="space-y-1 border-t border-border/50 pt-2">
            <div className="flex justify-between items-center mb-1">
               <p className="font-bold text-blue-600 uppercase text-[9px] tracking-wider">After Slaughter</p>
               <span className="bg-blue-100 text-blue-700 text-[9px] px-1 font-black rounded-xs">Yield: {yieldPct}%</span>
            </div>
            <div className="flex justify-between">
              <span>Weight:</span>
              <span className="font-bold">{d.after} kg</span>
            </div>
            <div className="flex justify-between">
              <span>Value:</span>
              <span className="font-bold">{rupee(d.afterValue)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Price/kg:</span>
              <span>{rupee(afterPricePerKg)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GenTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[130px] space-y-1">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{p.value?.toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
};

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-sm border border-border bg-card shadow-none overflow-hidden", className)}>
    <div className="border-l-4 border-l-[#FF6B00] px-5 py-3 bg-card border-b border-border/50">
      <span className="text-xs font-black tracking-widest uppercase" style={{ color: C_PRIMARY }}>{title}</span>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const KpiCard = ({
  label, value, sub, color = "var(--text-primary)", bg,
}: { label: string; value: string; sub?: string; color?: string; bg?: string; }) => (
  <div className={cn("rounded-sm border border-border p-4 transition-all hover:border-primary/50", bg || "bg-background")}>
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
    <p className="text-2xl font-black" style={{ color }}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</p>}
  </div>
);

const EmptyChart = ({ msg = "No data for selected period" }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
    <AlertTriangle className="w-6 h-6 mb-1" />
    <p className="text-xs font-bold uppercase tracking-wider">{msg}</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const todayStr = new Date().toISOString().split("T")[0];

  // ── State ─────────────────────────────────────────────────────────────────
  const [timeframe, setTimeframe] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Month");
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd,   setCustomEnd]   = useState(todayStr);
  const [loading, setLoading]         = useState(true);
  const [error,   setError]           = useState<string | null>(null);

  const [shops,    setShops]    = useState<ShopRec[]>([]);
  const [notes,    setNotes]    = useState<NoteRec[]>([]);
  const [batches,  setBatches]  = useState<BatchRec[]>([]);
  const [supplies, setSupplies] = useState<SupplyRec[]>([]);
  const [sales,    setSales]    = useState<SaleRec[]>([]);
  const [costs,    setCosts]    = useState<CostRec[]>([]);
  const [invIn,    setInvIn]    = useState<InvInRec[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = timeframe === "Custom" ? { from: customStart, to: customEnd } : {};

      const [shopsR, notesR, suppliesR, batchesR] = await Promise.all([
        api.get("/shops"),
        api.get("/shops/notes/all"),
        api.get("/supplies", { params }),
        api.get("/batches", { params }),
      ]);

      const shopList: ShopRec[] = shopsR.data.data || [];
      setShops(shopList);
      setNotes(notesR.data.data || []);
      setSupplies(suppliesR.data.data || []);
      setBatches(batchesR.data.data || []);

      const perShop = await Promise.all(
        shopList.map(async (s) => {
          try {
            const [sR, cR, iR] = await Promise.all([
              api.get(`/shops/${s._id}/sales`, { params }),
              api.get(`/shops/${s._id}/daily-costs`, { params }),
              api.get(`/shops/${s._id}/inventory-in`, { params }),
            ]);
            return {
              shopId: s._id,
              sales: sR.data.data || [],
              costs: cR.data.data || [],
              invIn: iR.data.data || [],
            };
          } catch (err) {
            console.error(`Failed to fetch data for shop ${s.name}:`, err);
            return { shopId: s._id, sales: [], costs: [], invIn: [] };
          }
        })
      );

      setSales(perShop.flatMap(r => r.sales.map((s: any) => ({ ...s, shopId: r.shopId }))));
      setCosts(perShop.flatMap(r => r.costs.map((c: any) => ({ ...c, shopId: r.shopId }))));
      setInvIn(perShop.flatMap(r => r.invIn.map((i: any) => ({ ...i, shopId: r.shopId }))));

    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [timeframe, customStart, customEnd]);

  useEffect(() => {
    fetchAllData();
  }, [timeframe, customStart, customEnd]); // Re-fetch only on legitimate range changes

  // ── Date range ────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    if (timeframe === "Today")      return { from: todayStr, to: todayStr };
    if (timeframe === "This Week")  return { from: new Date(now.getTime() - 7  * 86400000).toISOString().split("T")[0], to: todayStr };
    if (timeframe === "This Month") return { from: new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0], to: todayStr };
    return { from: customStart, to: customEnd };
  }, [timeframe, customStart, customEnd, todayStr]);

  const inRange = useCallback((d: string) => !!d && d >= dateRange.from && d <= dateRange.to, [dateRange]);

  // ── Filtered subsets ──────────────────────────────────────────────────────
  const fBatches  = useMemo(() => batches.filter(b => inRange(b.date)),              [batches,  inRange]);
  const fSupplies = useMemo(() => supplies.filter(s => inRange(s.date)),             [supplies, inRange]);
  const fSales    = useMemo(() => sales.filter(s => inRange(s.date) && !String(s.billId || "").startsWith("PREP")), [sales, inRange]);
  const fCosts    = useMemo(() => costs.filter(c => inRange(c.date)),                [costs,    inRange]);
  const fInvIn    = useMemo(() => invIn.filter(i => inRange(i.date)),                [invIn,    inRange]);

  // ── SECTION 1 — Cost to Revenue Pipeline ──────────────────────────────────
  const pipeline = useMemo(() => {
    const totalSales   = fSales.reduce((a, s) => a + (s.total || 0), 0);
    const totalInvIn   = fInvIn.reduce((a, i) => a + (i.totalAmount || 0), 0);
    const totalOpCost  = fCosts.reduce((a, c) => a + (c.total || 0), 0);
    const totalDisc    = fSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
    const supplyCost   = fSupplies.reduce((a, s) => a + (numWeight(s.extra)), 0);

    const totalCost    = totalInvIn + supplyCost + totalOpCost + totalDisc;
    const netProfit    = totalSales - totalCost;
    const combinedExp  = supplyCost + totalOpCost + totalDisc;

    const waterfall = [
      { name: "Inventory In", value: totalInvIn, type: "cost",    fullLabel: "Inventory In (Cost Base)" },
      { name: "Supply",       value: supplyCost, type: "cost",    fullLabel: "Supply (Inventory Out Extra)" },
      { name: "Operational",  value: totalOpCost, type: "cost",    fullLabel: "Operational Cost" },
      { name: "Discount",     value: totalDisc,   type: "cost",    fullLabel: "Discount Given" },
      { name: "Selling Price",value: totalSales,  type: "revenue", fullLabel: "Selling Price (Revenue)" },
      { name: "Business Profit", value: netProfit, type: netProfit >= 0 ? "profit" : "loss", fullLabel: "Net Business Profit (Incl. Supply)" },
    ];

    return { totalInvIn, supplyCost, totalSales, netProfit, combinedExp, waterfall };
  }, [fSales, fInvIn, fCosts, fSupplies]);

  // ── SECTION 2 — Dressing ──────────────────────────────────────────────────
  const dressing = useMemo(() => {
    const beforeKg    = fBatches.reduce((a, b) => a + (b.animalWeight || 0), 0);
    const beforeValue = fBatches.reduce((a, b) => a + (b.cost || 0), 0);  // total purchase cost

    const slaughtered = fBatches.filter(b => b.status === "Slaughtered" || b.status === "Packed");
    const afterKg     = slaughtered.reduce((a, b) => a + numWeight(b.totalWeight), 0);
    const afterValue  = slaughtered.reduce((a, b) => a + numWeight(b.totalWeight) * (b.rate || 0), 0);

    const packed     = fBatches.filter(b => b.status === "Packed");
    const packedKg   = packed.reduce((a, b) => a + (b.pkgItems?.bone || 0) + (b.pkgItems?.boneless || 0) + (b.pkgItems?.mixed || 0), 0);
    const packedVal  = packed.reduce((a, b) =>
      a + (b.pkgItems?.bone || 0) * PKG_PRICES.bone
        + (b.pkgItems?.boneless || 0) * PKG_PRICES.boneless
        + (b.pkgItems?.mixed || 0) * PKG_PRICES.mixed, 0);

    // Per-batch line chart: before vs after slaughter — includes cost & afterValue for the table
    const lineData = fBatches.map(b => {
      const bWeight = b.animalWeight || 0;
      const bCost   = b.cost || 0;
      const aWeight = numWeight(b.totalWeight);
      const aRate   = b.rate || 0;
      const aValue  = aWeight * aRate;

      return {
        name:       b.batchNo,
        before:     bWeight,
        beforeCost: bCost,
        after:      aWeight,
        afterValue: aValue,
        // Helper derived fields for easier tooltip/chart access if needed
        yield:      bWeight > 0 ? (aWeight / bWeight) * 100 : 0
      };
    }).filter(d => d.before > 0 || d.after > 0);

    // Per-batch packed bar chart
    const barData = fBatches.filter(b => b.status === "Packed").map(b => ({
      name:   b.batchNo,
      weight: (b.pkgItems?.bone || 0) + (b.pkgItems?.boneless || 0) + (b.pkgItems?.mixed || 0),
      value:  (b.pkgItems?.bone || 0) * PKG_PRICES.bone
             + (b.pkgItems?.boneless || 0) * PKG_PRICES.boneless
             + (b.pkgItems?.mixed || 0) * PKG_PRICES.mixed,
    }));

    return { beforeKg, beforeValue, afterKg, afterValue, packedKg, packedVal, lineData, barData };
  }, [fBatches]);

  // ── SECTION 3 — Supply ────────────────────────────────────────────────────
  const supplyData = useMemo(() => {
    const shopSups    = fSupplies.filter(s => !!s.shopId);
    const otherSups   = fSupplies.filter(s => !s.shopId);

    const shopValue   = shopSups.reduce((a, s) => a + (s.totalAmount || 0), 0);
    const otherValue  = otherSups.reduce((a, s) => a + (s.totalAmount || 0), 0);
    const shopKg      = shopSups.reduce((a, s) => a + (s.total || 0), 0);
    const otherKg     = otherSups.reduce((a, s) => a + (s.total || 0), 0);
    const supplyExtra = fSupplies.reduce((a, s) => a + (numWeight(s.extra)), 0);
    
    const totalInvSales = shopValue + otherValue;
    const diffPct       = otherValue > 0 ? Math.round((shopValue / otherValue - 1) * 100) : 100;

    // Per-batch line chart (kg)
    const batchMap: Record<string, { name: string; shopKg: number; otherKg: number; extra: number }> = {};
    fSupplies.forEach(s => {
      const bkey = s.batch || "Unbatched";
      if (!batchMap[bkey]) batchMap[bkey] = { name: bkey, shopKg: 0, otherKg: 0, extra: 0 };
      if (s.shopId) batchMap[bkey].shopKg += (s.total || 0);
      else          batchMap[bkey].otherKg += (s.total || 0);
      batchMap[bkey].extra += numWeight(s.extra);
    });
    const lineData = Object.values(batchMap).filter(d => d.shopKg > 0 || d.otherKg > 0);

    return { shopValue, otherValue, shopKg, otherKg, totalInvSales, diffPct, lineData, supplyExtra };
  }, [fSupplies]);

  const shopSalesData = useMemo(() => {
    const batchMap: Record<string, {
      name: string; inventoryIn: number; salesValue: number;
      discount: number; opCost: number; shopProfit: number;
    }> = {};

    // 1. Accumulate Inventory In per batch
    fInvIn.forEach(i => {
      if (!batchMap[i.batch]) batchMap[i.batch] = { name: i.batch, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
      batchMap[i.batch].inventoryIn += (i.totalAmount || 0);
    });

    // 2. Identify shops per batch to attribute Sales/Costs
    const batchShops: Record<string, Set<string>> = {};
    fInvIn.forEach(i => {
      if (!batchShops[i.batch]) batchShops[i.batch] = new Set();
      batchShops[i.batch].add(i.shopId);
    });

    // 3. Aggregate Sales/Costs per batch via attributed shops
    Object.keys(batchShops).forEach(batchNo => {
      const shopIds = batchShops[batchNo];
      const batchSales = fSales.filter(s => shopIds.has(s.shopId));
      const batchCosts = fCosts.filter(c => shopIds.has(c.shopId));
      
      const salesVal = batchSales.reduce((a, s) => a + (s.total || 0), 0);
      const discVal  = batchSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
      const opVal    = batchCosts.reduce((a, c) => a + (c.total || 0), 0);
      const invVal   = batchMap[batchNo].inventoryIn;

      batchMap[batchNo].salesValue = salesVal;
      batchMap[batchNo].discount   = discVal;
      batchMap[batchNo].opCost     = opVal;
      // shop_profit = sales - (inventoryIn + operational + discount)
      batchMap[batchNo].shopProfit = salesVal - (invVal + opVal + discVal);
    });

    return Object.values(batchMap).filter(b => b.inventoryIn > 0 || b.salesValue > 0);
  }, [fInvIn, fSales, fCosts]);

  // ── Notes grouped ─────────────────────────────────────────────────────────
  const notesList = useMemo(() => notes.map(n => ({
    shopName: typeof n.shopId === "object" ? n.shopId.name : "Shop",
    text: n.text,
    date: n.date,
  })), [notes]);

  // ── Load / error ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col h-[60vh] items-center justify-center text-muted-foreground">
      <Loader2 className="h-10 w-10 animate-spin mb-3 text-primary" />
      <p className="text-sm font-semibold">Loading dashboard…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col h-[60vh] items-center justify-center text-center p-8">
      <AlertTriangle className="h-10 w-10 mb-3 text-destructive" />
      <h2 className="text-lg font-bold mb-2">Failed to load dashboard</h2>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button onClick={() => window.location.reload()} className="bg-primary text-white rounded-sm">Retry</Button>
    </div>
  );

  const { rawCost, combinedExp, selling, netProfit, waterfall } = pipeline;
  const { beforeKg, beforeValue, afterKg, afterValue, packedKg, packedVal } = dressing;
  const { shopValue, otherValue, shopKg, otherKg, totalInvSales, diffPct } = supplyData;

  return (
    <div className="animate-fade-in pb-16 w-full space-y-5">

      {/* ── SHOP NOTES TICKER ── */}
      {notesList.length > 0 && (
        <div className="w-full bg-card border border-border rounded-sm px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">Shop Notes</span>
          {notesList.map((n, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-border">|</span>}
              <span className="font-black text-xs" style={{ color: C_PRIMARY }}>{n.shopName} →</span>
              <span className="text-foreground text-xs">{n.text}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── DATE FILTER BAR ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mr-1">Date Filter:</span>
        <div className="p-1 flex items-center gap-1 rounded-sm border bg-card" style={{ borderColor: "var(--border)" }}>
          {(["Today", "This Week", "This Month", "Custom"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={cn(
                "px-4 py-1.5 rounded-sm text-sm font-bold transition-all whitespace-nowrap",
                timeframe === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
              )}
            >{t}</button>
          ))}
        </div>
        {timeframe === "Custom" && (
          <div className="flex items-center gap-2 bg-card border rounded-sm px-3 py-1">
            <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start" />
            <span className="text-muted-foreground font-bold">–</span>
            <AdvancedDatePicker value={customEnd}   onChange={setCustomEnd}   placeholder="End" />
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 — COST TO REVENUE PIPELINE
      ════════════════════════════════════════════════════════════════════════ */}
      <Section
        title="Cost to Revenue Pipeline"
        subtitle="Global aggregation across all shops: Inv In → Overheads → Revenue → Business Profit"
      >
        {/* 4 KPI cards as per requirements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Inventory In Value" value={rupee(pipeline.totalInvIn)} sub="Cost of meat supplied" />
          <KpiCard label="Combined Overheads" value={rupee(pipeline.combinedExp)} sub="Supply + Operational + Discount" />
          <KpiCard label="Total Sales Revenue" value={rupee(pipeline.totalSales)} color={C_BLUE} sub="Aggregated across all shops" />
          <KpiCard
            label="Net Business Profit"
            value={`${pipeline.netProfit < 0 ? "−" : "+"}${rupee(pipeline.netProfit)}`}
            color={pipeline.netProfit >= 0 ? C_GREEN : C_RED}
            bg={pipeline.netProfit >= 0 ? "bg-green-50/50" : "bg-red-50/50"}
            sub="Incl. Supply (Extra)"
          />
        </div>

        <div className="flex items-center gap-4 mb-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_RED }} /> Costs</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_BLUE }} /> Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_GREEN }} /> Profit</span>
        </div>

        {/* Waterfall bar chart */}
        <div style={{ height: 320 }}>
          {pipeline.waterfall.every(d => d.value === 0)
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline.waterfall} margin={{ top: 30, right: 20, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "var(--chart-text)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <RechartsTooltip content={<WfTooltip />} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
                  <Bar dataKey="value" maxBarSize={60} radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="value" position="top" fontSize={10} fontWeight={800} fill="var(--chart-text)"
                      formatter={(v: number) => v === 0 ? "" : `₹${Math.round(v).toLocaleString("en-IN")}`}
                    />
                    {pipeline.waterfall.map((d, i) => (
                      <Cell key={i} fill={d.type === "revenue" ? C_BLUE : d.type === "profit" ? C_GREEN : d.type === "loss" ? C_RED : C_RED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2 — DRESSING
      ════════════════════════════════════════════════════════════════════════ */}
      <Section title="Dressing" subtitle="Before Slaughter → After Slaughter → Packed">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Before Slaughter Weight" value={`${beforeKg.toLocaleString("en-IN")} kg`} sub={`Value: ${rupee(beforeValue)}`} />
          <KpiCard label="After Slaughter Weight"  value={`${afterKg.toLocaleString("en-IN")} kg`}  color={C_PRIMARY} sub={`Value: ${rupee(afterValue)}`} />
          <KpiCard label="Packed Weight"            value={`${packedKg.toLocaleString("en-IN")} kg`} />
          <KpiCard label="Packed Value"             value={rupee(packedVal)} color={C_BLUE} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Before vs After Weight (kg) */}
          <div className="bg-background/50 p-4 rounded-sm border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B00] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF6B00]" /> Slaughter weight (kg)
            </p>
            <div style={{ height: 250 }}>
              {dressing.lineData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dressing.lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} />
                      <RechartsTooltip content={<DressingTooltip />} />
                      <Line type="monotone" dataKey="before" name="Before" stroke={C_ORANGE} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="after"  name="After"  stroke={C_BLUE}   strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              }
            </div>
            <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_ORANGE }} /> Before</span>
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: C_BLUE }} /> After</span>
            </div>
          </div>

          {/* Chart 2: Packed Weight & Value per batch */}
          <div className="bg-background/50 p-4 rounded-sm border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9333EA] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9333EA]" /> Packed Weight &amp; Value
            </p>
            <div style={{ height: 250 }}>
              {dressing.barData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dressing.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Bar yAxisId="l" dataKey="weight" name="Packed kg" fill={C_GREEN} maxBarSize={20} radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="r" dataKey="value"  name="Packed ₹" fill={C_BLUE}  maxBarSize={20} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
            <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_GREEN }} /> Weight (kg)</span>
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_BLUE }} /> Value (₹)</span>
            </div>
          </div>
        </div>

      </Section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 — SUPPLY
      ════════════════════════════════════════════════════════════════════════ */}
      <Section title="Supply" subtitle="Global supply distribution and extra processing costs">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: KPI column */}
          <div className="flex flex-col gap-3">
            <KpiCard label="Total Inventory Sales" value={rupee(totalInvSales)} sub="Shop + External Recipient" />
            <div className="rounded-sm border border-border p-4 transition-all bg-green-50/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Shop Supply</p>
              <p className="text-2xl font-black text-green-700">{rupee(shopValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-bold tracking-tight">{shopKg.toLocaleString("en-IN")} kg shipped</p>
            </div>
            <div className="rounded-sm border border-border p-4 transition-all bg-blue-50/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Other Supply</p>
              <p className="text-2xl font-black text-blue-700">{rupee(otherValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-bold tracking-tight">{otherKg.toLocaleString("en-IN")} kg shipped</p>
            </div>
            <div className="rounded-sm border border-border p-4 transition-all bg-orange-50/30">
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Supply Cost (Extra)</p>
               <p className="text-2xl font-black text-orange-700">{rupee(supplyData.supplyExtra)}</p>
               <p className="text-[10px] text-muted-foreground mt-0.5 font-bold tracking-tight">Source: Inventory Out Extra</p>
            </div>
          </div>

          {/* Right: Line chart shop vs other supply per batch */}
          <div className="lg:col-span-2 bg-background/30 p-4 rounded-sm border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Supply Weights & Extra Costs per Batch</p>
            <div style={{ height: 300 }}>
              {supplyData.lineData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={supplyData.lineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="kg" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="inr" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${v/1000}k`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                      <Bar yAxisId="kg" type="monotone" dataKey="shopKg"  name="Shop Supply (kg)"  fill={C_GREEN} radius={[2, 2, 0, 0]} maxBarSize={30} />
                      <Bar yAxisId="kg" type="monotone" dataKey="otherKg" name="Other Supply (kg)" fill={C_BLUE} radius={[2, 2, 0, 0]} maxBarSize={30} />
                      <Line yAxisId="inr" type="monotone" dataKey="extra" name="Extra Cost (₹)" stroke={C_ORANGE} strokeWidth={3} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 — SHOP SALES
      ════════════════════════════════════════════════════════════════════════ */}
      <Section title="Shop Sales" subtitle="Inventory In → Sales → Discount → Operational Cost → Profit/Loss">
        {shopSalesData.length === 0
          ? (
            <div className="h-48 flex items-center justify-center">
              <EmptyChart msg="No sales data for this period" />
            </div>
          )
          : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* Left: Stacked bar chart */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Sales Breakdown per Batch</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shopSalesData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <Bar dataKey="inventoryIn" name="Inventory In (₹)" stackId="a" fill={C_BLUE}   maxBarSize={40} />
                      <Bar dataKey="salesValue"  name="Sales (₹)"        stackId="a" fill={C_GREEN}  maxBarSize={40} />
                      <Bar dataKey="discount"    name="Discount (₹)"     stackId="a" fill={C_RED}    maxBarSize={40} />
                      <Bar dataKey="opCost"      name="Operational (₹)"  stackId="a" fill={C_ORANGE} maxBarSize={40} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Profit / Loss bar + trend line */}
              <div className="bg-background/30 p-4 rounded-sm border border-border/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4 font-black">Shop Profit (Excl. Supply)</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={shopSalesData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                      <Bar dataKey="shopProfit" name="Shop Profit/Loss (₹)" maxBarSize={40} radius={[2, 2, 0, 0]}>
                        {shopSalesData.map((d, i) => (
                          <Cell key={i} fill={d.shopProfit >= 0 ? C_GREEN : C_RED} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="shopProfit" name="Trend" stroke={C_ORANGE} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[9px] text-muted-foreground mt-3 italic">* Logic: Sales - (Inv In + Operational + Discount)</p>
              </div>

            </div>
          )
        }
      </Section>

      {/* ── Footer ── */}
      <div className="text-center text-[10px] text-muted-foreground font-medium tracking-wider pt-2">
        PINAKA RETAIL ERP &bull; Data refreshes on filter change &bull; All values in INR (₹)
      </div>

    </div>
  );
}
