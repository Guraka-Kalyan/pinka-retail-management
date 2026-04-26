import React, { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import InventoryIn from "@/pages/InventoryIn";
import Preparation from "@/pages/Preparation";
import Costs from "@/pages/Costs";
import {
  Store, MapPin, Phone, Activity, LayoutGrid, Plus, DownloadCloud,
  IndianRupee, CookingPot, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-6)', 'var(--chart-4)'];

export default function ShopDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "inventory-in" | "preparation" | "costs">("overview");

  const [timeframe, setTimeframe] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Week");

  const todayStr = new Date().toISOString().split("T")[0];
  const [exportFormat, setExportFormat] = useState<"CSV" | "PDF">("CSV");
  const [exportRange, setExportRange] = useState<"Daily" | "Weekly" | "Monthly" | "Custom">("Daily");
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  // ── Data Fetching ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["shopDashboardData", id],
    queryFn: async () => {
      if (!id) return null;
      const [shopsRes, salesRes, invInRes, prepsRes, costsRes, stockRes] = await Promise.all([
        api.get("/shops"),
        api.get(`/shops/${id}/sales`),
        api.get(`/shops/${id}/inventory-in`),
        api.get(`/shops/${id}/preparations`),
        api.get(`/shops/${id}/daily-costs`),
        api.get(`/shops/${id}/stock`)
      ]);

      const allShops = shopsRes.data.data || [];
      const shop = allShops.find((s: any) => s._id === id || s.id === id);

      return {
        allShops,
        currentShop: shop,
        salesData: salesRes.data.data || [],
        invIn: invInRes.data.data || [],
        preps: prepsRes.data.data || [],
        dailyCosts: costsRes.data.data || [],
        liveStock: stockRes.data.data || null
      };
    },
    enabled: !!id
  });

  const { allShops = [], currentShop = null, salesData = [], invIn = [], preps = [], dailyCosts = [], liveStock = null } = data || {};

  // ── Formatted Data & KPIs (Memoized) ──────────────────────────────────────────
  const { filteredSales, kpis, charts } = useMemo(() => {
    // 1. Filter by Date
    const now = new Date();
    const filterByDateRange = (records: any[], dateField: string = "date") => {
      return records.filter(r => {
        const recDate = r[dateField];
        if (!recDate) return false;
        if (timeframe === "Today") return recDate === todayStr;
        if (timeframe === "This Week") {
          const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          return recDate >= pastWeek;
        }
        if (timeframe === "This Month") {
          const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          return recDate >= pastMonth;
        }
        if (timeframe === "Custom") return recDate >= customStart && recDate <= customEnd;
        return false;
      });
    };

    const _filteredSales = filterByDateRange(salesData).filter(r => !String(r.billId).startsWith("PREP"));
    const _filteredCosts = filterByDateRange(dailyCosts);

    // 2. Financial KPIs
    const totalSalesVal = _filteredSales.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
    const totalDiscountVal = _filteredSales.reduce((s: number, r: any) => s + (Number(r.discountGiven) || 0), 0);
    const opCostVal = _filteredCosts.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);

    const totalExpensesVal = opCostVal + totalDiscountVal;
    const netResultVal = totalSalesVal - totalExpensesVal;

    // 3. Stock KPIs (Fallback logic logic kept just in case, but liveStock preferred)
    const totalBoneIn = invIn.reduce((s: number, r: any) => s + (Number(r.bone) || 0), 0);
    const totalBonelessIn = invIn.reduce((s: number, r: any) => s + (Number(r.boneless) || 0), 0);
    const totalMixedIn = invIn.reduce((s: number, r: any) => s + (Number(r.mixed) || 0), 0);

    const overallBoneSold = salesData.reduce((s: number, r: any) => s + (Number(r.boneSold) || 0), 0);
    const overallBonelessSold = salesData.reduce((s: number, r: any) => s + (Number(r.bonelessSold) || 0), 0);
    const overallMixedSold = salesData.reduce((s: number, r: any) => s + (Number(r.mixedSold) || 0), 0);

    const overallBoneUsed = preps.reduce((s: number, r: any) => s + (Number(r.boneUsed) || 0), 0);
    const overallBonelessUsed = preps.reduce((s: number, r: any) => s + (Number(r.bonelessUsed) || 0), 0);
    const totalFryPrep = preps.reduce((s: number, r: any) => s + (Number(r.fryPrep) || 0), 0);
    const totalCurryPrep = preps.reduce((s: number, r: any) => s + (Number(r.curryPrep) || 0), 0);

    const overallFrySold = salesData.reduce((s: number, r: any) => s + (Number(r.frySold) || 0), 0);
    const overallCurrySold = salesData.reduce((s: number, r: any) => s + (Number(r.currySold) || 0), 0);

    const availBone = liveStock?.boneStock ?? (totalBoneIn - overallBoneSold - overallBoneUsed);
    const availBoneless = liveStock?.bonelessStock ?? (totalBonelessIn - overallBonelessSold - overallBonelessUsed);
    const availMixed = liveStock?.mixedStock ?? (totalMixedIn - overallMixedSold);
    const availFry = liveStock?.fryStock ?? (totalFryPrep - overallFrySold);
    const availCurry = liveStock?.curryStock ?? (totalCurryPrep - overallCurrySold);

    // 4. Return Data
    const _kpis = {
      netResultVal,
      totalSalesVal,
      totalExpensesVal,
      totalStock: parseFloat((Math.max(0, availBone) + Math.max(0, availBoneless) + Math.max(0, availMixed) + Math.max(0, availFry) + Math.max(0, availCurry)).toFixed(3)),
      cash: _filteredSales.reduce((s: number, r: any) => s + (Number(r.cash) || 0), 0),
      phonepe: _filteredSales.reduce((s: number, r: any) => s + (Number(r.phonePe) || 0), 0),
      boneSold: _filteredSales.reduce((s: number, r: any) => s + (Number(r.boneSold) || 0), 0),
      bonelessSold: _filteredSales.reduce((s: number, r: any) => s + (Number(r.bonelessSold) || 0), 0),
      mixedSold: _filteredSales.reduce((s: number, r: any) => s + (Number(r.mixedSold) || 0), 0),
      frySold: _filteredSales.reduce((s: number, r: any) => s + (Number(r.frySold) || 0), 0),
      currySold: _filteredSales.reduce((s: number, r: any) => s + (Number(r.currySold) || 0), 0),
    };

    // 5. Chart Maps
    const chartSalesDistribution = [
      { name: 'Bone', value: _kpis.boneSold },
      { name: 'Boneless', value: _kpis.bonelessSold },
      { name: 'Fry', value: _kpis.frySold },
      { name: 'Curry', value: _kpis.currySold },
      { name: 'Mixed', value: _kpis.mixedSold },
    ].filter(i => i.value > 0);

    const trendMap: Record<string, number> = {};
    _filteredSales.forEach(s => { trendMap[s.date] = (trendMap[s.date] || 0) + (Number(s.total) || 0); });
    const chartRevenueList = Object.keys(trendMap).sort().map(date => ({ name: date.substring(5), revenue: trendMap[date] }));
    if (chartRevenueList.length === 0) chartRevenueList.push({ name: 'Start', revenue: 0 });

    const invFlowMap: Record<string, { In: number, Out: number }> = {};
    filterByDateRange(invIn).forEach(r => {
      const d = r.date || r.createdAt?.substring(0, 10);
      if (!d) return;
      if (!invFlowMap[d]) invFlowMap[d] = { In: 0, Out: 0 };
      invFlowMap[d].In += (Number(r.bone) || 0) + (Number(r.boneless) || 0) + (Number(r.mixed) || 0);
    });
    _filteredSales.forEach(r => {
      if (!invFlowMap[r.date]) invFlowMap[r.date] = { In: 0, Out: 0 };
      invFlowMap[r.date].Out += (Number(r.boneSold) || 0) + (Number(r.bonelessSold) || 0) + (Number(r.mixedSold) || 0) + (Number(r.frySold) || 0) + (Number(r.currySold) || 0);
    });
    const chartInvFlow = Object.keys(invFlowMap).sort().map(date => ({
      name: date.substring(5), In: invFlowMap[date].In, Out: invFlowMap[date].Out
    }));
    if (chartInvFlow.length === 0) chartInvFlow.push({ name: 'Start', In: 0, Out: 0 });

    return { filteredSales: _filteredSales, kpis: _kpis, charts: { chartSalesDistribution, chartRevenueList, chartInvFlow } };
  }, [salesData, invIn, preps, dailyCosts, liveStock, timeframe, customStart, customEnd, todayStr]);


  // ── Handlers & Misc ──────────────────────────────────────────────────────────
  const handleExportAnalytics = () => {
    alert(`Exporting ${exportRange} Analytics for ${currentShop?.name || "Target Shop"} in ${exportFormat} format!`);
  };

  const shopName = currentShop?.name || "Pinaka Default Shop";
  const displayId = currentShop?.code || currentShop?.displayId || id?.toUpperCase() || "SHP-NEW";

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Shop Management", path: "/shop" }, { label: shopName }]} />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-foreground tracking-tight">{isLoading ? <Skeleton className="w-64 h-8" /> : shopName}</h1>
              {!isLoading && (
                <span className="badge-success text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-success/20">Active</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground mt-1">
              <div className="flex items-center gap-1.5"><Store className="w-4 h-4" /> {isLoading ? <Skeleton className="w-16 h-4" /> : displayId}</div>
              <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {isLoading ? <Skeleton className="w-24 h-4" /> : currentShop?.phone || "N/A"}</div>
              <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {isLoading ? <Skeleton className="w-32 h-4" /> : currentShop?.location || "N/A"}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Prev / Next shop navigation */}
            {(() => {
              const idx = allShops.findIndex((s: any) => s._id === id || s.id === id);
              const prevShop = idx > 0 ? allShops[idx - 1] : null;
              const nextShop = idx < allShops.length - 1 ? allShops[idx + 1] : null;
              return (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    disabled={!prevShop}
                    onClick={() => prevShop && navigate(`/shop/${prevShop._id || prevShop.id}`)}
                    className="rounded-sm h-11 px-3 shadow-none border-[var(--border)] font-semibold text-sm bg-card transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-semibold px-1 select-none">
                    {allShops.length > 0 ? `${idx + 1} / ${allShops.length}` : "- / -"}
                  </span>
                  <Button
                    variant="outline"
                    disabled={!nextShop}
                    onClick={() => nextShop && navigate(`/shop/${nextShop._id || nextShop.id}`)}
                    className="rounded-sm h-11 px-3 shadow-none border-[var(--border)] font-semibold text-sm bg-card transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              );
            })()}
            <Link to="/shop">
              <Button variant="outline" className="rounded-sm h-11 px-6 shadow-none border-[var(--border)] font-semibold tracking-wide text-sm bg-card transition-colors">
                <LayoutGrid className="w-4 h-4 mr-2" /> Back to Shops
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex justify-start md:justify-center w-full overflow-x-auto no-scrollbar pb-2">
        <div className="p-1.5 rounded-sm flex gap-1 shadow-none border border-border/50 min-w-max bg-muted">
          <button onClick={() => setActiveTab("overview")} className={cn("flex items-center gap-2 px-6 py-2 rounded-sm font-bold text-xs tracking-wider transition-all", activeTab === "overview" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground hover:bg-primary/10")}>
            <LayoutGrid className="w-4 h-4" /> OVERVIEW
          </button>
          <button onClick={() => setActiveTab("inventory-in")} className={cn("flex items-center gap-2 px-6 py-2 rounded-sm font-bold text-xs tracking-wider transition-all", activeTab === "inventory-in" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground hover:bg-primary/10")}>
            <Plus className="w-4 h-4" /> INVENTORY IN
          </button>
          <button onClick={() => setActiveTab("preparation")} className={cn("flex items-center gap-2 px-6 py-2 rounded-sm font-bold text-xs tracking-wider transition-all", activeTab === "preparation" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground hover:bg-primary/10")}>
            <CookingPot className="w-4 h-4" /> PREPARATION
          </button>
          <button onClick={() => setActiveTab("costs")} className={cn("flex items-center gap-2 px-6 py-2 rounded-sm font-bold text-xs tracking-wider transition-all", activeTab === "costs" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground hover:bg-primary/10")}>
            <IndianRupee className="w-4 h-4" /> COSTS
          </button>
        </div>
      </div>

      {/* Content Rendering based on Tab */}
      {activeTab === "overview" && (
        <div className="bg-card rounded-none p-8 shadow-none border border-border">

          <div className="flex flex-col mb-8 gap-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Analytics Dashboard</h2>
                <p className="text-sm text-muted-foreground">Track your inventory flows and daily revenue metrics.</p>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 w-full">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 w-full lg:w-auto">
                <div className="p-1.5 rounded-sm flex items-center shadow-none border h-11 no-scrollbar overflow-x-auto bg-muted">
                  {["Today", "This Week", "This Month", "Custom"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t as any)}
                      className={cn("whitespace-nowrap flex-1 lg:flex-none px-4 lg:px-6 py-1.5 rounded-sm text-sm font-bold transition-all", timeframe === t ? "bg-primary text-white shadow-none" : "text-muted-foreground hover:text-foreground hover:bg-primary/10")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {timeframe === "Custom" && (
                  <div className="flex items-center gap-2 bg-card p-1 rounded-sm border border-[var(--border)] shadow-none px-2 h-11 w-full lg:w-auto">
                    <AdvancedDatePicker value={customStart} onChange={(val) => setCustomStart(val)} placeholder="Start Date" />
                    <span className="text-muted-foreground font-bold">-</span>
                    <AdvancedDatePicker value={customEnd} onChange={(val) => setCustomEnd(val)} placeholder="End Date" />
                  </div>
                )}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-sm font-bold bg-card border border-border shadow-none hover:text-primary hover:border-primary/30 px-4 flex items-center gap-2 w-full xl:w-auto">
                      <DownloadCloud className="w-4 h-4" /> Download
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader><DialogTitle>Export Analytics Report</DialogTitle></DialogHeader>
                    {/* Simplified Dialog Content implementation */}
                    <div className="grid gap-4 py-4">Report Options...</div>
                    <DialogFooter><Button onClick={handleExportAnalytics} className="bg-primary hover:bg-primary/80">Export Data</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* NET RESULT DOMINANT CARD AND BREAKDOWN */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className={cn("col-span-1 lg:col-span-1 border shadow-none bg-card relative overflow-hidden flex flex-col items-center justify-center p-8", kpis.netResultVal >= 0 ? "border-l-4 border-l-success rounded-sm" : "border-l-4 border-l-destructive rounded-sm")}>
              <p className={cn("text-sm font-bold tracking-[0.2em] mb-2 uppercase", kpis.netResultVal >= 0 ? "text-success/80" : "text-destructive/80")}>Net Result</p>
              <h2 className={cn("text-4xl lg:text-5xl font-black tracking-tighter", kpis.netResultVal >= 0 ? "text-success" : "text-destructive")}>
                {isLoading ? <Skeleton className="w-32 h-12" /> : `${kpis.netResultVal < 0 ? "-" : ""}₹${Math.abs(kpis.netResultVal).toLocaleString("en-IN")}`}
              </h2>
              <p className={cn("mt-3 text-xs font-semibold uppercase tracking-wider", kpis.netResultVal >= 0 ? "text-success/90" : "text-destructive/90")}>
                {kpis.netResultVal >= 0 ? "Profit Generated" : "Loss Incurred"}
              </p>
              <div className={cn("absolute right-[-24px] bottom-[-24px] opacity-[0.08] pointer-events-none", kpis.netResultVal >= 0 ? "text-success" : "text-destructive")}>
                <Activity className="w-48 h-48" />
              </div>
            </Card>

            <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="rounded-sm border shadow-none bg-card flex flex-col justify-center">
                <CardContent className="p-6">
                  <p className="text-sm text-info/80 font-bold tracking-wide uppercase mb-4">Total Sales</p>
                  <h3 className="text-4xl md:text-5xl font-black text-info tracking-tight">
                    {isLoading ? <Skeleton className="w-32 h-12" /> : `₹${kpis.totalSalesVal.toLocaleString("en-IN")}`}
                  </h3>
                </CardContent>
              </Card>
              <Card className="rounded-sm border shadow-none bg-card flex flex-col justify-center">
                <CardContent className="p-6">
                  <p className="text-sm text-destructive/80 font-bold tracking-wide uppercase mb-4">Total Expenses</p>
                  <h3 className="text-4xl md:text-5xl font-black text-destructive tracking-tight">
                    {isLoading ? <Skeleton className="w-32 h-12" /> : `₹${kpis.totalExpensesVal.toLocaleString("en-IN")}`}
                  </h3>
                  <p className="text-xs text-destructive/60 mt-2 font-medium">Includes Discounts & Operational Cost</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="rounded-sm border border-border bg-card shadow-none hover:bg-card-hover transition-all">
              <CardContent className="p-5 pl-6 border-l-4 border-l-blue-500">
                <p className="text-xs text-muted-foreground font-medium">Total Stock Weight</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{isLoading ? <Skeleton className="w-20 h-6" /> : `${kpis.totalStock.toLocaleString("en-IN")} kg`}</h3>
              </CardContent>
            </Card>

            <Card className="rounded-sm border border-border bg-card shadow-none hover:bg-card-hover transition-all">
              <CardContent className="p-5 pl-6 border-l-4 border-l-gray-500">
                <p className="text-xs text-muted-foreground font-medium">Cash Received</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{isLoading ? <Skeleton className="w-20 h-6" /> : `₹${kpis.cash.toLocaleString("en-IN")}`}</h3>
              </CardContent>
            </Card>

            <Card className="rounded-sm border border-border bg-card shadow-none hover:bg-card-hover transition-all">
              <CardContent className="p-5 pl-6 border-l-4 border-l-purple-500">
                <p className="text-xs text-muted-foreground font-medium">PhonePe Received</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{isLoading ? <Skeleton className="w-20 h-6" /> : `₹${kpis.phonepe.toLocaleString("en-IN")}`}</h3>
              </CardContent>
            </Card>

            {/* Sold Quantities Breakdowns */}
            {[
              { label: "Bone Sold", val: kpis.boneSold },
              { label: "Boneless Sold", val: kpis.bonelessSold },
              { label: "Mixed Sold", val: kpis.mixedSold },
              { label: "Fry Sold", val: kpis.frySold },
              { label: "Curry Sold", val: kpis.currySold },
            ].map((i) => (
              <Card key={i.label} className="rounded-sm border-border shadow-none bg-card hover:bg-card-hover transition-colors">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{i.label}</p>
                  <h3 className="text-xl font-bold mt-1 text-foreground">{isLoading ? <Skeleton className="w-16 h-5" /> : `${i.val.toLocaleString("en-IN")} kg`}</h3>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 border-border rounded-none shadow-none bg-card">
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Sales Distribution (kg)</CardTitle></CardHeader>
              <CardContent className="flex justify-center flex-col items-center">
                <div className="h-64 w-full relative">
                  {isLoading ? <Skeleton className="w-full h-full rounded-full max-w-[200px] max-h-[200px] absolute inset-0 m-auto" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={charts.chartSalesDistribution.length ? charts.chartSalesDistribution : [{ name: 'Empty', value: 1 }]} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value">
                          {(charts.chartSalesDistribution.length ? charts.chartSalesDistribution : [{ name: 'Empty', value: 1 }]).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={charts.chartSalesDistribution.length ? COLORS[index % COLORS.length] : 'var(--muted)'} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => `${value} kg`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-2 border-border rounded-none shadow-none bg-card">
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Inventory Flow (In vs Out)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64 w-full relative">
                  {isLoading ? <Skeleton className="w-full h-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.chartInvFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} />
                        <RechartsTooltip cursor={{ fill: 'var(--chart-bg)' }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey="In" name="Stock In (kg)" fill="var(--chart-3)" radius={[2, 2, 0, 0]} barSize={timeframe === "Today" ? 30 : 20} />
                        <Bar dataKey="Out" name="Stock Out (kg)" fill="var(--chart-5)" radius={[2, 2, 0, 0]} barSize={timeframe === "Today" ? 30 : 20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-3 border-border rounded-none shadow-none bg-card">
              <CardHeader><CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Revenue Trend (₹)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64 w-full relative">
                  {isLoading ? <Skeleton className="w-full h-full" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.chartRevenueList} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--chart-text)' }} tickFormatter={(value) => `₹${value / 1000}k`} />
                        <RechartsTooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "inventory-in" && <div className="bg-card rounded-none border p-6 min-h-[400px]"><InventoryIn /></div>}
      {activeTab === "preparation" && <div className="bg-card rounded-none border p-6 min-h-[400px]"><Preparation /></div>}
      {activeTab === "costs" && <div className="bg-card rounded-none border p-6 min-h-[400px]"><Costs shopId={id} /></div>}
    </div>
  );
}
