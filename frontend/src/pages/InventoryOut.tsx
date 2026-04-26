import React, { useState, useRef, useMemo } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  IndianRupee, Wallet, Beef,
  Trash2, Receipt, X, Pencil, AlertTriangle, Loader2
} from "lucide-react";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

interface OutRecord {
  id?: string;
  _id?: string;
  date: string;
  boneSold: number;
  bonelessSold: number;
  frySold: number;
  currySold: number;
  mixedSold: number;
  boneUsed?: number;
  bonelessUsed?: number;
  fry: number;
  curry: number;
  cash: number;
  phonePe: number;
  total: number;
  discountGiven: number;
  billId?: string;
  createdAt?: string;
}

export default function InventoryOut({
  shopIdFilter,
  dateFilter = "All",
  customStart,
  customEnd,
  salesModalOpen,
  onSalesModalClose,
  refreshTrigger = 0,
}: {
  shopIdFilter?: string;
  dateFilter?: string;
  customStart?: string;
  customEnd?: string;
  salesModalOpen?: boolean;
  onSalesModalClose?: () => void;
  refreshTrigger?: number;
}) {
  const params = useParams();
  const id = shopIdFilter || params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultCosts = { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };

  // ── Data Fetching ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["inventoryOutData", id, refreshTrigger],
    queryFn: async () => {
      if (!id) return null;
      const [salesRes, invRes, prepRes, shopsRes, costsRes, stockRes] = await Promise.all([
        api.get(`/shops/${id}/sales`),
        api.get(`/shops/${id}/inventory-in`),
        api.get(`/shops/${id}/preparations`),
        api.get('/shops'),
        api.get(`/settings/selling-costs?shopId=${id}`),
        api.get(`/shops/${id}/stock`)
      ]);
      return {
        records: salesRes.data.data || [],
        invIn: invRes.data.data || [],
        preps: prepRes.data.data || [],
        shops: shopsRes.data.data || [],
        sellingCosts: costsRes.data.data || defaultCosts,
        liveStock: stockRes.data.data
      };
    },
    enabled: !!id
  });

  const records = data?.records || [];
  const shops = data?.shops || [];
  const sellingCosts = data?.sellingCosts || defaultCosts;
  const liveStock = data?.liveStock || null;

  const currentShop = shops.find((s: any) => s._id === id || s.id === id);
  const shopName = currentShop?.name || "Pinaka Default Shop";
  const shopLocation = currentShop?.location || "Main Branch";

  // ── Form State & Refs ────────────────────────────────────────────────────────
  const itemRefs: Record<string, React.RefObject<HTMLInputElement>> = {
    Bone: useRef<HTMLInputElement>(null),
    Boneless: useRef<HTMLInputElement>(null),
    Fry: useRef<HTMLInputElement>(null),
    Curry: useRef<HTMLInputElement>(null),
    Mixed: useRef<HTMLInputElement>(null),
  };
  const [stockError, setStockError] = useState<{ item: string; available: number; requested: number; field: string } | null>(null);

  const [boneSold, setBoneSold] = useState("");
  const [bonelessSold, setBonelessSold] = useState("");
  const [frySold, setFrySold] = useState("");
  const [currySold, setCurrySold] = useState("");
  const [mixedSold, setMixedSold] = useState("");
  const [cash, setCash] = useState("");
  const [phonePe, setPhonePe] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const [salesDate, setSalesDate] = useState(todayStr);

  const [selectedBill, setSelectedBill] = useState<OutRecord | null>(null);
  // ── Inline Edit State ─────────────────────────────────────────────────────────
  // editingRecord ≠ null means the form is in "update" mode (PUT instead of POST)
  const [editingRecord, setEditingRecord] = useState<OutRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Calculations (Memoized) ──────────────────────────────────────────────────
  const {
    filteredRecords,
    grandTotalAmt,
    paymentTotal,
    discountGivenVal,
    boneTotalAmt,
    bonelessTotalAmt,
    fryTotalAmt,
    curryTotalAmt,
    mixedTotalAmt,
    stockKpis,
    soldKpis
  } = useMemo(() => {
    // 1. Filter Records
    let filtered = records;
    const now = new Date();
    if (dateFilter === "Today") {
      filtered = records.filter((r: any) => r.date === todayStr);
    } else if (dateFilter === "This Week") {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filtered = records.filter((r: any) => r.date >= pastWeek);
    } else if (dateFilter === "This Month") {
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filtered = records.filter((r: any) => r.date >= pastMonth);
    } else if (dateFilter === "Custom" && customStart && customEnd) {
      filtered = records.filter((r: any) => r.date >= customStart && r.date <= customEnd);
    }

    // 2. Form Totals
    // Fry & Curry: user enters grams, price configured as ₹/kg → divide by 1000
    const boneTotalAmt = (Number(boneSold) || 0) * sellingCosts.bone;
    const bonelessTotalAmt = (Number(bonelessSold) || 0) * sellingCosts.boneless;
    const fryTotalAmt = ((Number(frySold) || 0) / 1000) * sellingCosts.fry;
    const curryTotalAmt = ((Number(currySold) || 0) / 1000) * sellingCosts.curry;
    const mixedTotalAmt = (Number(mixedSold) || 0) * sellingCosts.mixed;
    const grandTotalAmt = boneTotalAmt + bonelessTotalAmt + fryTotalAmt + curryTotalAmt + mixedTotalAmt;
    const paymentTotal = (Number(cash) || 0) + (Number(phonePe) || 0);
    const discountGivenVal = Math.max(0, grandTotalAmt - paymentTotal);

    // 3. Overall Stock KPIs — fry/curry stock is in kg, show in grams
    const availBone = liveStock?.boneStock || 0;
    const availBoneless = liveStock?.bonelessStock || 0;
    const availMixed = liveStock?.mixedStock || 0;
    const availFryKg = liveStock?.fryStock || 0;
    const availCurryKg = liveStock?.curryStock || 0;
    const availFry = Math.round(availFryKg * 1000);    // display in grams, no float junk
    const availCurry = Math.round(availCurryKg * 1000);   // display in grams, no float junk
    const totalStock = parseFloat((availBone + availBoneless + availMixed + availFryKg + availCurryKg).toFixed(3));

    // 4. Sold KPIs — frySold/currySold stored as kg in DB, display as grams
    const totalBoneSold = parseFloat(filtered.reduce((s: number, r: any) => s + (Number(r.boneSold) || 0), 0).toFixed(3));
    const totalBonelessSold = parseFloat(filtered.reduce((s: number, r: any) => s + (Number(r.bonelessSold) || 0), 0).toFixed(3));
    const totalMixedSold = parseFloat(filtered.reduce((s: number, r: any) => s + (Number(r.mixedSold) || 0), 0).toFixed(3));
    const totalFrySold = Math.round(filtered.reduce((s: number, r: any) => s + (Number(r.frySold) || 0), 0) * 1000);
    const totalCurrySold = Math.round(filtered.reduce((s: number, r: any) => s + (Number(r.currySold) || 0), 0) * 1000);
    const totalCash = filtered.reduce((s: number, r: any) => s + (Number(r.cash) || 0), 0);
    const totalPhonePe = filtered.reduce((s: number, r: any) => s + (Number(r.phonePe) || 0), 0);
    const discountedAmount = filtered.reduce((s: number, r: any) => s + (Number(r.discountGiven) || 0), 0);

    return {
      filteredRecords: filtered,
      grandTotalAmt, paymentTotal, discountGivenVal,
      boneTotalAmt, bonelessTotalAmt, fryTotalAmt, curryTotalAmt, mixedTotalAmt,
      stockKpis: { availBone, availBoneless, availMixed, availFry, availCurry, totalStock },
      soldKpis: { totalBoneSold, totalBonelessSold, totalMixedSold, totalFrySold, totalCurrySold, totalCash, totalPhonePe, discountedAmount }
    };
  }, [records, dateFilter, customStart, customEnd, boneSold, bonelessSold, frySold, currySold, mixedSold, cash, phonePe, sellingCosts, liveStock]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveSalesMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post(`/shops/${id}/sales`, payload);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Daily sales recorded successfully." });
      setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold("");
      setCash(""); setPhonePe("");
      if (onSalesModalClose) onSalesModalClose();
      queryClient.invalidateQueries({ queryKey: ["inventoryOutData", id] });
      queryClient.invalidateQueries({ queryKey: ["shopStock", id] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to record sales.",
        variant: "destructive"
      });
    }
  });

  const deleteSalesMutation = useMutation({
    mutationFn: async (deleteId: string) => {
      return api.delete(`/shops/${id}/sales/${deleteId}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Record removed" });
      queryClient.invalidateQueries({ queryKey: ["inventoryOutData", id] });
      queryClient.invalidateQueries({ queryKey: ["shopStock", id] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  });

  const handleSaveSales = async () => {
    if (!id) return;
    if (!boneSold && !bonelessSold && !frySold && !currySold && !mixedSold) {
      toast({ title: "Error", description: "Empty sales entry.", variant: "destructive" });
      return;
    }

    // Stock check: fry/curry entered in grams, liveStock is in kg — convert grams→kg for comparison
    if (liveStock) {
      const reqBone = Number(boneSold) || 0;
      const reqBoneless = Number(bonelessSold) || 0;
      const reqFryKg = (Number(frySold) || 0) / 1000;
      const reqCurryKg = (Number(currySold) || 0) / 1000;
      const reqMixed = Number(mixedSold) || 0;

      if (reqBone > liveStock.boneStock) return setStockError({ item: "Bone", available: liveStock.boneStock, requested: reqBone, field: "Bone" });
      if (reqBoneless > liveStock.bonelessStock) return setStockError({ item: "Boneless", available: liveStock.bonelessStock, requested: reqBoneless, field: "Boneless" });
      if (reqMixed > liveStock.mixedStock) return setStockError({ item: "Mixed", available: liveStock.mixedStock, requested: reqMixed, field: "Mixed" });
      if (reqFryKg > liveStock.fryStock) return setStockError({ item: "Fry", available: liveStock.fryStock * 1000, requested: Number(frySold) || 0, field: "Fry" });
      if (reqCurryKg > liveStock.curryStock) return setStockError({ item: "Curry", available: liveStock.curryStock * 1000, requested: Number(currySold) || 0, field: "Curry" });
    }

    // Payload: fry/curry saved as kg in backend (grams ÷ 1000)
    const payload = {
      date: salesDate,
      boneSold: Number(boneSold) || 0,
      bonelessSold: Number(bonelessSold) || 0,
      frySold: (Number(frySold) || 0) / 1000,
      currySold: (Number(currySold) || 0) / 1000,
      mixedSold: Number(mixedSold) || 0,
      cash: Number(cash) || 0,
      phonePe: Number(phonePe) || 0,
      total: grandTotalAmt,
      discountGiven: discountGivenVal,
    };

    if (editingRecord) {
      // ── UPDATE mode (PUT) ───────────────────────────────────────────────
      try {
        await api.put(`/shops/${id}/sales/${editingRecord._id || editingRecord.id}`, payload);
        toast({ title: "Updated", description: `${editingRecord.billId} updated successfully.` });
        setEditingRecord(null);
        setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold("");
        setCash(""); setPhonePe("");
        queryClient.invalidateQueries({ queryKey: ["inventoryOutData", id] });
        if (onSalesModalClose) onSalesModalClose();
      } catch (err: any) {
        toast({ title: "Error", description: err.response?.data?.message || "Failed to update.", variant: "destructive" });
      }
      return;
    }
    // ── CREATE mode (POST) ───────────────────────────────────────────────
    saveSalesMutation.mutate(payload);
  };

  const handleExport = () => {
    let filteredExport = records;
    const now = new Date();

    if (exportRange === "Daily") {
      filteredExport = records.filter((r: any) => r.date === todayStr);
    } else if (exportRange === "Weekly") {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filteredExport = records.filter((r: any) => r.date >= pastWeek);
    } else if (exportRange === "Monthly") {
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filteredExport = records.filter((r: any) => r.date >= pastMonth);
    } else if (exportRange === "Custom") {
      filteredExport = records.filter((r: any) => r.date >= exportStart && r.date <= exportEnd);
    }

    filteredExport = filteredExport.filter((r: any) => !String(r.billId).startsWith("PREP"));

    if (exportFormat === "CSV") {
      const header = "Date,Bone(kg),Boneless(kg),Fry Sale,Curry Sale,Mixed Sale,Cash(Rs),PhonePe(Rs),Total(Rs),Bill Id\n";
      const rows = filteredExport.map((r: any) =>
        `${r.date},${r.boneSold},${r.bonelessSold},${r.frySold || 0},${r.currySold || 0},${r.mixedSold || 0},${r.cash},${r.phonePe},${r.total},${r.billId}`
      ).join("\n");

      const csvContent = "data:text/csv;charset=utf-8,"
        + `Shop Name:,${shopName}\nLocation:,${shopLocation}\nReport Range:,${exportRange} ${exportRange === "Custom" ? `(${exportStart} to ${exportEnd})` : ""}\n\n`
        + header
        + rows;

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${shopName.replace(/\s+/g, "_")}_${exportRange}_Sales.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({ title: "Popup Blocked", description: "Allow popups to download PDF." });
        return;
      }
      printWindow.document.write("<html><head><title>Print PDF</title></head><body><h1>Implement proper PDF generation or print window</h1></body></html>");
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
    toast({ title: "Export Started", description: `Generating ${exportFormat}...` });
  };

  // ── Skeletons ────────────────────────────────────────────────────────────────
  const StatCardSkeleton = () => (
    <div className="rounded-sm border bg-card p-4 shadow-none space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* KPI Dashboard - Top Section */}
      <div className="space-y-6 mb-8">
        <div>
          <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Available Stock & Preparation</h3>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {isLoading ? (
              [1, 2, 3, 4, 5, 6].map(i => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard title="Overall Total" value={`${stockKpis.totalStock} kg`} icon={null} />
                <StatCard title="Bone Avail" value={`${stockKpis.availBone} kg`} icon={null} />
                <StatCard title="Boneless Avail." value={`${stockKpis.availBoneless} kg`} icon={null} />
                <StatCard title="Mixed Avail." value={`${stockKpis.availMixed} kg`} icon={null} />
                <StatCard title="Fry Prep." value={`${stockKpis.availFry} g`} icon={null} />
                <StatCard title="Curry Prep." value={`${stockKpis.availCurry} g`} icon={null} />
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Stock Sold</h3>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {isLoading ? (
              [1, 2, 3, 4, 5, 6].map(i => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard title="Overall Total Sold" className="bg-card border-dashed" value={`${soldKpis.totalBoneSold + soldKpis.totalBonelessSold + soldKpis.totalMixedSold} kg`} icon={null} />
                <StatCard title="Bone Sold" value={`${soldKpis.totalBoneSold} kg`} icon={null} />
                <StatCard title="Boneless Sold" value={`${soldKpis.totalBonelessSold} kg`} icon={null} />
                <StatCard title="Mixed Sold" value={`${soldKpis.totalMixedSold} kg`} icon={null} />
                <StatCard title="Fry Sold" value={`${soldKpis.totalFrySold} g`} icon={null} />
                <StatCard title="Curry Sold" value={`${soldKpis.totalCurrySold} g`} icon={null} />
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Sales Amount</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {isLoading ? (
              [1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard title="Total Amount Received (₹)" value={`₹${(soldKpis.totalCash + soldKpis.totalPhonePe).toLocaleString("en-IN")}`} icon={null} />
                <StatCard title="Cash Received" value={`₹${soldKpis.totalCash.toLocaleString("en-IN")}`} icon={null} />
                <StatCard title="PhonePe Received" value={`₹${soldKpis.totalPhonePe.toLocaleString("en-IN")}`} icon={null} />
                <StatCard title="Discount Given" value={`₹${soldKpis.discountedAmount.toLocaleString("en-IN")}`} icon={null} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <div className="rounded-sm border bg-card shadow-none mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3" style={{ backgroundColor: 'var(--table-header)' }}>
          <div className="w-1.5 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-black text-foreground tracking-tight uppercase">Daily Entry Form</h2>
        </div>
        <div className="p-6">
          <div className="mb-10 p-5 bg-[var(--table-row-2)] rounded-sm border border-border w-full sm:max-w-sm">
            <Label className="text-lg font-bold text-muted-foreground block mb-2">Date</Label>
            <Input
              type="date"
              value={salesDate}
              onChange={(e) => setSalesDate(e.target.value)}
              className="h-[56px] text-xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-4 shadow-none bg-background"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Section B */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-muted-foreground uppercase flex items-center gap-3 border-b pb-3 mb-4">
                <Beef className="h-6 w-6" /> Section B - Sales
              </h3>
              <div className="space-y-5">
                {[
                  { label: "Bone", val: boneSold, setter: setBoneSold, price: sellingCosts.bone, total: boneTotalAmt, unit: "kg" },
                  { label: "Boneless", val: bonelessSold, setter: setBonelessSold, price: sellingCosts.boneless, total: bonelessTotalAmt, unit: "kg" },
                  { label: "Fry", val: frySold, setter: setFrySold, price: sellingCosts.fry, total: fryTotalAmt, unit: "g" },
                  { label: "Curry", val: currySold, setter: setCurrySold, price: sellingCosts.curry, total: curryTotalAmt, unit: "g" },
                  { label: "Mixed", val: mixedSold, setter: setMixedSold, price: sellingCosts.mixed, total: mixedTotalAmt, unit: "kg" },
                ].map((item) => (
                  <div key={item.label} className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-6 p-3 lg:p-4 rounded-sm border border-border" style={{ backgroundColor: 'var(--table-row-2)' }}>
                    <div className="space-y-1 lg:space-y-2">
                      <Label className="text-xs lg:text-lg font-semibold text-muted-foreground">{item.label} Sold ({item.unit})</Label>
                      <Input
                        ref={itemRefs[item.label] as any}
                        type="number"
                        value={item.val}
                        onChange={(e) => item.setter(e.target.value)}
                        placeholder="0"
                        className="h-10 lg:h-[56px] text-lg lg:text-2xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-3 lg:px-4 shadow-none bg-background"
                      />
                    </div>
                    <div className="space-y-1 lg:space-y-2">
                      <Label className="text-xs lg:text-lg font-semibold text-muted-foreground">Price (₹/kg)</Label>
                      <Input readOnly className="h-10 lg:h-[56px] text-base lg:text-xl bg-muted/30 font-bold border-2 text-foreground" value={item.price} />
                    </div>
                    <div className="space-y-1 lg:space-y-2 col-span-2 lg:col-span-1 border-t lg:border-t-0 pt-2 lg:pt-0">
                      <Label className="text-xs lg:text-lg font-semibold text-muted-foreground">Total (₹)</Label>
                      <Input readOnly className="h-10 lg:h-[56px] text-lg lg:text-2xl font-black border-2 border-info/30 text-info" value={item.total} style={{ backgroundColor: 'var(--primary-light-bg)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section C */}
            <div className="space-y-4 lg:space-y-6">
              <h3 className="text-base lg:text-xl font-bold text-muted-foreground uppercase flex items-center gap-2 lg:gap-3 border-b pb-2 lg:pb-3 mb-2 lg:mb-4">
                <Wallet className="h-5 w-5 lg:h-6 lg:w-6" /> Section C - Payment
              </h3>
              <div className="space-y-2 lg:space-y-6">
                <div className="p-3 lg:p-6 rounded-sm border-2 border-info/20 shadow-none flex justify-between items-center relative overflow-hidden" style={{ backgroundColor: 'var(--primary-light-bg)' }}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-info" />
                  <span className="font-bold text-info/80 justify-start pl-2 uppercase tracking-wide lg:tracking-widest text-xs lg:text-sm">Bill Total</span>
                  <span className="text-2xl lg:text-4xl font-black text-info flex items-center tracking-tight"><IndianRupee className="w-5 h-5 lg:w-8 lg:h-8 mr-1" />{grandTotalAmt.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:gap-6">
                  <div className="space-y-1 lg:space-y-2 p-3 lg:p-5 rounded-sm border border-border" style={{ backgroundColor: 'var(--table-row-2)' }}>
                    <Label className="text-xs lg:text-lg font-semibold block mb-1 lg:mb-2 text-muted-foreground">Cash (₹)</Label>
                    <Input type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" className="h-10 lg:h-[60px] text-lg lg:text-3xl font-bold border-2 bg-background" />
                  </div>
                  <div className="space-y-1 lg:space-y-2 p-3 lg:p-5 rounded-sm border border-border" style={{ backgroundColor: 'var(--table-row-2)' }}>
                    <Label className="text-xs lg:text-lg font-semibold block mb-1 lg:mb-2 text-muted-foreground">PhonePe (₹)</Label>
                    <Input type="number" value={phonePe} onChange={(e) => setPhonePe(e.target.value)} placeholder="0" className="h-10 lg:h-[60px] text-lg lg:text-3xl font-bold border-2 text-info bg-background" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-6">
                  <div className="p-3 lg:p-5 rounded-sm flex flex-col lg:flex-row justify-center lg:justify-between items-start lg:items-center shadow-none border-2 border-destructive badge-error">
                    <span className="font-extrabold uppercase tracking-widest text-[10px] lg:text-lg mb-1 lg:mb-0">Discount:</span>
                    <span className="text-lg lg:text-3xl font-black flex items-center"><IndianRupee className="w-4 h-4 mr-1" />{discountGivenVal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="p-3 lg:p-6 rounded-sm border-2 border-success/20 shadow-none flex flex-col lg:flex-row justify-center lg:justify-between items-start lg:items-center relative overflow-hidden bg-success/5 h-full">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-success" />
                    <span className="font-bold text-success/80 justify-start lg:pl-2 ml-2 lg:ml-0 uppercase tracking-wide lg:tracking-widest text-[10px] lg:text-sm mb-1 lg:mb-0">Amount Paid</span>
                    <span className="text-xl lg:text-4xl font-black text-success flex items-center tracking-tight ml-2 lg:ml-0"><IndianRupee className="w-4 h-4 mr-1" />{paymentTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-6 mt-6 md:mt-10 pt-4 md:pt-6 border-t">
            <Button onClick={handleSaveSales} disabled={saveSalesMutation.isPending} className="flex-1 h-12 md:h-[60px] text-lg md:text-xl bg-primary hover:bg-primary/80 font-bold text-white shadow-none">
              {saveSalesMutation.isPending ? "Saving..." : "Save Sales Entry"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sales Modal Modal ... */}
      <Dialog
        open={!!salesModalOpen || !!editingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null);
            setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold("");
            setCash(""); setPhonePe("");
            if (onSalesModalClose) onSalesModalClose();
          }
        }}
      >
        <DialogContent className="w-[97vw] max-w-2xl max-h-[92vh] overflow-y-auto p-0 [&>button]:hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-card z-10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <span className="w-1 h-5 bg-primary rounded-full inline-block" />
              {editingRecord ? (
                <span className="flex items-center gap-2">
                  Daily Entry Form
                  <span className="text-xs font-bold bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Pencil className="h-3 w-3" /> Editing {editingRecord.billId}
                  </span>
                </span>
              ) : "Daily Entry Form"}
            </DialogTitle>
            <button onClick={() => { setEditingRecord(null); setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold(""); setCash(""); setPhonePe(""); if (onSalesModalClose) onSalesModalClose(); }} className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <Label className="w-12 shrink-0">Date</Label>
              <Input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="h-10 text-base font-bold border-2" />
            </div>
            {/* Same simplified form logic */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b pb-2 mb-3"><Beef className="h-4 w-4" /> Section B — Sales</h3>
              <div className="space-y-2">
                {[
                  { label: "Bone", val: boneSold, setter: setBoneSold, price: sellingCosts.bone, total: boneTotalAmt, unit: "kg" },
                  { label: "Boneless", val: bonelessSold, setter: setBonelessSold, price: sellingCosts.boneless, total: bonelessTotalAmt, unit: "kg" },
                  { label: "Fry", val: frySold, setter: setFrySold, price: sellingCosts.fry, total: fryTotalAmt, unit: "g" },
                  { label: "Curry", val: currySold, setter: setCurrySold, price: sellingCosts.curry, total: curryTotalAmt, unit: "g" },
                  { label: "Mixed", val: mixedSold, setter: setMixedSold, price: sellingCosts.mixed, total: mixedTotalAmt, unit: "kg" },
                ].map((item) => (
                  <div key={item.label} className="grid grid-cols-3 gap-2 p-3 rounded-sm border border-border bg-[var(--table-row-2)]">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase">{item.label} Sold ({(item as any).unit})</Label>
                      <Input ref={itemRefs[item.label] as any} type="number" value={item.val} onChange={(e) => item.setter(e.target.value)} className="h-11 text-lg font-bold border-2 px-3" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase">Price</Label>
                      <Input readOnly className="h-11 bg-muted/30 font-bold border-2" value={item.price} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase">Total</Label>
                      <Input readOnly className="h-11 text-lg font-black border-2 border-primary/20 text-primary bg-[var(--primary-light-bg)]" value={item.total.toLocaleString("en-IN")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b pb-2 mb-3"><Wallet className="h-4 w-4" /> Section C — Payment</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-sm border-2 border-primary/20 flex justify-between items-center bg-[var(--primary-light-bg)]">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Bill Total</span>
                  <span className="text-2xl font-black text-primary flex items-center"><IndianRupee className="w-5 h-5 mr-0.5" />{grandTotalAmt.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 p-3 rounded-sm border border-border bg-[var(--table-row-2)]">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cash (₹)</Label>
                    <Input type="number" value={cash} onChange={(e) => setCash(e.target.value)} className="h-12 text-2xl font-bold border-2 px-3" />
                  </div>
                  <div className="space-y-1 p-3 rounded-sm border border-border bg-[var(--table-row-2)]">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PhonePe (₹)</Label>
                    <Input type="number" value={phonePe} onChange={(e) => setPhonePe(e.target.value)} className="h-12 text-2xl font-bold border-2 px-3 text-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-sm flex flex-col justify-center items-start shadow-none border-2 border-destructive/30 bg-destructive/5">
                    <span className="font-extrabold uppercase tracking-wider text-[10px] text-destructive/80 mb-1">Discount</span>
                    <span className="text-xl font-black text-destructive flex items-center"><IndianRupee className="w-4 h-4 mr-1" />{discountGivenVal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="p-3 rounded-sm border-2 border-success/20 shadow-none flex flex-col justify-center items-start relative overflow-hidden bg-success/5">
                    <div className="absolute top-0 left-0 w-1 h-full bg-success" />
                    <span className="font-bold text-success/80 pl-2 uppercase tracking-wider text-[10px] mb-1">Amount Paid</span>
                    <span className="text-xl font-black text-success flex items-center pl-2"><IndianRupee className="w-4 h-4 mr-1" />{paymentTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5 sticky bottom-0 bg-card pt-3 border-t">
            <Button onClick={handleSaveSales} disabled={saveSalesMutation.isPending} className="w-full h-12 text-base bg-primary hover:bg-primary/80 font-bold text-white shadow-none">
              {saveSalesMutation.isPending
                ? (editingRecord ? "Updating..." : "Saving...")
                : (editingRecord ? "Update Entry" : "Save Sales Entry")}
            </Button>
            {editingRecord && (
              <button className="w-full text-xs text-muted-foreground mt-1 hover:text-destructive font-semibold"
                onClick={() => { setEditingRecord(null); setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold(""); setCash(""); setPhonePe(""); }}>
                ✕ Cancel Edit
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales Log Table */}
      <div className="rounded-sm border bg-card shadow-none mb-8">
        <div className="px-6 py-4 border-b flex items-center border-border" style={{ backgroundColor: 'var(--table-header)' }}>
          <h2 className="text-lg font-black text-foreground uppercase tracking-wide">Daily Sales Log</h2>
        </div>
        <div className="p-2 border-b">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <DataTable
              isLoading={false}
              columns={[
                { header: "Date", accessor: "date" },
                { header: "Bone (kg)", accessor: (r: OutRecord) => `${r.boneSold}` },
                { header: "Boneless (kg)", accessor: (r: OutRecord) => `${r.bonelessSold}` },
                { header: "Fry Sale (g)", accessor: (r: OutRecord) => `${Math.round((Number(r.frySold) || 0) * 1000)} g` },
                { header: "Curry Sale (g)", accessor: (r: OutRecord) => `${Math.round((Number(r.currySold) || 0) * 1000)} g` },
                { header: "Mixed Sale (kg)", accessor: (r: OutRecord) => `${r.mixedSold || 0}` },
                { header: "Total (₹)", accessor: (r: OutRecord) => `₹${r.total.toLocaleString("en-IN")}` },
                { header: "Discount (₹)", accessor: (r: OutRecord) => `₹${(r.discountGiven || 0).toLocaleString("en-IN")}` },
                { header: "Cash (₹)", accessor: (r: OutRecord) => `₹${r.cash.toLocaleString("en-IN")}` },
                { header: "PhonePe (₹)", accessor: (r: OutRecord) => `₹${r.phonePe.toLocaleString("en-IN")}` },
                { header: "Amount Paid (₹)", accessor: (r: OutRecord) => <strong className="text-primary">₹{(Number(r.cash || 0) + Number(r.phonePe || 0)).toLocaleString("en-IN")}</strong> },
                {
                  header: "Bill",
                  accessor: (r: OutRecord) => (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] uppercase font-bold text-primary" onClick={() => setSelectedBill(r)}>
                      <Receipt className="h-3 w-3 mr-1" /> {r.billId}
                    </Button>
                  )
                },
                {
                  header: "Actions",
                  accessor: (r: OutRecord) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                        title="Edit"
                        onClick={() => {
                          // Pre-fill form with existing sale values
                          setBoneSold(String(r.boneSold ?? ""));
                          setBonelessSold(String(r.bonelessSold ?? ""));
                          setFrySold(String(Math.round((Number(r.frySold) || 0) * 1000)));
                          setCurrySold(String(Math.round((Number(r.currySold) || 0) * 1000)));
                          setMixedSold(String(r.mixedSold ?? ""));
                          setCash(String(r.cash ?? ""));
                          setPhonePe(String(r.phonePe ?? ""));
                          setSalesDate(r.date || todayStr);
                          // Open the form in edit mode
                          setEditingRecord(r);
                        }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(r._id || r.id || "")}
                        disabled={deleteSalesMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                },
              ]}
              data={filteredRecords.filter((r: any) => !String(r.billId).startsWith("PREP"))}
              pageSize={10}
            />
          )}
        </div>
      </div>

      {/* ── Bill Preview Modal ────────────────────────────────────────────── */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Receipt — {selectedBill?.billId}
            </DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4 py-1">
              {/* Header info */}
              <div className="flex justify-between text-sm text-muted-foreground border-b pb-3">
                <span className="font-semibold">{shopName}</span>
                <span>{selectedBill.date}</span>
              </div>
              {/* Items */}
              <div className="space-y-2">
                {[
                  { label: "Bone", qty: `${selectedBill.boneSold} kg`, show: Number(selectedBill.boneSold) > 0 },
                  { label: "Boneless", qty: `${selectedBill.bonelessSold} kg`, show: Number(selectedBill.bonelessSold) > 0 },
                  { label: "Fry", qty: `${Math.round((Number(selectedBill.frySold) || 0) * 1000)} g`, show: Number(selectedBill.frySold) > 0 },
                  { label: "Curry", qty: `${Math.round((Number(selectedBill.currySold) || 0) * 1000)} g`, show: Number(selectedBill.currySold) > 0 },
                  { label: "Mixed", qty: `${selectedBill.mixedSold} kg`, show: Number(selectedBill.mixedSold) > 0 },
                ].filter(i => i.show).map(item => (
                  <div key={item.label} className="flex justify-between items-center text-sm py-1 border-b border-dashed last:border-0">
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{item.qty}</span>
                  </div>
                ))}
              </div>
              {/* Totals */}
              <div className="bg-muted/30 rounded-sm border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold">₹{selectedBill.total.toLocaleString("en-IN")}</span>
                </div>
                {Number(selectedBill.discountGiven) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-bold">-₹{Number(selectedBill.discountGiven).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Cash</span>
                  <span className="font-semibold">₹{Number(selectedBill.cash).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PhonePe</span>
                  <span className="font-semibold">₹{Number(selectedBill.phonePe).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-black text-base border-t pt-2">
                  <span>Amount Paid</span>
                  <span className="text-primary">₹{(Number(selectedBill.cash) + Number(selectedBill.phonePe)).toLocaleString("en-IN")}</span>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">Thank you for your purchase!</p>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full bg-primary text-white font-bold rounded-sm" onClick={() => setSelectedBill(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Sales Record
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently remove this sales record and restore the sold stock back to inventory.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1 rounded-sm font-bold" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="flex-1 rounded-sm font-bold bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleteSalesMutation.isPending}
              onClick={() => { if (deleteTarget) { deleteSalesMutation.mutate(deleteTarget); setDeleteTarget(null); } }}>
              {deleteSalesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {deleteSalesMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Stock Error Modal */}
      <Dialog open={!!stockError} onOpenChange={(open) => !open && setStockError(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive">⚠️ Insufficient Stock</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p>Not enough <strong className="text-primary">{stockError?.item}</strong> stock available.</p>
            <div className="bg-muted p-4 rounded-md space-y-2 border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Available:</span>
                <span className="font-bold text-lg">{stockError?.available.toFixed(2)} {(stockError?.item === "Fry" || stockError?.item === "Curry") ? "g" : "kg"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Requested:</span>
                <span className="text-destructive font-bold text-lg">{stockError?.requested.toFixed(2)} {(stockError?.item === "Fry" || stockError?.item === "Curry") ? "g" : "kg"}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-[#FF6B00] text-white font-bold h-12 text-lg" onClick={() => setStockError(null)}>Fix Quantity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
