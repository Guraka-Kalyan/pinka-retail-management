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
const PKG_PRICES = { bone: 350, boneless: 400, mixed: 380, skin: 50, meat: 450 };

// ── Colours ───────────────────────────────────────────────────────────────────
const C_PRIMARY = "#FF6B00";
const C_RED     = "#DC2626";
const C_BLUE    = "#2563EB";
const C_GREEN   = "#16A34A";
const C_ORANGE  = "#F59E0B";
const C_PURPLE  = "#9333EA";

// ── Helpers ───────────────────────────────────────────────────────────────────
const rupee = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const numWeight = (v: any): number => (typeof v === "number" ? v : 0);

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopRec   { _id: string; name: string; }
interface NoteRec   { _id: string; shopId: { _id: string; name: string } | string; text: string; date: string; }
interface BatchRec  {
  _id: string; batchNo: string; animalId: string; animalWeight: number;
  rate: number; cost: number; date: string; status: string;
  totalWeight: any; usableMeat: any; wastagePercent: any; head: number; ribs: number; ham: number; offals: number;
  pkgItems: { bone: number; boneless: number; mixed: number; skin: number; meat: number; };
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
const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="rounded-sm border border-border bg-card shadow-none overflow-hidden">
    <div className="border-l-4 border-l-[#FF6B00] px-5 py-3 bg-card">
      <span className="text-xs font-black tracking-widest uppercase" style={{ color: C_PRIMARY }}>{title}</span>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const KpiCard = ({
  label, value, sub, color = "var(--text-primary)", bg,
}: { label: string; value: string; sub?: string; color?: string; bg?: string; }) => (
  <div className={cn("rounded-sm border border-border p-4", bg || "bg-background")}>
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
    <p className="text-2xl font-black" style={{ color }}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
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
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [shopsR, notesR, suppliesR, batchesR] = await Promise.all([
          api.get("/shops"),
          api.get("/shops/notes/all"),
          api.get("/supplies"),
          api.get("/batches"),
        ]);

        const shopList: ShopRec[] = shopsR.data.data || [];
        setShops(shopList);
        setNotes(notesR.data.data || []);
        setSupplies(suppliesR.data.data || []);
        setBatches(batchesR.data.data || []);

        // Log API samples as required
        console.log("[Dashboard] /api/supplies sample:", (suppliesR.data.data || [])[0]);
        console.log("[Dashboard] /api/batches  sample:", (batchesR.data.data  || [])[0]);

        const perShop = await Promise.all(
          shopList.map(s =>
            Promise.all([
              api.get(`/shops/${s._id}/sales`),
              api.get(`/shops/${s._id}/daily-costs`),
              api.get(`/shops/${s._id}/inventory-in`),
            ]).then(([sR, cR, iR]) => ({
              shopId: s._id,
              sales:  sR.data.data || [],
              costs:  cR.data.data || [],
              invIn:  iR.data.data || [],
            }))
          )
        );

        const allSales  = perShop.flatMap(r => r.sales.map((s: any)  => ({ ...s, shopId: r.shopId })));
        const allCosts  = perShop.flatMap(r => r.costs.map((c: any)  => ({ ...c, shopId: r.shopId })));
        const allInvIn  = perShop.flatMap(r => r.invIn.map((i: any)  => ({ ...i, shopId: r.shopId })));

        console.log("[Dashboard] sales  sample:", allSales[0]);
        console.log("[Dashboard] costs  sample:", allCosts[0]);
        console.log("[Dashboard] invIn  sample:", allInvIn[0]);

        setSales(allSales);
        setCosts(allCosts);
        setInvIn(allInvIn);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    const rawCost      = fBatches.reduce((a, b) => a + (b.cost || 0), 0);
    const extSupply    = fSupplies.filter(s => !s.shopId && s.externalRecipient?.name).reduce((a, s) => a + (s.totalAmount || 0), 0);
    const opCost       = fCosts.reduce((a, c) => a + (c.total || 0), 0);
    const discount     = fSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
    const selling      = fSales.reduce((a, s) => a + (s.total        || 0), 0);
    const netProfit    = selling - (rawCost + extSupply + opCost + discount);
    const combinedExp  = extSupply + opCost + discount;

    const waterfall = [
      { name: "Raw Cost",    value: rawCost,   type: "cost",                          fullLabel: "Total Raw Cost" },
      { name: "Supply",      value: extSupply, type: "cost",                          fullLabel: "External Supply" },
      { name: "Operational", value: opCost,    type: "cost",                          fullLabel: "Operational Cost" },
      { name: "Discount",    value: discount,  type: "cost",                          fullLabel: "Discount Given" },
      { name: "Selling Price", value: selling, type: "revenue",                       fullLabel: "Total Sales Revenue" },
      { name: "Profit",        value: netProfit, type: netProfit >= 0 ? "profit" : "loss", fullLabel: "Net Profit / Loss" },
    ];

    return { rawCost, combinedExp, selling, netProfit, waterfall };
  }, [fBatches, fSupplies, fCosts, fSales]);

  // ── SECTION 2 — Dressing ──────────────────────────────────────────────────
  const dressing = useMemo(() => {
    const beforeKg = fBatches.reduce((a, b) => a + (b.animalWeight || 0), 0);

    const slaughtered = fBatches.filter(b => b.status === "Slaughtered" || b.status === "Packed");
    const afterKg     = slaughtered.reduce((a, b) => a + numWeight(b.totalWeight), 0);
    const afterValue  = slaughtered.reduce((a, b) => a + numWeight(b.totalWeight) * (b.rate || 0), 0);

    const packed     = fBatches.filter(b => b.status === "Packed");
    const packedKg   = packed.reduce((a, b) => a + (b.pkgItems?.bone || 0) + (b.pkgItems?.boneless || 0) + (b.pkgItems?.mixed || 0) + (b.pkgItems?.skin || 0) + (b.pkgItems?.meat || 0), 0);
    const packedVal  = packed.reduce((a, b) =>
      a + (b.pkgItems?.bone || 0) * PKG_PRICES.bone
        + (b.pkgItems?.boneless || 0) * PKG_PRICES.boneless
        + (b.pkgItems?.mixed || 0) * PKG_PRICES.mixed
        + (b.pkgItems?.skin || 0) * PKG_PRICES.skin
        + (b.pkgItems?.meat || 0) * PKG_PRICES.meat, 0);

    // Per-batch line chart: before vs after slaughter
    const lineData = fBatches.map(b => ({
      name:   b.batchNo,
      before: b.animalWeight || 0,
      after:  numWeight(b.totalWeight),
    })).filter(d => d.before > 0 || d.after > 0);

    // Per-batch packed bar chart
    const barData = fBatches.filter(b => b.status === "Packed").map(b => ({
      name:   b.batchNo,
      weight: (b.pkgItems?.bone || 0) + (b.pkgItems?.boneless || 0) + (b.pkgItems?.mixed || 0) + (b.pkgItems?.skin || 0) + (b.pkgItems?.meat || 0),
      value:  (b.pkgItems?.bone || 0) * PKG_PRICES.bone
             + (b.pkgItems?.boneless || 0) * PKG_PRICES.boneless
             + (b.pkgItems?.mixed || 0) * PKG_PRICES.mixed
             + (b.pkgItems?.skin || 0) * PKG_PRICES.skin
             + (b.pkgItems?.meat || 0) * PKG_PRICES.meat,
    }));

    return { beforeKg, afterKg, afterValue, packedKg, packedVal, lineData, barData };
  }, [fBatches]);

  // ── SECTION 3 — Supply ────────────────────────────────────────────────────
  const supplyData = useMemo(() => {
    const shopSups  = fSupplies.filter(s => !!s.shopId);
    const otherSups = fSupplies.filter(s => !s.shopId && s.externalRecipient?.name);

    const shopValue  = shopSups.reduce((a, s)  => a + (s.totalAmount || 0), 0);
    const otherValue = otherSups.reduce((a, s) => a + (s.totalAmount || 0), 0);
    const shopKg     = shopSups.reduce((a, s)  => a + (s.total       || 0), 0);
    const otherKg    = otherSups.reduce((a, s) => a + (s.total       || 0), 0);
    const totalInvSales = shopValue + otherValue;
    const diffPct    = otherValue > 0 ? Math.round((shopValue / otherValue - 1) * 100) : 100;

    // Per-batch line chart
    const batchMap: Record<string, { name: string; shopKg: number; otherKg: number }> = {};
    batches.forEach(b => { batchMap[b.batchNo] = { name: b.batchNo, shopKg: 0, otherKg: 0 }; });
    fSupplies.forEach(s => {
      if (!batchMap[s.batch]) batchMap[s.batch] = { name: s.batch, shopKg: 0, otherKg: 0 };
      if (s.shopId) batchMap[s.batch].shopKg     += (s.total || 0);
      else          batchMap[s.batch].otherKg    += (s.total || 0);
    });
    const lineData = Object.values(batchMap).filter(d => d.shopKg > 0 || d.otherKg > 0);

    return { shopValue, otherValue, shopKg, otherKg, totalInvSales, diffPct, lineData };
  }, [fSupplies, batches]);

  // ── SECTION 4 — Shop Sales per batch ─────────────────────────────────────
  const shopSalesData = useMemo(() => {
    // BatchNo → shopIds that received it this period
    const batchShops: Record<string, Set<string>> = {};
    fInvIn.forEach(i => {
      if (!batchShops[i.batch]) batchShops[i.batch] = new Set();
      batchShops[i.batch].add(i.shopId);
    });

    const batchMap: Record<string, {
      name: string; inventoryIn: number; salesValue: number;
      discount: number; opCost: number; shopProfit: number;
    }> = {};

    batches.forEach(b => {
      batchMap[b.batchNo] = { name: b.batchNo, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
    });
    fInvIn.forEach(i => {
      if (!batchMap[i.batch]) batchMap[i.batch] = { name: i.batch, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
      batchMap[i.batch].inventoryIn += (i.totalAmount || 0);
    });
    Object.keys(batchShops).forEach(batchNo => {
      const ids = batchShops[batchNo];
      const bs  = fSales.filter(s => ids.has(s.shopId));
      const bc  = fCosts.filter(c => ids.has(c.shopId));
      if (!batchMap[batchNo]) batchMap[batchNo] = { name: batchNo, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
      batchMap[batchNo].salesValue = bs.reduce((a, s) => a + (s.total         || 0), 0);
      batchMap[batchNo].discount   = bs.reduce((a, s) => a + (s.discountGiven || 0), 0);
      batchMap[batchNo].opCost     = bc.reduce((a, c) => a + (c.total         || 0), 0);
      batchMap[batchNo].shopProfit =
        batchMap[batchNo].salesValue - batchMap[batchNo].inventoryIn -
        batchMap[batchNo].opCost - batchMap[batchNo].discount;
    });
    return Object.values(batchMap).filter(b => b.inventoryIn > 0 || b.salesValue > 0);
  }, [batches, fInvIn, fSales, fCosts]);

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
  const { beforeKg, afterKg, afterValue, packedKg, packedVal } = dressing;
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
        subtitle="Per-batch average breakdown: Raw → Processing → Packaging → Supply → Operational → Discount → Selling Price → Profit"
      >
        {/* 4 KPI mini-cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Total Raw Cost"                   value={rupee(rawCost)}     color={C_RED} />
          <KpiCard label="Discount + Operational Costs + Supply" value={rupee(combinedExp)} />
          <KpiCard label="Total Sales Revenue"              value={rupee(selling)}     color={C_BLUE} />
          <KpiCard
            label="Net Profit / Loss"
            value={`${netProfit < 0 ? "−" : "+"}${rupee(netProfit)}`}
            color={netProfit >= 0 ? C_GREEN : C_RED}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 text-xs font-bold">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: C_RED }} /> Costs</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: C_BLUE }} /> Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: C_GREEN }} /> Profit</span>
        </div>

        {/* Waterfall bar chart */}
        <div style={{ height: 300 }}>
          {waterfall.every(d => d.value === 0)
            ? <EmptyChart />
            : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfall} margin={{ top: 28, right: 16, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--chart-text)" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <RechartsTooltip content={<WfTooltip />} cursor={{ fill: "var(--chart-bg)" }} />
                  <Bar dataKey="value" maxBarSize={70} radius={[2, 2, 0, 0]}>
                    <LabelList dataKey="value" position="top" fontSize={10} fill="var(--chart-text)"
                      formatter={(v: number) => v > 0 ? `₹${Math.round(v).toLocaleString("en-IN")}` : v < 0 ? `−₹${Math.round(Math.abs(v)).toLocaleString("en-IN")}` : ""}
                    />
                    {waterfall.map((d, i) => (
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
        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Before Slaughter Weight" value={`${beforeKg.toLocaleString("en-IN")} kg`} />
          <KpiCard label="After Slaughter Weight"  value={`${afterKg.toLocaleString("en-IN")} kg`}  color={C_PRIMARY} sub={`Value: ${rupee(afterValue)}`} />
          <KpiCard label="Packed Weight"            value={`${packedKg.toLocaleString("en-IN")} kg`} />
          <KpiCard label="Packed Value"             value={rupee(packedVal)} color={C_BLUE} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Before vs After line chart */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Before vs After Slaughter Weight (kg)</p>
            <div style={{ height: 240 }}>
              {dressing.lineData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dressing.lineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <Line type="monotone" dataKey="before" name="Before Slaughter" stroke={C_ORANGE} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="after"  name="After Slaughter"  stroke={C_BLUE}   strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Right: Packed weight & value per batch */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Packed Weight &amp; Value per Batch</p>
            <div style={{ height: 240 }}>
              {dressing.barData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dressing.barData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <Bar yAxisId="l" dataKey="weight" name="Packed Weight (kg)" fill={C_GREEN}  maxBarSize={30} radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="r" dataKey="value"  name="Packed Value (₹)"  fill={C_BLUE}   maxBarSize={30} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 — SUPPLY
      ════════════════════════════════════════════════════════════════════════ */}
      <Section title="Supply" subtitle="Shop Supply vs Other Supply">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: KPI column */}
          <div className="flex flex-col gap-3">
            <div className="rounded-sm border border-border p-4 bg-background">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Inventory Sales</p>
              <p className="text-2xl font-black text-foreground">{rupee(totalInvSales)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Shop + Others</p>
            </div>
            <div className="rounded-sm border border-border p-4" style={{ backgroundColor: "#F0FDF4" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Shop Supply</p>
              <p className="text-2xl font-black" style={{ color: C_GREEN }}>{rupee(shopValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{shopKg.toLocaleString("en-IN")} kg</p>
            </div>
            <div className="rounded-sm border border-border p-4" style={{ backgroundColor: "#FFFBEB" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Other Supply</p>
              <p className="text-2xl font-black" style={{ color: C_ORANGE }}>{rupee(otherValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{otherKg.toLocaleString("en-IN")} kg</p>
            </div>
            {shopValue > 0 && otherValue > 0 && (
              <div className="rounded-sm border border-border p-3 bg-primary/5 text-xs font-bold text-primary">
                {shopValue >= otherValue
                  ? `Shop supply higher by ${diffPct}%`
                  : `Other supply higher by ${Math.round((otherValue / shopValue - 1) * 100)}%`
                }
              </div>
            )}
          </div>

          {/* Right: Line chart shop vs other supply per batch */}
          <div className="lg:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Shop vs Other Supply (kg)</p>
            <div style={{ height: 280 }}>
              {supplyData.lineData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={supplyData.lineData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <Line type="monotone" dataKey="shopKg"  name="Shop Supply (kg)"  stroke={C_GREEN}  strokeWidth={2} dot={{ r: 3, fill: C_GREEN }} />
                      <Line type="monotone" dataKey="otherKg" name="Other Supply (kg)" stroke={C_BLUE}   strokeWidth={2} dot={{ r: 3, fill: C_BLUE }}  />
                    </LineChart>
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
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Profit / Loss per Batch</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={shopSalesData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <RechartsTooltip content={<GenTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                      <Bar dataKey="shopProfit" name="Profit/Loss (₹)" maxBarSize={40} radius={[2, 2, 0, 0]}>
                        {shopSalesData.map((d, i) => (
                          <Cell key={i} fill={d.shopProfit >= 0 ? C_GREEN : C_RED} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="shopProfit" name="Trend" stroke={C_ORANGE} strokeWidth={2} dot={{ r: 3, fill: C_ORANGE }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
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
