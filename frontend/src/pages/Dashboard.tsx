import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell, ComposedChart, Line, ReferenceLine, LabelList,
  LineChart,
} from "recharts";
import api from "@/lib/api";
import { downloadDashboardPDF, downloadDashboardExcel, ExportData } from "@/utils/exportDashboard";
import { MonthPicker } from "@/components/ui/month-picker";

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
const numWeight = (v: any): number => (typeof v === "number" ? v : 0);

const getValue = (val: any): number => {
  if (!val) return 0;
  if (typeof val === "object") {
    return Number(val.value || 0);
  }
  if (typeof val === "string") {
    return Number(val.replace(/[₹,]/g, "")) || 0;
  }
  return Number(val) || 0;
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopRec   { _id: string; name: string; }
interface NoteRec   { _id: string; shopId: { _id: string; name: string } | string; text: string; date: string; }
interface BatchRec  {
  _id: string; batchNo: string; animalId: string; animalWeight: number;
  rate: number; cost: number; date: string; status: string;
  totalWeight: any; usableMeat: any; wastagePercent: any; head: number; ribs: number; ham: number; offals: number;
  pkgItems: { bone: number; boneless: number; mixed: number; };
  packedMeat?: { weight?: number; value?: number; };
}
interface SupplyRec { _id: string; shopId: { _id: string } | null; externalRecipient: { name: string }; batch: string; total: number; totalAmount: number; date: string; bone?: number; boneless?: number; mixed?: number; }
interface SaleRec   { shopId: string; date: string; billId: string; cash: number; phonePe: number; total: number; discountGiven: number; boneSold?: number; bonelessSold?: number; mixedSold?: number; frySold?: number; currySold?: number; }
interface CostRec   { shopId: string; date: string; total: number; }
interface InvInRec  { shopId: string; batch: string; date: string; totalAmount: number; totalWeight?: number; total_weight?: number; type?: string; supplyId?: string; transport?: string; vendorName?: string; }

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
  const yieldPct = d.before > 0 ? Math.round((d.after / d.before) * 100) : 0;
  const afterPricePerKg = d.after > 0 ? d.beforeCost / d.after : 0;

  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[200px]">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 border-b border-border pb-1">Batch: {label}</p>
      
      <div className="space-y-3 mt-2">
        <div className="space-y-1">
          <p className="font-bold text-orange-500 uppercase text-[9px] tracking-wider">Before Slaughter</p>
          <div className="flex justify-between">
            <span>Weight:</span>
            <span className="font-bold">{d.before} kg</span>
          </div>
          <div className="flex justify-between">
            <span>Total Value:</span>
            <span className="font-bold">{rupee(d.beforeCost)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Price/kg:</span>
            <span>{rupee(beforePricePerKg)}</span>
          </div>
        </div>

        {d.after > 0 ? (
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
              <span>Total Value:</span>
              <span className="font-bold">{rupee(d.beforeCost)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Price/kg:</span>
              <span>{rupee(afterPricePerKg)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1 border-t border-border/50 pt-2">
             <div className="flex justify-between items-center mb-1">
               <p className="font-bold text-red-600 uppercase text-[9px] tracking-wider">Not Processed</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PackingTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[200px]">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 border-b border-border pb-1">Batch: {label}</p>
      
      <div className="space-y-2 mt-2">
        <div className="flex justify-between">
          <span className="font-bold" style={{ color: C_GREEN }}>Packed Weight:</span>
          <span className="font-bold">{d.weight} kg</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold" style={{ color: C_BLUE }}>Packed Value:</span>
          <span className="font-bold">{rupee(d.value)}</span>
        </div>
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

const ShopSalesTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const validPayload = payload.filter((p: any) => p.value !== 0 || p.dataKey === 'salesValue' || p.dataKey === 'discount');
  
  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[200px] space-y-1 z-50">
      <p className="font-bold mb-2 pb-1 border-b text-[11px] uppercase">{label}</p>
      {validPayload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">{p.value?.toLocaleString("en-IN")}</span>
        </div>
      ))}
      {(d.inventoryInKg > 0 || d.externalAddedKg > 0) && (
        <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground flex flex-col gap-1">
          {d.inventoryInKg > 0 
            ? <div className="flex justify-between"><span>Inv Weight:</span> <span className="font-bold text-foreground">{d.inventoryInKg.toFixed(1)} kg</span></div>
            : d.externalAddedKg > 0 && <div className="flex justify-between"><span>Ext Weight:</span> <span className="font-bold text-foreground">{d.externalAddedKg.toFixed(1)} kg</span></div>
          }
          {d.salesWeightKg > 0 && (
            <div className="flex justify-between">
              <span>Weight Sold:</span>
              <span className="font-bold text-green-400">{d.salesWeightKg.toFixed(1)} kg</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SupplyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  
  return (
    <div className="bg-card border border-border rounded-sm p-3 text-xs shadow min-w-[200px]">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 border-b border-border pb-1">Batch: {label}</p>
      
      <div className="space-y-3 mt-2">
        <div>
          <p className="font-bold text-[10px] uppercase tracking-widest" style={{ color: C_GREEN }}>SHOP</p>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Weight:</span>
            <span className="font-bold">{d.shopKg} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Value:</span>
            <span className="font-bold">{rupee(d.shopValue)}</span>
          </div>
        </div>

        <div>
          <p className="font-bold text-[10px] uppercase tracking-widest" style={{ color: C_ORANGE }}>OTHER</p>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Weight:</span>
            <span className="font-bold">{d.otherKg} kg</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Value:</span>
            <span className="font-bold">{rupee(d.otherValue)}</span>
          </div>
        </div>
      </div>
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
  const [timeframe, setTimeframe] = useState<"Today" | "This Week" | "Select Month" | "Custom">("Select Month");
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd,   setCustomEnd]   = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading]         = useState(true);
  const [error,   setError]           = useState<string | null>(null);

  const [shops,    setShops]    = useState<ShopRec[]>([]);
  const [notes,    setNotes]    = useState<NoteRec[]>([]);
  const [batches,  setBatches]  = useState<BatchRec[]>([]);
  const [packagings, setPackagings] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<SupplyRec[]>([]);
  const [sales,    setSales]    = useState<SaleRec[]>([]);
  const [costs,    setCosts]    = useState<CostRec[]>([]);
  const [invIn,    setInvIn]    = useState<InvInRec[]>([]);

  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [newNoteShopId, setNewNoteShopId] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const toggleShopExpand = (shopId: string) => {
    setExpandedShops(prev => {
      const next = new Set(prev);
      if (next.has(shopId)) next.delete(shopId); else next.add(shopId);
      return next;
    });
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      setDeletingNoteId(noteId);
      await api.delete(`/shops/notes/${noteId}`);
      const notesR = await api.get("/shops/notes/all");
      setNotes(notesR.data.data || []);
    } catch (e: any) {
      alert("Failed to delete note: " + (e?.response?.data?.message || e.message));
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteShopId || !newNoteText.trim()) return alert("Please select a shop and write a note.");
    try {
      setSavingNote(true);
      await api.post(`/shops/${newNoteShopId}/notes`, {
        text: newNoteText.trim(),
        date: new Date().toISOString().split("T")[0]
      });
      const notesR = await api.get("/shops/notes/all");
      setNotes(notesR.data.data || []);
      setAddNoteOpen(false);
      setNewNoteShopId("");
      setNewNoteText("");
    } catch (e: any) {
      alert("Failed to save note: " + (e?.response?.data?.message || e.message));
    } finally {
      setSavingNote(false);
    }
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [shopsR, notesR, suppliesR, batchesR, packagingsR] = await Promise.all([
          api.get("/shops"),
          api.get("/shops/notes/all"),
          api.get("/supplies"),
          api.get("/batches"),
          api.get("/central-inventory"),
        ]);

        const shopList: ShopRec[] = shopsR.data.data || [];
        setShops(shopList);
        setNotes(notesR.data.data || []);
        setSupplies(suppliesR.data.data || []);
        setBatches(batchesR.data.data || []);
        setPackagings(packagingsR.data.data || []);

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

        const allSales  = perShop.flatMap(r => (r.sales || []).filter((s:any) => s && s._id).map((s: any)  => ({ ...s, shopId: r.shopId })));
        const allCosts  = perShop.flatMap(r => (r.costs || []).filter((c:any) => c && c._id).map((c: any)  => ({ ...c, shopId: r.shopId })));
        const allInvIn  = perShop.flatMap(r => (r.invIn || []).filter((i:any) => i && i._id).map((i: any)  => ({ ...i, shopId: r.shopId })));

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
    if (timeframe === "Today")        return { from: todayStr, to: todayStr };
    if (timeframe === "This Week")    return { from: new Date(now.getTime() - 7  * 86400000).toISOString().split("T")[0], to: todayStr };
    if (timeframe === "Select Month") {
      const [yr, mo] = selectedMonth.split("-").map(Number);
      const start = `${yr}-${String(mo).padStart(2, "0")}-01`;
      const lastDay = new Date(yr, mo, 0).getDate();
      const end   = `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`;
      return { from: start, to: end };
    }
    return { from: customStart, to: customEnd };
  }, [timeframe, selectedMonth, customStart, customEnd, todayStr]);

  const inRange = useCallback((d: string) => !!d && d >= dateRange.from && d <= dateRange.to, [dateRange]);

  // ── Filtered subsets ──────────────────────────────────────────────────────
  const fBatches    = useMemo(() => batches.filter(b => inRange(b.date)),              [batches,    inRange]);
  const fPackagings = useMemo(() => packagings.filter(p => inRange(p.date)),          [packagings, inRange]);
  const fSupplies   = useMemo(() => supplies.filter(s => inRange(s.date)),            [supplies,   inRange]);
  const fSales    = useMemo(() => sales.filter(s => inRange(s.date) && !String(s.billId || "").startsWith("PREP")), [sales, inRange]);
  const fCosts    = useMemo(() => costs.filter(c => inRange(c.date)),                [costs,    inRange]);
  const fInvIn    = useMemo(() => invIn.filter(i => inRange(i.date)),                [invIn,    inRange]);

  // ── SECTION 1 — Cost to Revenue Pipeline ──────────────────────────────────
  const pipeline = useMemo(() => {
    // Deduplicate packagings by batchNo
    const pkgMap: Record<string, any> = {};
    fPackagings.forEach(item => {
      if (!item || !item._id) return;
      const key = item.batchNo || item._id;
      const existingW = Number(pkgMap[key]?.packedWeight || pkgMap[key]?.totalWeight || 0);
      const thisW     = Number(item.packedWeight || item.totalWeight || 0);
      if (!pkgMap[key] || thisW > existingW) pkgMap[key] = item;
    });
    const packedMeatValue = Object.values(pkgMap).reduce((sum, item) => sum + Number(item.packedAmount || item.totalAmount || 0), 0);
    const packedMeatWeight = Object.values(pkgMap).reduce((sum, item) => sum + Number(item.packedWeight || item.totalWeight || 0), 0);

    const extSupplierCost = fInvIn.filter(i => !i.supplyId && i.transport !== 'Internal Supply').reduce((a, i) => a + (i.totalAmount || 0), 0);
    const extSupplierWeight = fInvIn.filter(i => !i.supplyId && i.transport !== 'Internal Supply').reduce((a, i) => a + (i.totalWeight || 0), 0);
    const opCost          = fCosts.reduce((a, c) => a + (c.total || 0), 0);
    const discount        = fSales.reduce((a, s) => a + (s.discountGiven || 0), 0);
    
    const totalDeductions = opCost + discount + extSupplierCost;

    const wholesaleRevenue = fSupplies.filter(s => !s.shopId && !!s.externalRecipient?.name).reduce((a, s) => a + (s.totalAmount || 0), 0);
    const shopPosSales     = fSales.reduce((a, s) => a + (s.total || 0), 0);
    
    // Calculate weights
    const wholesaleWeight = fSupplies.filter(s => !s.shopId && !!s.externalRecipient?.name).reduce((a, s) => a + ((s.bone || 0) + (s.boneless || 0) + (s.mixed || 0)), 0);
    const shopPosSalesWeight = fSales.reduce((a, s) => a + ((s.boneSold || 0) + (s.bonelessSold || 0) + (s.mixedSold || 0) + (s.frySold || 0) + (s.currySold || 0)), 0);

    const totalRevenue     = wholesaleRevenue + shopPosSales;
    const totalRevenueWeight = wholesaleWeight + shopPosSalesWeight;
    const netProfit        = totalRevenue - packedMeatValue - totalDeductions;

    const waterfall = [
      { name: "Packed Meat Value", value: packedMeatValue, type: "cost",                          fullLabel: `Total Packed Meat Value (${packedMeatWeight.toFixed(2)} kg)` },
      { name: "Ext. Supplier Cost",value: extSupplierCost, type: "cost",                          fullLabel: `External Supplier Cost (${extSupplierWeight.toFixed(2)} kg)` },
      { name: "Operational",       value: opCost,          type: "cost",                          fullLabel: "Operational Cost" },
      { name: "Discount",          value: discount,        type: "cost",                          fullLabel: "Discount Given" },
      { name: "Sales Revenue",     value: totalRevenue,    type: "revenue",                       fullLabel: `Total Sales Revenue (${totalRevenueWeight.toFixed(2)} kg)` },
      { name: "Net Profit",        value: netProfit,       type: netProfit >= 0 ? "profit" : "loss", fullLabel: "Net Profit / Loss" },
    ];

    return { packedMeatValue, packedMeatWeight, totalDeductions, totalRevenue, totalRevenueWeight, netProfit, waterfall };
  }, [fBatches, fSupplies, fCosts, fSales, fInvIn, fPackagings]);

  // ── SECTION 2 — Dressing ──────────────────────────────────────────────────
  const dressing = useMemo(() => {
    // 1. BEFORE SLAUGHTER
    const beforeKg    = fBatches.reduce((a, b) => a + (b.animalWeight || 0), 0);
    
    // 2. AFTER SLAUGHTER
    const slaughtered = fBatches.filter(b => b.status === "Slaughtered" || b.status === "Packed");
    const afterKg     = slaughtered.reduce((a, b) => a + numWeight(b.usableMeat), 0);

    // 3. TOTAL SLAUGHTER VALUE
    const totalSlaughterValue = fBatches.reduce((sum, item) => sum + getValue(item.cost), 0);

    // Deduplicate packagings by batchNo — take highest packedWeight to guard
    // against duplicate CentralInventory records (one record per batch only)
    const pkgMap: Record<string, any> = {};
    fPackagings.forEach(item => {
      if (!item || !item._id) return;
      const key = item.batchNo || item._id;
      const existingW = getValue(pkgMap[key]?.packedWeight || pkgMap[key]?.totalWeight);
      const thisW     = getValue(item.packedWeight || item.totalWeight);
      if (!pkgMap[key] || thisW > existingW) pkgMap[key] = item;
    });
    const uniquePackagings = Object.values(pkgMap);

    // 4. PACKED MEAT — reads snapshot fields, never reduced by supply ops
    const packedKg  = uniquePackagings.reduce((sum, item) => sum + getValue(item.packedWeight || item.totalWeight), 0);
    const packedVal = uniquePackagings.reduce((sum, item) => sum + getValue(item.packedAmount || item.totalAmount), 0);

    // 5. PROFIT (TYPE 1)
    const profit = packedVal > 0 ? packedVal - totalSlaughterValue : 0;

    const batchStats = fBatches.map(b => {
      if (!b || !b._id) return null;
      const bWeight = b.animalWeight || 0;
      const bCost   = getValue(b.cost);
      const aWeight = numWeight(b.usableMeat);
      
      return {
        name:       b.batchNo || "Unknown",
        before:     bWeight,
        beforeCost: bCost,
        after:      aWeight,
        status:     b.status
      };
    });

    const lineData = batchStats.filter((d: any) => d && (d.before > 0 || d.after > 0));

    // One bar per unique batch — weight and value are the permanent snapshot values
    const barData = uniquePackagings.map(item => ({
      name:   item.batchNo || "Unknown",
      weight: getValue(item.packedWeight || item.totalWeight),
      value:  getValue(item.packedAmount || item.totalAmount),
    }));

    return { beforeKg, totalSlaughterValue, afterKg, packedKg, packedVal, profit, lineData, barData };
  }, [fBatches, fPackagings]);

  // ── SECTION 3 — Supply ────────────────────────────────────────────────────
  const supplyData = useMemo(() => {
    const shopSups  = fSupplies.filter(s => !!s.shopId);
    const otherSups = fSupplies.filter(s => !s.shopId && s.externalRecipient?.name);

    const getWeight = (s: any) => (s.bone || 0) + (s.boneless || 0) + (s.mixed || 0);

    const shopValue  = shopSups.reduce((a, s)  => a + (s.totalAmount || 0), 0);
    const otherValue = otherSups.reduce((a, s) => a + (s.totalAmount || 0), 0);
    
    const shopKg     = shopSups.reduce((a, s)  => a + getWeight(s), 0);
    const otherKg    = otherSups.reduce((a, s) => a + getWeight(s), 0);
    
    const totalInvSales = shopValue + otherValue;
    const totalKg = shopKg + otherKg;
    
    // Percentage Logic Fix (only if shopValue > 0)
    let diffPct = null;
    if (shopValue > 0) {
      diffPct = Math.round(((otherValue - shopValue) / shopValue) * 100);
    }

    // Per-batch bar chart map (Value based)
    const batchMap: Record<string, { name: string; shopValue: number; otherValue: number; shopKg: number; otherKg: number }> = {};
    batches.forEach(b => {
      if (!b || !b._id || !b.batchNo) return;
      batchMap[b.batchNo] = { name: b.batchNo, shopValue: 0, otherValue: 0, shopKg: 0, otherKg: 0 }; });
    
    fSupplies.forEach(s => {
      if (!s || !s._id) return;
      if (!batchMap[s.batch]) batchMap[s.batch] = { name: s.batch, shopValue: 0, otherValue: 0, shopKg: 0, otherKg: 0 };
      
      const w = getWeight(s);
      const val = (s.totalAmount || 0);
      
      if (s.shopId) {
        batchMap[s.batch].shopValue += val;
        batchMap[s.batch].shopKg    += w;
      } else {
        batchMap[s.batch].otherValue += val;
        batchMap[s.batch].otherKg    += w;
      }
    });

    const barData = Object.values(batchMap).filter(d => d.shopValue > 0 || d.otherValue > 0 || d.shopKg > 0 || d.otherKg > 0);

    return { shopValue, otherValue, shopKg, otherKg, totalInvSales, totalKg, diffPct, barData };
  }, [fSupplies, batches]);

  // ── SECTION 4 — Shop Sales per batch ─────────────────────────────────────
  const shopSalesData = useMemo(() => {
    const batchMap: Record<string, {
      name: string; inventoryIn: number; externalAdded: number;
      inventoryInKg: number; externalAddedKg: number;
      salesValue: number; discount: number; shopProfit: number;
      salesWeightKg: number;
    }> = {};

    // Process each shop independently using FIFO
    const shopIds = [...new Set(fInvIn.map(i => i.shopId))];

    shopIds.forEach(shopId => {
      if (!shopId) return;
      const shopName = shops.find(s => s._id === shopId)?.name || 'Shop';

      // Sort this shop's inventory oldest-first (FIFO order)
      const shopInventory = fInvIn
        .filter(i => i.shopId === shopId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Actual shop totals from POS sales records
      const shopSalesRecords = fSales.filter(s => s.shopId === shopId);
      const totalSalesRevenue = shopSalesRecords.reduce((a, s) => a + (s.total || 0), 0);
      const totalDiscount     = shopSalesRecords.reduce((a, s) => a + (s.discountGiven || 0), 0);
      const totalSoldKg       = shopSalesRecords.reduce((a, s) =>
        a + (s.boneSold || 0) + (s.bonelessSold || 0) + (s.frySold || 0) + (s.currySold || 0) + (s.mixedSold || 0), 0);

      // ── FIFO: consume batches oldest first ────────────────────────────────
      let remainingKg = totalSoldKg;
      const fifoAllocations: { key: string; allocatedKg: number }[] = [];

      shopInventory.forEach(i => {
        if (!i || !i._id) return;
        const isExt    = i.type === 'external';
        const barLabel = isExt
          ? `${i.vendorName || 'Vendor'} (${shopName})`
          : `${i.batch} (${shopName})`;
        const key      = `${i.batch}_${shopId}`;
        const batchKg  = i.totalWeight || 0;
        const batchAmt = i.totalAmount || 0;

        // Initialise slot
        if (!batchMap[key]) {
          batchMap[key] = { name: barLabel, inventoryIn: 0, externalAdded: 0, inventoryInKg: 0, externalAddedKg: 0, salesValue: 0, discount: 0, shopProfit: 0, salesWeightKg: 0 };
        }

        if (isExt) {
          batchMap[key].externalAdded   += batchAmt;
          batchMap[key].externalAddedKg += batchKg;
        } else {
          batchMap[key].inventoryIn   += batchAmt;
          batchMap[key].inventoryInKg += batchKg;
        }

        // How much of this batch did FIFO consume?
        const consumed  = Math.min(remainingKg, batchKg);
        remainingKg     = Math.max(0, remainingKg - batchKg);
        fifoAllocations.push({ key, allocatedKg: consumed });
      });

      // ── Distribute revenue by FIFO kg share ──────────────────────────────
      const totalAllocatedKg = fifoAllocations.reduce((a, f) => a + f.allocatedKg, 0);

      fifoAllocations.forEach(({ key, allocatedKg }) => {
        if (totalAllocatedKg === 0) return;
        const ratio = allocatedKg / totalAllocatedKg;
        batchMap[key].salesValue    += totalSalesRevenue * ratio;
        batchMap[key].discount      += totalDiscount     * ratio;
        batchMap[key].salesWeightKg += allocatedKg; // exact FIFO kg
      });
    });

    // Final profit per batch
    Object.values(batchMap).forEach(b => {
      b.shopProfit = b.salesValue - (b.inventoryIn + b.externalAdded) - b.discount;
    });

    return Object.values(batchMap).filter(b => b.inventoryIn > 0 || b.externalAdded > 0 || b.salesValue > 0);
  }, [fInvIn, fSales, shops]);


  // ── Notes grouped by shop ─────────────────────────────────────────────────
  const notesGrouped = useMemo(() => {
    const map = new Map<string, { shopId: string; shopName: string; notes: Array<{ _id: string; text: string; date: string }> }>();
    notes.forEach(n => {
      if (!n || !n.shopId) return;
      const shopId = (typeof n.shopId === "object" && n.shopId) ? n.shopId._id : n.shopId;
      const shopName = (typeof n.shopId === "object" && n.shopId) ? n.shopId.name : "Shop";
      if (!shopId) return;
      if (!map.has(shopId)) map.set(shopId, { shopId, shopName, notes: [] });
      map.get(shopId)!.notes.push({ _id: n._id, text: n.text, date: n.date });
    });
    return Array.from(map.values());
  }, [notes]);

  const handleExport = (type: "pdf" | "excel") => {
    const combinedDressingData = batches.map(b => {
      if (!b || !b._id || !b.batchNo) return null;
      const line = dressing.lineData.find(d => d.name === b.batchNo) || { before: 0, after: 0, beforeCost: 0 } as any;
      const bar = dressing.barData.find(d => d.name === b.batchNo) || { weight: 0, value: 0 };
      const profit = (bar.value > 0) ? bar.value - line.beforeCost : 0;
      return { 
        name: b.batchNo,
        before: line.before || 0, 
        beforeCost: line.beforeCost || 0, 
        after: line.after || 0, 
        packed: bar.weight || 0, 
        packedVal: bar.value || 0, 
        profit 
      };
    }).filter(b => b && (b.before > 0 || b.packed > 0));

    const combinedSupplyData = supplyData.barData.map((d: any) => ({
      name: d.name,
      weight: dressing.barData.find((b: any) => b.name === d.name)?.weight || 0,
      shop: d.shopValue || 0,
      other: d.otherValue || 0,
      value: (d.shopValue || 0) + (d.otherValue || 0)
    })).filter((d: any) => d.shop > 0 || d.other > 0);

    const data: ExportData = {
      timeframe,
      customStart,
      customEnd,
      pipeline,
      dressingData: combinedDressingData,
      supplyData: combinedSupplyData,
      shopSalesData,
      fInvIn,
      fSupplies,
      fSales
    };

    if (type === "pdf") downloadDashboardPDF(data);
    else downloadDashboardExcel(data);
  };

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

  const { packedMeatValue, packedMeatWeight, totalDeductions, totalRevenue, totalRevenueWeight, netProfit, waterfall } = pipeline;
  const { beforeKg, totalSlaughterValue, afterKg, packedKg, packedVal, profit } = dressing;
  const { shopValue, otherValue, shopKg, otherKg, totalInvSales, diffPct } = supplyData;

  return (
    <div className="animate-fade-in pb-16 w-full space-y-5">

      {/* ── SHOP NOTES CARDS ── */}
      <div className="w-full mb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Shop Notes</p>
          <Button size="sm" onClick={() => setAddNoteOpen(true)} className="bg-primary/10 text-primary hover:bg-primary/20 h-7 text-xs px-3">
            + Add Note
          </Button>
        </div>
        {notesGrouped.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {notesGrouped.map(group => {
              const isExpanded = expandedShops.has(group.shopId);
              const LIMIT = 3;
              const visibleNotes = isExpanded ? group.notes : group.notes.slice(0, LIMIT);
              const hiddenCount = group.notes.length - LIMIT;
              return (
                <div key={group.shopId} className="bg-primary/5 border border-primary/20 rounded-md p-4 shadow-sm flex flex-col gap-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 border-b border-primary/10 pb-2">
                    <span className="text-lg">📌</span>
                    <span className="font-black text-sm" style={{ color: C_PRIMARY }}>{group.shopName}</span>
                  </div>
                  {/* Note items */}
                  <ul className="space-y-1.5">
                    {visibleNotes.map(note => (
                      <li key={note._id} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0 text-xs font-black">•</span>
                        <span className="text-sm text-foreground leading-snug">{note.text}</span>
                      </li>
                    ))}
                  </ul>
                  {/* See more / less toggle */}
                  {group.notes.length > LIMIT && (
                    <button
                      onClick={() => toggleShopExpand(group.shopId)}
                      className="mt-2 text-xs font-bold text-left transition-colors"
                      style={{ color: C_PRIMARY }}
                    >
                      {isExpanded ? "See less" : `+ See more (${hiddenCount})`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic mb-4">No shop notes found.</div>
        )}
      </div>

      {/* ── DATE HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border-b border-border p-4 -mx-6 -mt-6 mb-6">
        <h1 className="text-xl font-black text-foreground uppercase tracking-tight">Analytics Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-primary/5 rounded-md p-1 border border-primary/10 w-fit">
            {(["Today", "This Week", "Select Month", "Custom"] as const).map(t => (
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

          {/* Month selector — custom inline picker */}
          {timeframe === "Select Month" && (
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          )}

          {/* Custom date range */}
          {timeframe === "Custom" && (
            <div className="flex items-center gap-2 bg-card border rounded-sm px-3 py-1">
              <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start" />
              <span className="text-muted-foreground font-bold">–</span>
              <AdvancedDatePicker value={customEnd}   onChange={setCustomEnd}   placeholder="End" />
            </div>
          )}

          {/* PDF Export only */}
          <Button onClick={() => handleExport("pdf")} className="bg-red-500 hover:bg-red-600 text-white rounded-sm h-9 px-3 text-xs font-bold uppercase tracking-wider">PDF Export</Button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 — COST TO REVENUE PIPELINE
      ════════════════════════════════════════════════════════════════════════ */}
      <Section
        title="Cost to Revenue Pipeline"
        subtitle="Per-batch average breakdown:  Packaging → EXT.Supplier→ Operational → Discount → Selling Price → Profit"
      >
        {/* 4 KPI mini-cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard label="Total Packed Meat Value"          value={rupee(packedMeatValue)} sub={`${packedMeatWeight.toFixed(2)} kg`} color={C_RED} />
          <KpiCard label="Total Deductions"                 value={rupee(totalDeductions)}  color={C_RED} />
          <KpiCard label="Total Sales Revenue"              value={rupee(totalRevenue)} sub={`${totalRevenueWeight.toFixed(2)} kg`} color={C_BLUE} />
          <KpiCard
            label="Net Profit / Loss"
            value={`${netProfit < 0 ? "−" : "+"}${rupee(Math.abs(netProfit))}`}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <KpiCard label="Before Slaughter"      value={`${beforeKg.toLocaleString("en-IN")} kg`} />
          <KpiCard label="After Slaughter"       value={`${afterKg.toLocaleString("en-IN")} kg`}  color={C_PRIMARY} />
          <KpiCard label="Total Slaughter Value" value={rupee(totalSlaughterValue)}               color={C_ORANGE} />
          <KpiCard label="Packed Meat"           value={`${packedKg.toFixed(2)} kg`} sub={`Value: ${rupee(packedVal)}`} color={C_BLUE} />
          <KpiCard label="Profit (Type 1)"       value={profit === 0 ? "₹0" : `${profit < 0 ? "−" : "+"}${rupee(Math.abs(profit))}`} color={profit >= 0 ? C_GREEN : C_RED} />
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
                      <RechartsTooltip content={<PackingTooltip />} />
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
      <Section title="Supply" subtitle="Shop Supply vs Other Supply">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: KPI column */}
          <div className="flex flex-col gap-3">
            <div className="rounded-sm border border-border p-4 bg-background">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Supply Value</p>
              <p className="text-2xl font-black text-foreground">{rupee(supplyData.totalInvSales)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{supplyData.totalKg.toLocaleString("en-IN")} kg</p>
            </div>
            <div className="rounded-sm border border-border p-4" style={{ backgroundColor: "#F0FDF4" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Shop Supply</p>
              <p className="text-2xl font-black" style={{ color: C_GREEN }}>{rupee(supplyData.shopValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{supplyData.shopKg.toLocaleString("en-IN")} kg</p>
            </div>
            <div className="rounded-sm border border-border p-4" style={{ backgroundColor: "#FFFBEB" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Other Supply</p>
              <p className="text-2xl font-black" style={{ color: C_ORANGE }}>{rupee(supplyData.otherValue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{supplyData.otherKg.toLocaleString("en-IN")} kg</p>
            </div>
            {supplyData.diffPct !== null && (
              <div className="rounded-sm border border-border p-3 bg-primary/5 text-xs font-bold text-primary">
                {supplyData.diffPct > 0 
                  ? `Other supply higher by ${supplyData.diffPct}%` 
                  : supplyData.diffPct < 0 
                    ? `Shop supply higher by ${Math.abs(supplyData.diffPct)}%` 
                    : "Equal supply distribution"}
              </div>
            )}
          </div>

          {/* Right: Bar chart shop vs other supply per batch (Values) */}
          <div className="lg:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" /> Supply Overview (₹)
            </p>
            <div style={{ height: 280 }}>
              {supplyData.barData.length === 0
                ? <EmptyChart />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={supplyData.barData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "var(--chart-text)" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip content={<SupplyTooltip />} />
                      <Bar yAxisId="left" dataKey="shopValue"  name="Shop Value (₹)"  fill={C_GREEN}  maxBarSize={30} radius={[2, 2, 0, 0]} />
                      <Bar yAxisId="left" dataKey="otherValue" name="Other Value (₹)" fill={C_ORANGE} maxBarSize={30} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
            <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_GREEN }} /> Shop (₹)</span>
               <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: C_ORANGE }} /> Other (₹)</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 — SHOP SALES
      ════════════════════════════════════════════════════════════════════════ */}
      <Section title="Shop Sales" subtitle="Inventory In → Sales → Discount → Revenue">
        {shopSalesData.length === 0
          ? (
            <div className="h-48 flex items-center justify-center">
              <EmptyChart msg="No sales data for this period" />
            </div>
          )
          : (
            <div className="space-y-5">
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
                      <RechartsTooltip content={<ShopSalesTooltip />} cursor={false} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <Bar dataKey="inventoryIn"   name="Inventory In (₹)" stackId="a" fill={C_BLUE}   maxBarSize={40} />
                      <Bar dataKey="externalAdded" name="External Added (₹)" stackId="a" fill="#8B5CF6"  maxBarSize={40} />
                      <Bar dataKey="salesValue"    name="Sales (₹)"        stackId="a" fill={C_GREEN}  maxBarSize={40} />
                      <Bar dataKey="discount"      name="Discount (₹)"     stackId="a" fill={C_RED}    maxBarSize={40} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Profit / Loss bar + trend line */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Revenue per Batch</p>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={shopSalesData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--chart-text)" }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                      <RechartsTooltip content={<ShopSalesTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeWidth={2} />
                      <Bar dataKey="shopProfit" name="Revenue (₹)" maxBarSize={40} radius={[2, 2, 0, 0]}>
                        {shopSalesData.map((d, i) => (
                          <Cell key={i} fill={d.shopProfit >= 0 ? C_GREEN : C_RED} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
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

      {/* ── Add Note Modal ── */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shop Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shop</Label>
              <Select value={newNoteShopId} onValueChange={setNewNoteShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a shop" />
                </SelectTrigger>
                <SelectContent>
                  {shops.map(s => (
                    <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note Text</Label>
              <Textarea 
                placeholder="Enter note..." 
                value={newNoteText} 
                onChange={(e) => setNewNoteText(e.target.value)} 
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNoteOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={savingNote || !newNoteShopId || !newNoteText.trim()}>
              {savingNote ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
