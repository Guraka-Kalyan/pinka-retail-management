import { useState, useMemo, useEffect, useCallback } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import {
  TrendingUp, TrendingDown, Activity, AlertTriangle, Loader2,
  Wallet, Smartphone, Store, IndianRupee, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell, ComposedChart, Line, ReferenceLine
} from "recharts";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShopRecord { _id: string; name: string; }
interface NoteRecord {
  _id: string;
  shopId: { _id: string; name: string } | string;
  text: string;
  date: string;
}
interface SaleRecord {
  shopId: string; date: string; billId: string;
  cash: number; phonePe: number; total: number; discountGiven: number;
}
interface CostRecord { shopId: string; date: string; total: number; }
interface InvInRecord { shopId: string; batch: string; date: string; totalAmount: number; }
interface SupplyRecord {
  _id: string;
  shopId: { _id: string; name: string } | null;
  externalRecipient: { name: string };
  batch: string; totalAmount: number; date: string;
}
interface BatchRecord {
  _id: string; batchNo: string; animalId: string;
  animalWeight: number; rate: number; cost: number;
  date: string; status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const C_COST    = "#DC2626";
const C_REVENUE = "#2563EB";
const C_PROFIT  = "#16A34A";
const C_PRIMARY = "#FF6B00";
const C_OPEX    = "#9333EA";
const C_DISC    = "#F59E0B";

const fmt = (n: number) =>
  `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;

// ─── Custom Tooltips ──────────────────────────────────────────────────────────
const WaterfallTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const color = d.type === "revenue" ? C_REVENUE
    : d.type === "profit" ? C_PROFIT
    : d.type === "loss"   ? C_COST : C_COST;
  return (
    <div className="bg-card border border-border rounded-sm p-3 shadow-sm text-xs">
      <p className="font-bold text-foreground mb-1">{d.label}</p>
      <p className="font-semibold" style={{ color }}>
        {d.value < 0 ? "−" : ""}{fmt(d.value)}
      </p>
    </div>
  );
};

const BatchTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-sm p-3 shadow-sm text-xs space-y-1 min-w-[140px]">
      <p className="font-bold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PLTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="bg-card border border-border rounded-sm p-3 shadow-sm text-xs">
      <p className="font-bold text-foreground mb-1">{label}</p>
      <p className="font-semibold" style={{ color: val >= 0 ? C_PROFIT : C_COST }}>
        {val < 0 ? "−" : ""}{fmt(val)} {val >= 0 ? "Profit" : "Loss"}
      </p>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const todayStr = new Date().toISOString().split("T")[0];

  // State
  const [timeframe, setTimeframe] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Week");
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data
  const [shopsList, setShopsList]           = useState<ShopRecord[]>([]);
  const [notes, setNotes]                   = useState<NoteRecord[]>([]);
  const [allSales, setAllSales]             = useState<SaleRecord[]>([]);
  const [allCosts, setAllCosts]             = useState<CostRecord[]>([]);
  const [allInvIn, setAllInvIn]             = useState<InvInRecord[]>([]);
  const [allSupplies, setAllSupplies]       = useState<SupplyRecord[]>([]);
  const [allBatches, setAllBatches]         = useState<BatchRecord[]>([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [shopsRes, notesRes, suppliesRes, batchesRes] = await Promise.all([
          api.get("/shops"),
          api.get("/shops/notes/all"),
          api.get("/supplies"),
          api.get("/batches"),
        ]);

        const shops: ShopRecord[] = shopsRes.data.data || [];
        setShopsList(shops);
        setNotes(notesRes.data.data || []);
        setAllSupplies(suppliesRes.data.data || []);
        setAllBatches(batchesRes.data.data || []);

        // Per-shop data in parallel
        const perShop = await Promise.all(
          shops.map(s =>
            Promise.all([
              api.get(`/shops/${s._id}/sales`),
              api.get(`/shops/${s._id}/daily-costs`),
              api.get(`/shops/${s._id}/inventory-in`),
            ]).then(([salesR, costsR, invR]) => ({
              shopId: s._id,
              sales:  salesR.data.data || [],
              costs:  costsR.data.data || [],
              invIn:  invR.data.data   || [],
            }))
          )
        );

        const sales:  SaleRecord[]  = perShop.flatMap(r => r.sales.map((s: any)  => ({ ...s, shopId: r.shopId })));
        const costs:  CostRecord[]  = perShop.flatMap(r => r.costs.map((c: any)  => ({ ...c, shopId: r.shopId })));
        const invIn:  InvInRecord[] = perShop.flatMap(r => r.invIn.map((i: any)  => ({ ...i, shopId: r.shopId })));

        setAllSales(sales);
        setAllCosts(costs);
        setAllInvIn(invIn);

        // Debug logs as required
        console.log("[Dashboard] /api/supplies sample:", suppliesRes.data.data?.[0]);
        console.log("[Dashboard] /api/batches sample:",  batchesRes.data.data?.[0]);
        console.log("[Dashboard] sales sample:",  sales[0]);
        console.log("[Dashboard] costs sample:",  costs[0]);
        console.log("[Dashboard] invIn sample:",  invIn[0]);

      } catch (err: any) {
        console.error("[Dashboard] fetch error:", err);
        setError(err?.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Date Range ────────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    if (timeframe === "Today")      return { from: todayStr, to: todayStr };
    if (timeframe === "This Week")  return { from: new Date(now.getTime() - 7  * 86400000).toISOString().split("T")[0], to: todayStr };
    if (timeframe === "This Month") return { from: new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0], to: todayStr };
    return { from: customStart, to: customEnd };
  }, [timeframe, customStart, customEnd, todayStr]);

  const inRange = useCallback((date: string) =>
    !!date && date >= dateRange.from && date <= dateRange.to,
  [dateRange]);

  // ── KPI Aggregation ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const fSales    = allSales.filter(s => inRange(s.date) && !String(s.billId || "").startsWith("PREP"));
    const fCosts    = allCosts.filter(c => inRange(c.date));
    const fInvIn    = allInvIn.filter(i => inRange(i.date));
    const fSupplies = allSupplies.filter(s => inRange(s.date));

    const totalSales      = fSales.reduce((a, s) => a + (s.total         || 0), 0);
    const totalDiscount   = fSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
    const cashReceived    = fSales.reduce((a, s) => a + (s.cash          || 0), 0);
    const phonePeReceived = fSales.reduce((a, s) => a + (s.phonePe       || 0), 0);
    const operationalCost = fCosts.reduce((a, c) => a + (c.total         || 0), 0);
    const inventoryIn     = fInvIn.reduce((a, i) => a + (i.totalAmount   || 0), 0);

    // External supply cost (goods sent to external, not to registered shops)
    const externalSupplyCost = fSupplies
      .filter(s => !s.shopId && s.externalRecipient?.name)
      .reduce((a, s) => a + (s.totalAmount || 0), 0);

    // Business: totalSales - (inventoryIn + operational + externalSupply + discount)
    const businessProfit = totalSales - (inventoryIn + operationalCost + externalSupplyCost + totalDiscount);
    // Shop:     totalSales - (inventoryIn + operational + discount)
    const shopProfit     = totalSales - (inventoryIn + operationalCost + totalDiscount);
    const combinedOverheads = externalSupplyCost + operationalCost + totalDiscount;

    return {
      totalSales, totalDiscount, cashReceived, phonePeReceived,
      operationalCost, inventoryIn, externalSupplyCost,
      businessProfit, shopProfit, combinedOverheads,
      _fSales: fSales, _fCosts: fCosts, _fInvIn: fInvIn,
    };
  }, [allSales, allCosts, allInvIn, allSupplies, inRange]);

  // ── Waterfall Data ────────────────────────────────────────────────────────
  const waterfallData = useMemo(() => {
    const { inventoryIn, externalSupplyCost, operationalCost, totalDiscount, totalSales, businessProfit } = kpis;
    return [
      { name: "Inv. In",     value: inventoryIn,       type: "cost",    label: "Inventory In Value" },
      { name: "Supply",      value: externalSupplyCost, type: "cost",   label: "External Supply Cost" },
      { name: "Operational", value: operationalCost,   type: "cost",    label: "Operational Cost" },
      { name: "Discount",    value: totalDiscount,     type: "cost",    label: "Discount Given" },
      { name: "Sales",       value: totalSales,        type: "revenue", label: "Total Sales" },
      { name: "Net Profit",  value: businessProfit,    type: businessProfit >= 0 ? "profit" : "loss", label: "Net Business Profit" },
    ];
  }, [kpis]);

  // ── Batch Chart Data ──────────────────────────────────────────────────────
  const batchChartData = useMemo(() => {
    const { _fSales, _fCosts, _fInvIn } = kpis;

    // Map batchNo → shopIds that received it (from filtered invIn records)
    const batchShops: Record<string, Set<string>> = {};
    _fInvIn.forEach(i => {
      if (!batchShops[i.batch]) batchShops[i.batch] = new Set();
      batchShops[i.batch].add(i.shopId);
    });

    // Build per-batch aggregates
    const batchMap: Record<string, {
      name: string; inventoryIn: number; salesValue: number;
      discount: number; opCost: number; shopProfit: number;
    }> = {};

    // Seed from allBatches (to show even zero-data batches if needed)
    allBatches.forEach(b => {
      batchMap[b.batchNo] = { name: b.batchNo, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
    });

    // Add inventoryIn per batch
    _fInvIn.forEach(i => {
      if (!batchMap[i.batch]) batchMap[i.batch] = { name: i.batch, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
      batchMap[i.batch].inventoryIn += (i.totalAmount || 0);
    });

    // Attribute sales/costs per batch via the shops that received each batch
    Object.keys(batchShops).forEach(batchNo => {
      const shopIds = batchShops[batchNo];
      const bSales = _fSales.filter(s => shopIds.has(s.shopId));
      const bCosts = _fCosts.filter(c => shopIds.has(c.shopId));
      if (!batchMap[batchNo]) batchMap[batchNo] = { name: batchNo, inventoryIn: 0, salesValue: 0, discount: 0, opCost: 0, shopProfit: 0 };
      batchMap[batchNo].salesValue = bSales.reduce((a, s) => a + (s.total         || 0), 0);
      batchMap[batchNo].discount   = bSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
      batchMap[batchNo].opCost     = bCosts.reduce((a, c) => a + (c.total         || 0), 0);
      batchMap[batchNo].shopProfit =
        batchMap[batchNo].salesValue -
        batchMap[batchNo].inventoryIn -
        batchMap[batchNo].opCost -
        batchMap[batchNo].discount;
    });

    return Object.values(batchMap).filter(b => b.inventoryIn > 0 || b.salesValue > 0);
  }, [allBatches, kpis]);

  // ── Notes Grouping ────────────────────────────────────────────────────────
  const groupedNotes = useMemo(() => {
    const map: Record<string, { shopName: string; notes: NoteRecord[] }> = {};
    notes.forEach(n => {
      const id   = typeof n.shopId === "object" ? n.shopId._id  : String(n.shopId);
      const name = typeof n.shopId === "object" ? n.shopId.name : "Unknown Shop";
      if (!map[id]) map[id] = { shopName: name, notes: [] };
      map[id].notes.push(n);
    });
    return Object.values(map);
  }, [notes]);

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-sm font-semibold">Loading dashboard data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center text-center p-8">
        <AlertTriangle className="h-10 w-10 mb-4 text-destructive" />
        <h2 className="text-lg font-bold text-foreground mb-2">Failed to load dashboard</h2>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} className="bg-primary text-white rounded-sm">Retry</Button>
      </div>
    );
  }

  // Destructure for render
  const {
    totalSales, totalDiscount, cashReceived, phonePeReceived,
    operationalCost, inventoryIn, externalSupplyCost,
    businessProfit, shopProfit, combinedOverheads,
  } = kpis;

  const LABEL_CLASS = "text-xs font-black text-muted-foreground uppercase tracking-widest mb-3";
  const hasNoData   = totalSales === 0 && inventoryIn === 0 && operationalCost === 0;

  return (
    <div className="animate-fade-in pb-12 w-full space-y-8">

      <Breadcrumb items={[{ label: "Global Control Center Dashboard" }]} />

      {/* ── SECTION 1: SHOP NOTES ── */}
      {groupedNotes.length > 0 && (
        <section>
          <h2 className={LABEL_CLASS}>📌 Shop Notes</h2>
          <Card className="rounded-sm shadow-none border bg-card">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedNotes.map((group, i) => (
                  <div key={i}>
                    <h3 className="text-sm font-black mb-2" style={{ color: C_PRIMARY }}>
                      {group.shopName}
                    </h3>
                    <ul className="space-y-1.5">
                      {group.notes.map((note, j) => (
                        <li key={note._id || j} className="flex gap-2 items-start text-sm text-foreground">
                          <span className="shrink-0 mt-0.5" style={{ color: C_PRIMARY }}>•</span>
                          <span className="flex-1">{note.text}</span>
                          <span className="text-[10px] font-bold text-muted-foreground shrink-0 pt-0.5">{note.date}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Financial Control Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Global operations overview — Pinaka ERP</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-sm font-bold text-sm">
          <Store className="w-4 h-4" /> {shopsList.length} Active Shop{shopsList.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── SECTION 2: DATE FILTER BAR ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="p-1 rounded-sm flex items-center gap-1 border"
          style={{ backgroundColor: "var(--navbar-bg)", borderColor: "var(--border)" }}
        >
          {(["Today", "This Week", "This Month", "Custom"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={cn(
                "px-4 py-2 rounded-sm text-sm font-bold transition-all whitespace-nowrap",
                timeframe === t
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {timeframe === "Custom" && (
          <div className="flex items-center gap-2 bg-card border rounded-sm px-3 py-1.5">
            <AdvancedDatePicker value={customStart} onChange={val => setCustomStart(val)} placeholder="Start Date" />
            <span className="text-muted-foreground font-bold">–</span>
            <AdvancedDatePicker value={customEnd}   onChange={val => setCustomEnd(val)}   placeholder="End Date" />
          </div>
        )}

        <span className="text-xs text-muted-foreground font-medium">
          {dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} → ${dateRange.to}`}
        </span>
      </div>

      {/* ── SECTION 3: FINANCIAL KPI CARDS ── */}
      <section>
        <h2 className={LABEL_CLASS}>Financial KPIs</h2>

        {/* Big Net Result + 4 sub cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Shop Profit hero card */}
          <Card
            className={cn(
              "lg:col-span-1 rounded-sm shadow-none border-l-4 relative overflow-hidden flex flex-col items-center justify-center p-10 bg-card text-center",
              shopProfit >= 0 ? "border-l-[#16A34A]" : "border-l-[#DC2626]"
            )}
          >
            <p className="text-xs font-black tracking-widest uppercase mb-2"
               style={{ color: shopProfit >= 0 ? C_PROFIT : C_COST, opacity: 0.8 }}>
              Shop Profit (Excl. Supply)
            </p>
            <h2 className="text-5xl font-black tracking-tighter mb-3"
                style={{ color: shopProfit >= 0 ? C_PROFIT : C_COST }}>
              {shopProfit < 0 ? "−" : ""}₹{Math.abs(shopProfit).toLocaleString("en-IN")}
            </h2>
            <span
              className="text-xs font-black px-3 py-1.5 rounded-sm uppercase tracking-widest text-white"
              style={{ backgroundColor: shopProfit >= 0 ? C_PROFIT : C_COST }}
            >
              {shopProfit >= 0 ? "PROFIT" : "LOSS"}
            </span>

            {/* Business profit row */}
            <div className="mt-6 w-full pt-4 border-t border-border/40 text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Net Business Profit (Incl. Supply)
              </p>
              <p className="text-xl font-black"
                 style={{ color: businessProfit >= 0 ? C_PROFIT : C_COST }}>
                {businessProfit < 0 ? "−" : ""}₹{Math.abs(businessProfit).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="absolute right-[-32px] bottom-[-32px] opacity-[0.05] pointer-events-none">
              <Activity className="w-64 h-64" style={{ color: shopProfit >= 0 ? C_PROFIT : C_COST }} />
            </div>
          </Card>

          {/* 4 secondary KPI cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: "Total Sales",      value: totalSales,                      color: C_REVENUE, Icon: TrendingUp,    sub: `${(allSales.filter(s => inRange(s.date) && !String(s.billId||"").startsWith("PREP")).length)} bills` },
              { label: "Total Expenses",   value: operationalCost + totalDiscount, color: C_COST,    Icon: TrendingDown,  sub: `Disc ₹${Math.round(totalDiscount).toLocaleString("en-IN")} + Op ₹${Math.round(operationalCost).toLocaleString("en-IN")}` },
              { label: "Cash Received",    value: cashReceived,                    color: "#374151",  Icon: Wallet,        sub: "Retail cash payments" },
              { label: "PhonePe Received", value: phonePeReceived,                 color: "#7C3AED",  Icon: Smartphone,    sub: "Digital payments" },
            ].map(({ label, value, color, Icon, sub }) => (
              <Card key={label} className="rounded-sm shadow-none border bg-card relative overflow-hidden hover:bg-card-hover transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
                <CardContent className="p-5 pl-6">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                  </div>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">
                    ₹{Math.round(value).toLocaleString("en-IN")}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: COST → REVENUE PIPELINE ── */}
      <section>
        <h2 className={LABEL_CLASS}>Cost → Revenue Pipeline</h2>

        {/* Pipeline KPI mini-row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Inventory In Value",    value: inventoryIn,         color: C_COST,    Icon: Package },
            { label: "Combined Overheads",    value: combinedOverheads,   color: C_OPEX,    Icon: IndianRupee },
            { label: "Total Sales",           value: totalSales,          color: C_REVENUE, Icon: TrendingUp },
            {
              label: "Net Business Profit",
              value: businessProfit,
              color: businessProfit >= 0 ? C_PROFIT : C_COST,
              Icon: businessProfit >= 0 ? TrendingUp : TrendingDown,
            },
          ].map(({ label, value, color, Icon }) => (
            <Card key={label} className="rounded-sm shadow-none border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3" style={{ color }} />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                </div>
                <h4 className="text-lg font-black" style={{ color }}>
                  {value < 0 ? "−" : ""}₹{Math.abs(Math.round(value)).toLocaleString("en-IN")}
                </h4>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Waterfall Bar Chart */}
        <Card className="rounded-sm shadow-none border bg-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
              Financial Pipeline — Cost to Profit Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 h-[300px]">
            {hasNoData ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-bold uppercase tracking-widest">No data for selected period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 20, right: 16, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--chart-text)" }}
                  />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--chart-text)" }}
                    tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                  />
                  <RechartsTooltip content={<WaterfallTooltip />} cursor={{ fill: "var(--chart-bg)" }} />
                  <Bar dataKey="value" maxBarSize={60} radius={[2, 2, 0, 0]}>
                    {waterfallData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.type === "revenue" ? C_REVENUE
                          : entry.type === "profit" ? C_PROFIT
                          : entry.type === "loss"   ? C_COST
                          : C_COST
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── SECTION 5: SHOP SALES SECTION (batch-level charts) ── */}
      <section>
        <h2 className={LABEL_CLASS}>Shop Sales by Batch</h2>

        {batchChartData.length === 0 ? (
          <Card className="rounded-sm shadow-none border bg-card">
            <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest">No batch data available for this period</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* LEFT — Stacked Bar: Inventory In, Sales, Discount, Op Cost per batch */}
            <Card className="rounded-sm shadow-none border bg-card">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  Batch Breakdown — Inv. In vs Sales vs Costs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={batchChartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--chart-text)" }}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--chart-text)" }}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                    />
                    <RechartsTooltip content={<BatchTooltip />} cursor={{ fill: "var(--chart-bg)" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                      formatter={v => <span style={{ color: "var(--chart-text)" }}>{v}</span>}
                    />
                    <Bar dataKey="inventoryIn" name="Inventory In"    stackId="a" fill={C_COST}    maxBarSize={50} />
                    <Bar dataKey="discount"    name="Discount"        stackId="a" fill={C_DISC}    maxBarSize={50} />
                    <Bar dataKey="opCost"      name="Operational"     stackId="a" fill={C_OPEX}    maxBarSize={50} />
                    <Bar dataKey="salesValue"  name="Sales Value"     fill={C_REVENUE} maxBarSize={50} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RIGHT — Profit/Loss per batch (Composed Bar + Line) */}
            <Card className="rounded-sm shadow-none border bg-card">
              <CardHeader className="pb-0">
                <CardTitle className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
                  Shop Profit / Loss per Batch
                </CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Formula: Sales − (Inv. In + Operational + Discount)
                </p>
              </CardHeader>
              <CardContent className="pt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={batchChartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--chart-text)" }}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: "var(--chart-text)" }}
                      tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`}
                    />
                    <RechartsTooltip content={<PLTooltip />} cursor={{ fill: "var(--chart-bg)" }} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                    <Bar dataKey="shopProfit" name="Shop Profit" maxBarSize={50} radius={[2, 2, 0, 0]}>
                      {batchChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.shopProfit >= 0 ? C_PROFIT : C_COST} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="shopProfit"
                      name="Trend"
                      stroke={C_PRIMARY}
                      strokeWidth={2}
                      dot={{ r: 3, fill: C_PRIMARY }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>
        )}
      </section>

      {/* ── Summary Footer ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {[
          { label: "Active Shops",     value: shopsList.length,      unit: "" },
          { label: "Total Batches",    value: allBatches.length,     unit: "" },
          { label: "Supply Records",   value: allSupplies.length,    unit: "" },
          { label: "External Supply",  value: externalSupplyCost,    unit: "₹", isRupee: true },
        ].map(({ label, value, unit, isRupee }) => (
          <Card key={label} className="rounded-sm shadow-none border bg-card">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-black text-foreground">
                {isRupee ? `₹${Math.round(value as number).toLocaleString("en-IN")}` : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
