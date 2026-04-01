import { useState, useMemo, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  IndianRupee, TrendingUp, TrendingDown, ArrowDownToLine,
  ArrowUpFromLine, Store, Package, Wallet, Smartphone,
  AlertTriangle, Download, Beef, CookingPot, Bone, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export default function Reports() {
  const [dateRange, setDateRange] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [allShopsData, setAllShopsData] = useState<any[]>([]);
  const [mainInventory, setMainInventory] = useState<any[]>([]);
  const [sellingCosts, setSellingCosts] = useState<any>({ fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 });
  const [counterCashMap, setCounterCashMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [shopsRes, centralInvRes, settingsRes] = await Promise.all([
          api.get("/shops"),
          api.get("/central-inventory"),
          api.get("/settings/selling-costs"),
        ]);

        const shopsList = shopsRes.data.data || [];
        setShops(shopsList);
        setMainInventory(centralInvRes.data.data || []);
        if (settingsRes.data.data) {
          setSellingCosts(settingsRes.data.data);
        }

        const shopsDataPromises = shopsList.map(async (shop: any) => {
          const [salesRes, inventoryInRes, prepRes, cashRes] = await Promise.all([
            api.get(`/shops/${shop._id}/sales`),
            api.get(`/shops/${shop._id}/inventory-in`),
            api.get(`/shops/${shop._id}/preparations`),
            api.get(`/shops/${shop._id}/counter-cash`)
          ]);

          return {
            shop: { ...shop, id: shop._id },
            sales: salesRes.data.data || [],
            inventoryIn: inventoryInRes.data.data || [],
            prepData: prepRes.data.data || [],
            cashData: cashRes.data.data // Special processing below
          };
        });

        const compiledShops = await Promise.all(shopsDataPromises);
        setAllShopsData(compiledShops);

        const newCashMap: Record<string, number> = {};
        compiledShops.forEach(s => {
          if (s.cashData && s.cashData.date) {
            newCashMap[`${s.shop.id}_${s.cashData.date}`] = s.cashData.openingCash;
          }
        });
        setCounterCashMap(newCashMap);

      } catch (err) {
        console.error("Error fetching report data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filterByDate = (records: any[]) => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    if (dateRange === "Today") return records.filter(r => r.date === today);
    if (dateRange === "This Week") {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
      return records.filter(r => r.date >= weekAgo);
    }
    if (dateRange === "This Month") {
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      return records.filter(r => r.date >= monthAgo);
    }
    if (dateRange === "Custom" && customStart && customEnd) {
      return records.filter(r => r.date >= customStart && r.date <= customEnd);
    }
    return records;
  };

  // --- Computations ---

  // Section 1
  const allFilteredSales = allShopsData.flatMap(({ sales }) => filterByDate(sales));

  const totalRevenue     = allFilteredSales.reduce((s, r) => s + (r.total || 0), 0);
  const totalCash        = allFilteredSales.reduce((s, r) => s + (r.cash || 0), 0);
  const totalPhonePe     = allFilteredSales.reduce((s, r) => s + (r.phonePe || 0), 0);
  const totalDiscount    = allFilteredSales.reduce((s, r) => s + (r.discountGiven || 0), 0);
  const totalBoneSold    = allFilteredSales.reduce((s, r) => s + (r.boneSold || 0), 0);
  const totalBoneless    = allFilteredSales.reduce((s, r) => s + (r.bonelessSold || 0), 0);
  const totalFrySold     = allFilteredSales.reduce((s, r) => s + (r.frySold || 0), 0);
  const totalCurrySold   = allFilteredSales.reduce((s, r) => s + (r.currySold || 0), 0);
  const totalMixedSold   = allFilteredSales.reduce((s, r) => s + (r.mixedSold || 0), 0);
  const totalKgSold      = totalBoneSold + totalBoneless + totalFrySold + totalCurrySold + totalMixedSold;

  const mainWarehouseStock = mainInventory
    .filter((r: any) => (r.totalWeight || 0) > 0)
    .reduce((s: number, r: any) => s + (r.totalWeight || 0), 0);

  // Section 2
  const meatSalesData = [
    { name: "Bone", type: "Bone", value: totalBoneSold, kg: totalBoneSold, revenue: totalBoneSold * sellingCosts.bone, fill: "var(--chart-1)" },
    { name: "Boneless", type: "Boneless", value: totalBoneless, kg: totalBoneless, revenue: totalBoneless * sellingCosts.boneless, fill: "var(--chart-2)" },
    { name: "Fry", type: "Fry", value: totalFrySold, kg: totalFrySold, revenue: totalFrySold * sellingCosts.fry, fill: "var(--chart-3)" },
    { name: "Curry", type: "Curry", value: totalCurrySold, kg: totalCurrySold, revenue: totalCurrySold * sellingCosts.curry, fill: "var(--chart-6)" },
    { name: "Mixed", type: "Mixed", value: totalMixedSold, kg: totalMixedSold, revenue: totalMixedSold * sellingCosts.mixed, fill: "var(--chart-4)" },
  ].filter(d => d.value > 0);

  const bestSeller = meatSalesData.length > 0 ? meatSalesData.reduce((prev, current) => (prev.kg > current.kg) ? prev : current) : null;
  const leastSold = meatSalesData.length > 0 ? meatSalesData.reduce((prev, current) => (prev.kg < current.kg) ? prev : current) : null;

  // Section 3
  const shopPerformance = allShopsData.map(({ shop, sales, inventoryIn }) => {
    const filtered = filterByDate(sales);
    const totalRev = filtered.reduce((s, r) => s + (r.total || 0), 0);
    const totalKg = filtered.reduce((s, r) =>
      s + (r.boneSold||0) + (r.bonelessSold||0) + (r.frySold||0) + (r.currySold||0) + (r.mixedSold||0), 0);
    const totalCashShop = filtered.reduce((s, r) => s + (r.cash || 0), 0);
    const totalPhonePeShop = filtered.reduce((s, r) => s + (r.phonePe || 0), 0);

    const totalStockReceived = inventoryIn.reduce((s: number, r: any) =>
      s + (r.bone||0) + (r.boneless||0) + (r.mixed||0), 0);
    const totalStockSold = filtered.reduce((s, r) =>
      s + (r.boneSold||0) + (r.bonelessSold||0) + (r.mixedSold||0), 0);
    const pendingStock = Math.max(0, totalStockReceived - totalStockSold);

    return {
      name: shop.name,
      id: shop.id,
      location: shop.location,
      revenue: totalRev,
      kgSold: totalKg,
      cash: totalCashShop,
      phonePe: totalPhonePeShop,
      pendingStock,
      billCount: filtered.length,
    };
  });

  const sortedShopPerformance = [...shopPerformance].sort((a, b) => b.revenue - a.revenue);
  const highestShop = sortedShopPerformance.length > 0 ? sortedShopPerformance[0] : null;
  const activeShops = sortedShopPerformance.filter(s => s.revenue > 0);
  const lowestShop = activeShops.length > 0 ? activeShops[activeShops.length - 1] : null;
  const highestPendingShop = shopPerformance.length > 0 ? shopPerformance.reduce((p, c) => p.pendingStock > c.pendingStock ? p : c) : null;

  // Section 4
  const dailyTrend = useMemo(() => {
    const map: Record<string, any> = {};
    allShopsData.forEach(({ sales }) => {
      filterByDate(sales).forEach((r: any) => {
        if (!map[r.date]) map[r.date] = {
          date: r.date, revenue: 0, bone: 0, boneless: 0,
          fry: 0, curry: 0, mixed: 0, cash: 0, phonePe: 0
        };
        map[r.date].revenue    += r.total || 0;
        map[r.date].bone       += r.boneSold || 0;
        map[r.date].boneless   += r.bonelessSold || 0;
        map[r.date].fry        += r.frySold || 0;
        map[r.date].curry      += r.currySold || 0;
        map[r.date].mixed      += r.mixedSold || 0;
        map[r.date].cash       += r.cash || 0;
        map[r.date].phonePe    += r.phonePe || 0;
      });
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [allShopsData, dateRange, customStart, customEnd]);

  const peakDay = dailyTrend.length > 0 ? dailyTrend.reduce((p, c) => p.revenue > c.revenue ? p : c) : null;
  const quietDay = dailyTrend.length > 0 ? dailyTrend.filter(d => d.revenue > 0).reduce((p, c) => p.revenue < c.revenue ? p : c, dailyTrend[0] || null) : null;
  
  let bestMeatPeakDay = "";
  if (peakDay) {
    const peakMeats = [
      { name: "Bone", kg: peakDay.bone },
      { name: "Boneless", kg: peakDay.boneless },
      { name: "Fry", kg: peakDay.fry },
      { name: "Curry", kg: peakDay.curry },
      { name: "Mixed", kg: peakDay.mixed }
    ];
    const bestOnPeak = peakMeats.reduce((p, c) => p.kg > c.kg ? p : c);
    bestMeatPeakDay = bestOnPeak.name;
  }

  // Section 5 - Inventory
  const pendingSummaryData = allShopsData.map(({ shop, sales, inventoryIn }) => {
    const totalIn = inventoryIn.reduce((s: number, r: any) => s + (r.bone||0) + (r.boneless||0) + (r.mixed||0), 0);
    const totalSold = filterByDate(sales).reduce((s, r) => s + (r.boneSold||0) + (r.bonelessSold||0) + (r.mixedSold||0), 0);
    const pending = Math.max(0, totalIn - totalSold);

    const boneIn = inventoryIn.reduce((s: number, r: any) => s + (r.bone||0), 0);
    const bonelessIn = inventoryIn.reduce((s: number, r: any) => s + (r.boneless||0), 0);
    const mixedIn = inventoryIn.reduce((s: number, r: any) => s + (r.mixed||0), 0);
    const boneSoldShop = filterByDate(sales).reduce((s, r) => s + (r.boneSold||0), 0);
    const bonelessSoldShop = filterByDate(sales).reduce((s, r) => s + (r.bonelessSold||0), 0);
    const mixedSoldShop = filterByDate(sales).reduce((s, r) => s + (r.mixedSold||0), 0);
    
    return {
      name: shop.name,
      location: shop.location,
      totalIn, totalSold, pending,
      boneIn, bonelessIn, mixedIn,
      boneSoldShop, bonelessSoldShop, mixedSoldShop,
      bonePending: Math.max(0, boneIn - boneSoldShop),
      bonelessPending: Math.max(0, bonelessIn - bonelessSoldShop),
      mixedPending: Math.max(0, mixedIn - mixedSoldShop)
    };
  });

  // Section 6 - Preparation
  const prepSummary = allShopsData.map(({ shop, prepData }) => {
    const filtered = filterByDate(prepData);
    return {
      name: shop.name,
      fryOutput: filtered.reduce((s: number, r: any) => s + (r.fry || 0), 0),
      curryOutput: filtered.reduce((s: number, r: any) => s + (r.curry || 0), 0),
      boneUsed: filtered.reduce((s: number, r: any) => s + (r.boneUsed || 0), 0),
      bonelessUsed: filtered.reduce((s: number, r: any) => s + (r.bonelessUsed || 0), 0),
    };
  }).filter(s => s.fryOutput > 0 || s.curryOutput > 0);

  // Section 7 - Payments
  const grandTotal = totalCash + totalPhonePe;
  const cashPct = grandTotal > 0 ? ((totalCash / grandTotal) * 100).toFixed(1) : "0";
  const shopPayments = allShopsData.map(({ shop, sales }) => {
    const filtered = filterByDate(sales);
    return {
      name: shop.name,
      cash: filtered.reduce((s, r) => s + (r.cash || 0), 0),
      phonePe: filtered.reduce((s, r) => s + (r.phonePe || 0), 0),
    };
  });

  // Section 8 - EOD Log
  const eodLog = allShopsData.flatMap(({ shop, sales }) =>
    filterByDate(sales).map((r: any) => ({
      ...r,
      shopName: shop.name,
      totalKg: (r.boneSold||0)+(r.bonelessSold||0)+(r.frySold||0)+(r.currySold||0)+(r.mixedSold||0),
    }))
  ).sort((a, b) => b.date.localeCompare(a.date));

  const handleDownloadCSV = () => {
    const headers = "Shop,Date,Bone(kg),Boneless(kg),Fry(kg),Curry(kg),Mixed(kg),Cash(₹),PhonePe(₹),Total(₹)";
    const rows = eodLog.map(r => 
      `${r.shopName},${r.date},${r.boneSold||0},${r.bonelessSold||0},${r.frySold||0},${r.currySold||0},${r.mixedSold||0},${r.cash||0},${r.phonePe||0},${r.total||0}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reports_${dateRange.replace(" ", "_").toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const counterCashData = useMemo(() => {
    const list: any[] = [];
    allShopsData.forEach(({ shop, sales }) => {
      const dates = new Set<string>();
      sales.forEach((s: any) => dates.add(s.date));
      Object.keys(counterCashMap).forEach(key => {
        if (key.startsWith(`${shop.id}_`)) dates.add(key.split("_")[1]);
      });

      dates.forEach(d => {
        if (filterByDate([{ date: d }]).length > 0) {
          const daySales = sales.filter((s: any) => s.date === d && !String(s.billId).startsWith("PREP"));
          const cashSales = daySales.reduce((acc: number, r: any) => acc + (r.cash || 0), 0);
          const phonePe = daySales.reduce((acc: number, r: any) => acc + (r.phonePe || 0), 0);
          const openingCash = counterCashMap[`${shop.id}_${d}`] || 0;
          if (openingCash > 0 || cashSales > 0 || phonePe > 0) {
            list.push({
              date: d,
              shopId: shop.id,
              shopName: shop.name,
              openingCash,
              cashSales,
              phonePe,
              counterTotal: openingCash + cashSales
            });
          }
        }
      });
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [allShopsData, counterCashMap, dateRange, customStart, customEnd]);

  const counterCashChartData = useMemo(() => {
    const map: Record<string, any> = {};
    counterCashData.forEach(row => {
      if (!map[row.shopId]) map[row.shopId] = { name: row.shopName, cashSales: 0, openingCash: 0 };
      map[row.shopId].cashSales += row.cashSales;
      map[row.shopId].openingCash += row.openingCash;
    });
    return Object.values(map);
  }, [counterCashData]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center p-12 text-center text-muted-foreground w-full">
        <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
        <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Analytics...</h2>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-12 text-center text-muted-foreground">
        <Store className="h-16 w-16 mb-4 text-muted" />
        <h2 className="text-xl font-semibold mb-2 text-foreground">No shops found</h2>
        <p>Add shops from the Shop Management page to see reports.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Reports" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Detailed insights and performance metrics across all shops.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-4 rounded-sm border border-[var(--border)] shadow-none mb-6">
        
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 w-full lg:w-auto">
          <div className="bg-slate-100 p-1.5 rounded-sm flex flex-wrap gap-1 items-center shadow-none border border-slate-200/60 no-scrollbar">
            {["Today", "This Week", "This Month", "Custom"].map(t => (
              <button
                key={t}
                onClick={() => setDateRange(t as any)}
                className={cn(
                  "whitespace-nowrap flex-1 lg:flex-none min-h-[44px] px-4 lg:px-6 py-1.5 rounded-sm text-sm font-bold transition-all",
                  dateRange === t ? "bg-primary text-white shadow-none scale-100" : "text-muted-foreground hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {dateRange === "Custom" && (
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-card p-2 rounded-sm border border-[var(--border)] shadow-none animate-in fade-in slide-in-from-left-4 duration-300 w-full lg:w-auto mt-2 lg:mt-0">
              <div className="w-full sm:w-[130px]">
                 <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start Date" />
              </div>
              <span className="text-muted-foreground font-bold hidden sm:inline">-</span>
              <div className="w-full sm:w-[130px]">
                 <AdvancedDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End Date" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
          <Button onClick={handleDownloadCSV} variant="outline" className="gap-2 h-11 rounded-sm font-bold bg-card border-[var(--border)] shadow-none flex-1 lg:flex-none hover:text-primary hover:border-primary/30 transition-all">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </div>
      </div>

      {/* B. Section 1 — Overall KPI Summary Cards */}
      <div>
        <h2 className="font-semibold mb-4 text-base">Overall Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={<IndianRupee />} color="success" />
          <StatCard title="Total Kg Sold" value={`${totalKgSold.toLocaleString()} kg`} icon={<Beef />} color="info" />
          <StatCard title="Cash Collected" value={`₹${totalCash.toLocaleString()}`} icon={<Wallet />} color="default" />
          <StatCard title="PhonePe Collected" value={`₹${totalPhonePe.toLocaleString()}`} icon={<Smartphone />} color="info" />
          <StatCard title="Discount Given" value={`₹${totalDiscount.toLocaleString()}`} icon={<AlertTriangle />} color="warning" />
          <StatCard title="Warehouse Stock" value={`${mainWarehouseStock.toLocaleString()} kg`} icon={<Package />} color="success" />
          <StatCard title="Active Shops" value={`${shops.length} shops`} icon={<Store />} color="default" />
          <StatCard title="Total Bills" value={`${allFilteredSales.length} bills`} icon={<ArrowUpFromLine />} color="default" />
        </div>
      </div>

      {/* C. Section 2 — Sales by Meat Type */}
      <div>
        <h2 className="font-semibold mb-4 text-base">Sales by Meat Type</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-sm border bg-card p-5 shadow-none flex flex-col justify-center items-center">
            {meatSalesData.length > 0 ? (
              <div className="w-full relative h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={meatSalesData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4}>
                      {meatSalesData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-xl font-bold">{totalKgSold.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">kg total</span>
                </div>
              </div>
            ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground">No data for selected period</div>}
          </div>

          <div className="rounded-sm border bg-card p-5 shadow-none">
            {meatSalesData.length > 0 ? (
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meatSalesData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="type" type="category" width={70} />
                    <Tooltip cursor={{fill: 'transparent'}} formatter={(val: number, name: string, props: any) => [props.dataKey === 'revenue' ? `₹${val.toLocaleString()}` : `${val} kg`, props.dataKey === 'revenue' ? 'Revenue' : 'Kg Sold']} />
                    <Legend />
                    <Bar dataKey="kg" fill="var(--chart-1)" name="Kg Sold" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="revenue" fill="var(--chart-2)" name="Revenue" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground">No data for selected period</div>}
          </div>
        </div>
        
        {meatSalesData.length > 0 && bestSeller && leastSold && (
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 badge-success px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide">
              <TrendingUp className="h-4 w-4" /> Best Seller: {bestSeller.name} ({bestSeller.kg} kg)
            </div>
            {activeShops.length > 1 && (
              <div className="flex items-center gap-2 badge-error px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide">
                <TrendingDown className="h-4 w-4" /> Least Sold: {leastSold.name} ({leastSold.kg} kg)
              </div>
            )}
            {meatSalesData.map(m => (
              <div key={m.name} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold">
                <span className="uppercase">{m.name}:</span> ₹{m.revenue.toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* D. Section 3 — Shop Performance Comparison */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Shop Performance Comparison</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-sm border bg-card p-5 shadow-none">
            {shopPerformance.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shopPerformance} margin={{ top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" orientation="left" stroke="var(--chart-3)" />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--chart-2)" />
                    <Tooltip cursor={{fill: 'transparent'}} formatter={(val: number, name: string, props: any) => [props.dataKey === 'revenue' ? `₹${val.toLocaleString()}` : `${val} kg`, props.dataKey === 'revenue' ? 'Revenue' : 'Kg Sold']} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="var(--chart-3)" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="kgSold" fill="var(--chart-2)" name="Kg Sold" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="h-[280px] flex items-center justify-center text-muted-foreground">No data for selected period</div>}
          </div>
          
          <div className="rounded-sm border bg-card p-5 shadow-none">
            <DataTable
              columns={[
                { header: "Rank", accessor: (r) => shopPerformance.findIndex((s) => s.id === r.id) + 1 },
                { 
                  header: "Shop", 
                  accessor: (r) => (
                    <div className="flex flex-col">
                      <span>{r.name}</span>
                      {r.id === highestShop?.id && <span className="text-[10px] badge-success px-1.5 py-0.5 rounded w-fit mt-1 font-bold uppercase">Top Performer</span>}
                      {r.id === lowestShop?.id && r.revenue > 0 && activeShops.length > 1 && <span className="text-[10px] badge-error px-1.5 py-0.5 rounded w-fit mt-1 font-bold uppercase">Needs Attention</span>}
                    </div>
                  )
                },
                { header: "Revenue", accessor: (r) => `₹${r.revenue.toLocaleString()}` },
                { header: "Kg Sold", accessor: (r) => `${r.kgSold} kg` },
                { header: "Bills", accessor: "billCount" },
                { header: "Pending Stock", accessor: (r) => `${r.pendingStock} kg` },
              ]}
              data={sortedShopPerformance}
              pageSize={5}
            />
          </div>
        </div>

        {shopPerformance.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {highestShop && (
              <div className="bg-card rounded-sm border p-4 shadow-none">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Top Performing Shop</p>
                <p className="font-bold text-lg">{highestShop.name}</p>
                <p className="text-success font-semibold">₹{highestShop.revenue.toLocaleString()}</p>
              </div>
            )}
            {lowestShop && activeShops.length > 1 && (
              <div className="bg-card rounded-sm border p-4 shadow-none">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold text-destructive">Needs Attention</p>
                <p className="font-bold text-lg">{lowestShop.name}</p>
                <p className="text-muted-foreground font-semibold">₹{lowestShop.revenue.toLocaleString()}</p>
              </div>
            )}
            {highestPendingShop && highestPendingShop.pendingStock > 0 && (
              <div className="bg-card rounded-sm border p-4 shadow-none">
                <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold">Highest Pending Stock</p>
                <p className="font-bold text-lg">{highestPendingShop.name}</p>
                <p className="text-warning font-semibold">{highestPendingShop.pendingStock} kg</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* E. Section 4 — Daily Sales Trend */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Daily Sales Trend — All Shops Combined</h2>
        <div className="rounded-sm border bg-card p-5 shadow-none flex flex-col gap-6">
          {dailyTrend.length > 0 ? (
            <>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend} margin={{ top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={3} name="Revenue (₹)" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} formatter={(v) => `${v} kg`} />
                    <Legend />
                    <Bar dataKey="bone" stackId="a" fill="var(--chart-1)" name="Bone" />
                    <Bar dataKey="boneless" stackId="a" fill="var(--chart-2)" name="Boneless" />
                    <Bar dataKey="fry" stackId="a" fill="var(--chart-3)" name="Fry" />
                    <Bar dataKey="curry" stackId="a" fill="var(--chart-6)" name="Curry" />
                    <Bar dataKey="mixed" stackId="a" fill="var(--chart-4)" name="Mixed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                {peakDay && (
                  <div className="bg-primary/10 text-primary px-4 py-2 rounded-sm font-bold text-sm uppercase tracking-wide">
                    Peak Day: {peakDay.date} — ₹{peakDay.revenue.toLocaleString()}
                  </div>
                )}
                {quietDay && dailyTrend.length > 1 && (
                  <div className="badge-info px-4 py-2 rounded-sm font-bold text-sm uppercase tracking-wide">
                    Quietest Day: {quietDay.date} — ₹{quietDay.revenue.toLocaleString()}
                  </div>
                )}
                {bestMeatPeakDay && peakDay && (
                  <div className="bg-primary/10 text-primary px-4 py-2 rounded-sm font-bold text-sm uppercase tracking-wide">
                    Best Meat on Peak Day: {bestMeatPeakDay}
                  </div>
                )}
              </div>
            </>
          ) : <div className="h-[250px] flex items-center justify-center text-muted-foreground">No data for selected period</div>}
        </div>
      </div>

      {/* F. Section 5 — Inventory Monitoring per Shop */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Inventory Monitoring — Per Shop</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {pendingSummaryData.map(shop => {
            const bonePct = shop.boneIn > 0 ? (shop.boneSoldShop / shop.boneIn * 100) : 0;
            const bonelessPct = shop.bonelessIn > 0 ? (shop.bonelessSoldShop / shop.bonelessIn * 100) : 0;
            const mixedPct = shop.mixedIn > 0 ? (shop.mixedSoldShop / shop.mixedIn * 100) : 0;
            
            return (
              <div key={shop.name} className="rounded-sm border bg-card p-5 shadow-none flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-lg">{shop.name}</h3>
                  <p className="text-xs text-muted-foreground">{shop.location}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{color: 'var(--chart-1)'}}>Bone</span>
                      <span className="text-muted-foreground">{shop.boneSoldShop} kg sold / {shop.boneIn} kg received</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${Math.min(100, bonePct)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{color: 'var(--chart-2)'}}>Boneless</span>
                      <span className="text-muted-foreground">{shop.bonelessSoldShop} kg sold / {shop.bonelessIn} kg received</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full" style={{backgroundColor: 'var(--chart-2)', width: `${Math.min(100, bonelessPct)}%`}}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{color: 'var(--chart-4)'}}>Mixed</span>
                      <span className="text-muted-foreground">{shop.mixedSoldShop} kg sold / {shop.mixedIn} kg received</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full" style={{backgroundColor: 'var(--chart-4)', width: `${Math.min(100, mixedPct)}%`}}></div>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "px-3 py-1.5 rounded-sm text-sm font-semibold w-fit",
                  shop.pending > 20 ? "badge-warning" : shop.pending > 0 ? "badge-info" : "badge-success"
                )}>
                  {shop.pending} kg pending
                </div>

                <div className="h-[120px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Bone", In: shop.boneIn, Sold: shop.boneSoldShop },
                      { name: "Boneless", In: shop.bonelessIn, Sold: shop.bonelessSoldShop },
                      { name: "Mixed", In: shop.mixedIn, Sold: shop.mixedSoldShop }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10}} />
                      <Tooltip cursor={{fill: 'transparent'}} formatter={(v) => `${v} kg`} />
                      <Bar dataKey="In" fill="var(--border)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Sold" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-sm border bg-card p-5 shadow-none">
           <h3 className="font-bold mb-4 text-sm uppercase text-muted-foreground tracking-wider">Pending Inventory Summary</h3>
           <DataTable
              columns={[
                { header: "Shop", accessor: "name" },
                { header: "Bone Pending (kg)", accessor: "bonePending" },
                { header: "Boneless Pending (kg)", accessor: "bonelessPending" },
                { header: "Mixed Pending (kg)", accessor: "mixedPending" },
                { header: "Total Pending (kg)", accessor: "pending" },
                { 
                  header: "Status", 
                  accessor: (r) => (
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-semibold",
                      r.pending > 30 ? "badge-error" : r.pending > 10 ? "badge-warning" : "badge-success"
                    )}>
                      {r.pending > 30 ? "Critical" : r.pending > 10 ? "Watch" : "Good"}
                    </span>
                  )
                },
              ]}
              data={pendingSummaryData}
              pageSize={5}
            />
        </div>
      </div>

      {/* G. Section 6 — Preparation Monitoring */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Preparation (Fry & Curry) — All Shops</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-sm border bg-card p-5 shadow-none flex items-center justify-center min-h-[250px]">
            {prepSummary.length > 0 ? (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepSummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} formatter={(v) => `${v} kg`} />
                    <Legend />
                    <Bar dataKey="fryOutput" fill="var(--chart-3)" name="Fry Output" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="curryOutput" fill="var(--chart-6)" name="Curry Output" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <span className="text-muted-foreground">No preparation data for selected period</span>}
          </div>
          
          <div className="rounded-sm border bg-card p-5 shadow-none">
            <DataTable
              columns={[
                { header: "Shop", accessor: "name" },
                { header: "Fry Prepared", accessor: (r) => `${r.fryOutput} kg` },
                { header: "Curry Prepared", accessor: (r) => `${r.curryOutput} kg` },
                { header: "Bone Used", accessor: (r) => `${r.boneUsed} kg` },
                { header: "Boneless Used", accessor: (r) => `${r.bonelessUsed} kg` },
              ]}
              data={prepSummary}
              pageSize={5}
            />
          </div>
        </div>
      </div>

      {/* H. Section 7 — Payment Split Analysis */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Payment Mode Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-sm border bg-card p-5 shadow-none flex h-[240px]">
            {grandTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: "Cash", value: totalCash, fill: "var(--chart-5)" },
                    { name: "PhonePe", value: totalPhonePe, fill: "var(--chart-2)" }
                  ]} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={60} outerRadius={80}>
                     {["Cash", "PhonePe"].map((name, i) => <Cell key={i} fill={i===0 ? "var(--chart-5)" : "var(--chart-2)"} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" />
                  <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-sm font-bold fill-foreground">
                    {cashPct}% Cash
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="w-full h-full flex items-center justify-center text-muted-foreground">No data</div>}
          </div>

          <div className="flex flex-col gap-4">
            <StatCard title="Total Cash" value={`₹${totalCash.toLocaleString()}`} icon={<Wallet />} color="default" />
            <StatCard title="Total PhonePe" value={`₹${totalPhonePe.toLocaleString()}`} icon={<Smartphone />} color="info" />
          </div>

          <div className="rounded-sm border bg-card p-5 shadow-none h-[240px]">
            {shopPayments.some(s => s.cash > 0 || s.phonePe > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shopPayments}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{fill: 'transparent'}} formatter={(v: number) => `₹${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="cash" stackId="a" fill="var(--chart-5)" name="Cash" />
                  <Bar dataKey="phonePe" stackId="a" fill="var(--chart-2)" name="PhonePe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="w-full h-full flex items-center justify-center text-muted-foreground">No data</div>}
          </div>
        </div>
      </div>

      {/* I. Section 8 — EOD Daily Sales Log Table */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Daily Sales Log — All Shops</h2>
        <div className="rounded-sm border bg-card p-5 shadow-none">
          <DataTable
            columns={[
              { header: "Date", accessor: "date" },
              { header: "Shop", accessor: "shopName" },
              { header: "Bill ID", accessor: "billId" },
              { header: "Bone(kg)", accessor: "boneSold" },
              { header: "Boneless(kg)", accessor: "bonelessSold" },
              { header: "Fry(kg)", accessor: "frySold" },
              { header: "Curry(kg)", accessor: "currySold" },
              { header: "Mixed(kg)", accessor: "mixedSold" },
              { header: "Total Kg", accessor: "totalKg" },
              { header: "Cash(₹)", accessor: (r) => r.cash?.toLocaleString() || "0" },
              { header: "PhonePe(₹)", accessor: (r) => r.phonePe?.toLocaleString() || "0" },
              { header: "Discount(₹)", accessor: (r) => r.discountGiven?.toLocaleString() || "0" },
              { header: "Total(₹)", accessor: (r) => r.total?.toLocaleString() || "0" },
            ]}
            data={eodLog}
            pageSize={10}
          />
        </div>
      </div>

      {/* J. Section 9 — Counter Cash Summary */}
      <div>
        <h2 className="font-semibold mb-4 text-base mt-8">Counter Cash Summary</h2>
        <div className="flex flex-col gap-6">
          <div className="rounded-sm border bg-card p-5 shadow-none flex items-center justify-center min-h-[300px]">
            {counterCashChartData.length > 0 ? (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={counterCashChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} formatter={(v: number) => `₹${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="openingCash" fill="var(--chart-4)" name="Opening Cash" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="cashSales" fill="var(--chart-5)" name="Sales" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <span className="text-muted-foreground">No counter cash data for selected period</span>}
          </div>
          
          <div className="rounded-sm border bg-card p-5 shadow-none">
            <DataTable
              columns={[
                { header: "Date", accessor: "date" },
                { header: "Shop", accessor: "shopName" },
                { header: "Opening Cash", accessor: (r) => `₹${r.openingCash.toLocaleString()}` },
                { header: "Sales", accessor: (r) => `₹${r.cashSales.toLocaleString()}` },
                { header: "Counter Total", accessor: (r) => `₹${r.counterTotal.toLocaleString()}` },
              ]}
              data={counterCashData}
              pageSize={5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
