import { useState, useEffect, useRef } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  IndianRupee, Wallet, Smartphone, Beef, CookingPot, 
  Pencil, Trash2, Receipt, FileText, Download, X, Ham, DownloadCloud,
  Package, Bone, TrendingUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface InventoryInRecord {
  bone: number;
  boneless: number;
  mixed: number;
}

interface PreparationRecord {
  fryPrep: number;
  curryPrep: number;
}

export default function InventoryOut({ 
  shopIdFilter, 
  dateFilter = "Today", 
  customStart, 
  customEnd,
  salesModalOpen,
  onSalesModalClose,
}: { 
  shopIdFilter?: string; 
  dateFilter?: string; 
  customStart?: string; 
  customEnd?: string;
  salesModalOpen?: boolean;
  onSalesModalClose?: () => void;
}) {
  const params = useParams();
  const id = shopIdFilter || params.id;
  const { toast } = useToast();
  
  const [shops, setShops] = useState<any[]>([]);
  const currentShop = shops.find((s: any) => s._id === id || s.id === id);
  const shopName = currentShop?.name || "Pinaka Default Shop";
  const shopLocation = currentShop?.location || "Main Branch";

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<OutRecord[]>([]);
  const [invIn, setInvIn] = useState<InventoryInRecord[]>([]);
  const [preps, setPreps] = useState<PreparationRecord[]>([]);
  const [selectedBill, setSelectedBill] = useState<OutRecord | null>(null);
  const [liveStock, setLiveStock] = useState<any>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
        const [salesRes, invRes, prepRes, shopsRes, costsRes, stockRes] = await Promise.all([
          api.get(`/shops/${id}/sales`),
          api.get(`/shops/${id}/inventory-in`),
          api.get(`/shops/${id}/preparations`),
          api.get('/shops'),
          api.get(`/settings/selling-costs?shopId=${id}`),
          api.get(`/shops/${id}/stock`)
        ]);
        setRecords(salesRes.data.data || []);
        setInvIn(invRes.data.data || []);
        setPreps(prepRes.data.data || []);
        setShops(shopsRes.data.data || []);
        setSellingCosts(costsRes.data.data || defaultCosts);
        setLiveStock(stockRes.data.data);
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to fetch sales dashboard data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchData();
  }, [id]);

  const defaultCosts = { fry: 280, curry: 250, bone: 200, boneless: 400, mixed: 200 };
  const [sellingCosts, setSellingCosts] = useState<any>(defaultCosts);

  // Form State & Refs
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

  const boneTotalAmt = (Number(boneSold) || 0) * sellingCosts.bone;
  const bonelessTotalAmt = (Number(bonelessSold) || 0) * sellingCosts.boneless;
  const fryTotalAmt = (Number(frySold) || 0) * sellingCosts.fry;
  const curryTotalAmt = (Number(currySold) || 0) * sellingCosts.curry;
  const mixedTotalAmt = (Number(mixedSold) || 0) * sellingCosts.mixed;
  
  const grandTotalAmt = boneTotalAmt + bonelessTotalAmt + fryTotalAmt + curryTotalAmt + mixedTotalAmt;
  const paymentTotalInitial = (Number(cash) || 0) + (Number(phonePe) || 0);
  const remainingBalance = grandTotalAmt - paymentTotalInitial;

  const todayStr = new Date().toISOString().split("T")[0];
  const [salesDate, setSalesDate] = useState(todayStr);

  const todayRecords = records.filter(r => r.date === todayStr);
  const todayCash = todayRecords.reduce((s, r) => s + r.cash, 0);
  const todayPhonePe = todayRecords.reduce((s, r) => s + r.phonePe, 0);
  const todaySales = todayCash + todayPhonePe;
  
  const todayFry = todayRecords.reduce((s, r) => s + r.fry, 0);
  const todayCurry = todayRecords.reduce((s, r) => s + r.curry, 0);

  // Filter records based on dateFilter prop
  let filteredRecords = records;
  const now = new Date();
  
  if (dateFilter === "Today") {
    filteredRecords = records.filter(r => r.date === todayStr);
  } else if (dateFilter === "This Week") {
    const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    filteredRecords = records.filter(r => r.date >= pastWeek);
  } else if (dateFilter === "This Month") {
    const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    filteredRecords = records.filter(r => r.date >= pastMonth);
  } else if (dateFilter === "Custom" && customStart && customEnd) {
    filteredRecords = records.filter(r => r.date >= customStart && r.date <= customEnd);
  }

  // Overall KPIs Calculation
  const availBone = liveStock?.boneStock || 0;
  const availBoneless = liveStock?.bonelessStock || 0;
  const availMixed = liveStock?.mixedStock || 0;
  const availFry = liveStock?.fryStock || 0;
  const availCurry = liveStock?.curryStock || 0;
  const totalStock = availBone + availBoneless + availMixed + availFry + availCurry;

  // KPIs for Sold & Payment should compute over filteredRecords
  const totalBoneSold = filteredRecords.reduce((s, r) => s + (Number(r.boneSold) || 0), 0);
  const totalBonelessSold = filteredRecords.reduce((s, r) => s + (Number(r.bonelessSold) || 0), 0);
  const totalMixedSold = filteredRecords.reduce((s, r) => s + (Number(r.mixedSold) || 0), 0);
  const totalFrySold = filteredRecords.reduce((s, r) => s + (Number(r.frySold) || 0), 0);
  const totalCurrySold = filteredRecords.reduce((s, r) => s + (Number(r.currySold) || 0), 0);

  const totalCash = filteredRecords.reduce((s, r) => s + (Number(r.cash) || 0), 0);
  const totalPhonePe = filteredRecords.reduce((s, r) => s + (Number(r.phonePe) || 0), 0);
  const discountedAmount = filteredRecords.reduce((s, r) => s + (Number(r.discountGiven) || 0), 0);

  // Payment Form calculation
  const paymentTotal = (Number(cash) || 0) + (Number(phonePe) || 0);
  const discountGivenVal = Math.max(0, grandTotalAmt - paymentTotal);

  // Export State
  const [exportFormat, setExportFormat] = useState<"CSV" | "PDF">("CSV");
  const [exportRange, setExportRange] = useState<"Daily" | "Weekly" | "Monthly" | "Custom">("Daily");
  const [exportStart, setExportStart] = useState(todayStr);
  const [exportEnd, setExportEnd] = useState(todayStr);



  const handleSaveSales = async () => {
    if (!id) return;
    if (!boneSold && !bonelessSold && !frySold && !currySold && !mixedSold) {
      toast({ title: "Error", description: "Empty sales entry.", variant: "destructive" });
      return;
    }

    try {
      // 1. Fetch current stock from backend
      const stockRes = await api.get(`/shops/${id}/stock`);
      const stock = stockRes.data.data;

      const reqBone = Number(boneSold) || 0;
      const reqBoneless = Number(bonelessSold) || 0;
      const reqFry = Number(frySold) || 0;
      const reqCurry = Number(currySold) || 0;
      const reqMixed = Number(mixedSold) || 0;

      // 2. Validate requested quantities vs available stock
      if (reqBone > stock.boneStock) {
        setStockError({ item: "Bone", available: stock.boneStock, requested: reqBone, field: "Bone" });
        return;
      }
      if (reqBoneless > stock.bonelessStock) {
        setStockError({ item: "Boneless", available: stock.bonelessStock, requested: reqBoneless, field: "Boneless" });
        return;
      }
      if (reqMixed > stock.mixedStock) {
        setStockError({ item: "Mixed", available: stock.mixedStock, requested: reqMixed, field: "Mixed" });
        return;
      }
      if (reqFry > stock.fryStock) {
        setStockError({ item: "Fry", available: stock.fryStock, requested: reqFry, field: "Fry" });
        return;
      }
      if (reqCurry > stock.curryStock) {
        setStockError({ item: "Curry", available: stock.curryStock, requested: reqCurry, field: "Curry" });
        return;
      }

      const payload = {
        date: salesDate,
        boneSold: reqBone,
        bonelessSold: reqBoneless,
        frySold: reqFry,
        currySold: reqCurry,
        mixedSold: reqMixed,
        cash: Number(cash) || 0,
        phonePe: Number(phonePe) || 0,
        total: grandTotalAmt,
        discountGiven: discountGivenVal,
      };

      await api.post(`/shops/${id}/sales`, payload);
      toast({ title: "Success", description: "Daily sales recorded successfully." });
      setBoneSold(""); setBonelessSold(""); setFrySold(""); setCurrySold(""); setMixedSold("");
      setCash(""); setPhonePe("");
      if (onSalesModalClose) onSalesModalClose();
      fetchData();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.response?.data?.message || "Failed to record sales.", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (deleteId: string) => {
    try {
      await api.delete(`/shops/${id}/sales/${deleteId}`);
      toast({ title: "Deleted", description: "Record removed" });
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  };

  const handleExport = () => {
    let filteredRecords = records;
    const now = new Date();
    
    if (exportRange === "Daily") {
      filteredRecords = records.filter(r => r.date === todayStr);
    } else if (exportRange === "Weekly") {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filteredRecords = records.filter(r => r.date >= pastWeek);
    } else if (exportRange === "Monthly") {
      const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      filteredRecords = records.filter(r => r.date >= pastMonth);
    } else if (exportRange === "Custom") {
      filteredRecords = records.filter(r => r.date >= exportStart && r.date <= exportEnd);
    }
    
    // Distinguish sales rows over production rows
    filteredRecords = filteredRecords.filter(r => !String(r.billId).startsWith("PREP"));

    if (exportFormat === "CSV") {
      const header = "Date,Bone(kg),Boneless(kg),Fry Sale,Curry Sale,Mixed Sale,Cash(Rs),PhonePe(Rs),Total(Rs),Bill Id\n";
      const rows = filteredRecords.map(r => 
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
      
      const rowsHtml = filteredRecords.map(r => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.date}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.boneSold}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.bonelessSold}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.frySold || 0}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.currySold || 0}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${r.mixedSold || 0}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${r.cash}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">₹${r.phonePe}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">₹${r.total}</td>
        </tr>
      `).join("");
      
      const html = `
        <html>
          <head>
            <title>${shopName} - Sales Report</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #333; }
              h1 { color: #B71C1C; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; font-size: 14px; }
              th { background: #f4f4f5; padding: 10px 8px; border-bottom: 2px solid #ddd; }
            </style>
          </head>
          <body>
            <h1>${shopName}</h1>
            <p><strong>Location:</strong> ${shopLocation}</p>
            <p><strong>Report Range:</strong> ${exportRange} ${exportRange === "Custom" ? `(${customStart} to ${customEnd})` : ""}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bone</th>
                  <th>Boneless</th>
                  <th>Fry</th>
                  <th>Curry</th>
                  <th>Mixed</th>
                  <th>Cash</th>
                  <th>PhonePe</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
            <script>
              window.onload = () => window.print();
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    }
    
    toast({ title: "Export Started", description: `Generating ${exportFormat} for ${exportRange}...` });
  };

  return (
    <div className="animate-fade-in">

      {/* KPI Dashboard - Top Section */}
      <div className="space-y-6 mb-8">
         {/* ROW 1: TOTAL AVAILABLE STOCK */}
         <div>
            <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Available Stock & Preparation</h3>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
              <StatCard title="Overall Total" value={`${totalStock} kg`} icon={null} />
              <StatCard title="Bone Avail" value={`${availBone} kg`} icon={null} />
              <StatCard title="Boneless Avail." value={`${availBoneless} kg`} icon={null} />
              <StatCard title="Mixed Avail." value={`${availMixed} kg`} icon={null} />
              <StatCard title="Fry Prep." value={`${availFry} kg`} icon={null} />
              <StatCard title="Curry Prep." value={`${availCurry} kg`} icon={null} />
            </div>
         </div>

         {/* ROW 2: TOTAL STOCK SOLD */}
         <div>
            <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Stock Sold</h3>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
              <StatCard title="Overall Total Sold" className="bg-card border-dashed" value={`${totalBoneSold + totalBonelessSold + totalMixedSold + totalFrySold + totalCurrySold} kg`} icon={null} />
              <StatCard title="Bone Sold" value={`${totalBoneSold} kg`} icon={null} />
              <StatCard title="Boneless Sold" value={`${totalBonelessSold} kg`} icon={null} />
              <StatCard title="Mixed Sold" value={`${totalMixedSold} kg`} icon={null} />
              <StatCard title="Fry Sold" value={`${totalFrySold} kg`} icon={null} />
              <StatCard title="Curry Sold" value={`${totalCurrySold} kg`} icon={null} />
            </div>
         </div>

         {/* ROW 3: TOTAL AMOUNT */}
         <div>
            <h3 className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">Total Sales Amount</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <StatCard title="Total Amount Received (₹)" value={`₹${(totalCash + totalPhonePe).toLocaleString("en-IN")}`} icon={null} />
              <StatCard title="Cash Received" value={`₹${totalCash.toLocaleString("en-IN")}`} icon={null} />
              <StatCard title="PhonePe Received" value={`₹${totalPhonePe.toLocaleString("en-IN")}`} icon={null} />
              <StatCard title="Discount Given" value={`₹${discountedAmount.toLocaleString("en-IN")}`} icon={null} />
            </div>
         </div>
      </div>

      {/* Entry Form — inline on main page */}
      <div className="rounded-sm border bg-card shadow-none mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3" style={{backgroundColor: 'var(--table-header)'}}>
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
                  { label: "Bone", val: boneSold, setter: setBoneSold, price: sellingCosts.bone, total: boneTotalAmt },
                  { label: "Boneless", val: bonelessSold, setter: setBonelessSold, price: sellingCosts.boneless, total: bonelessTotalAmt },
                  { label: "Fry", val: frySold, setter: setFrySold, price: sellingCosts.fry, total: fryTotalAmt },
                  { label: "Curry", val: currySold, setter: setCurrySold, price: sellingCosts.curry, total: curryTotalAmt },
                  { label: "Mixed", val: mixedSold, setter: setMixedSold, price: sellingCosts.mixed, total: mixedTotalAmt },
                ].map((item) => (
                  <div key={item.label} className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-6 p-3 lg:p-4 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <div className="space-y-1 lg:space-y-2">
                      <Label className="text-xs lg:text-lg font-semibold text-muted-foreground">{item.label} Sold</Label>
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
                      <Input readOnly className="h-10 lg:h-[56px] text-lg lg:text-2xl font-black border-2 border-info/30 text-info" value={item.total} style={{backgroundColor: 'var(--primary-light-bg)'}} />
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
                <div className="p-3 lg:p-6 rounded-sm border-2 border-info/20 shadow-none flex justify-between items-center relative overflow-hidden" style={{backgroundColor: 'var(--primary-light-bg)'}}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-info" />
                  <span className="font-bold text-info/80 justify-start pl-2 uppercase tracking-wide lg:tracking-widest text-xs lg:text-sm">Bill Total</span>
                  <span className="text-2xl lg:text-4xl font-black text-info flex items-center tracking-tight"><IndianRupee className="w-5 h-5 lg:w-8 lg:h-8 mr-1" />{grandTotalAmt.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:gap-6">
                  <div className="space-y-1 lg:space-y-2 p-3 lg:p-5 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <Label className="text-xs lg:text-lg font-semibold block mb-1 lg:mb-2 text-muted-foreground">Cash (₹)</Label>
                    <Input
                      type="number"
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                      placeholder="0"
                      className="h-10 lg:h-[60px] text-lg lg:text-3xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-2 lg:px-4 bg-background"
                    />
                  </div>
                  <div className="space-y-1 lg:space-y-2 p-3 lg:p-5 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <Label className="text-xs lg:text-lg font-semibold block mb-1 lg:mb-2 text-muted-foreground">PhonePe (₹)</Label>
                    <Input
                      type="number"
                      value={phonePe}
                      onChange={(e) => setPhonePe(e.target.value)}
                      placeholder="0"
                      className="h-10 lg:h-[60px] text-lg lg:text-3xl font-bold border-2 focus-visible:ring-primary focus-visible:border-primary px-2 lg:px-4 text-info bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-6">
                  <div className="p-3 lg:p-5 rounded-sm flex flex-col lg:flex-row justify-center lg:justify-between items-start lg:items-center shadow-none border-2 border-destructive badge-error">
                    <span className="font-extrabold uppercase tracking-widest text-[10px] lg:text-lg mb-1 lg:mb-0">Discount:</span>
                    <span className="text-lg lg:text-3xl font-black flex items-center"><IndianRupee className="w-4 h-4 lg:w-6 lg:h-6 mr-1" />{discountGivenVal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="p-3 lg:p-6 rounded-sm border-2 border-success/20 shadow-none flex flex-col lg:flex-row justify-center lg:justify-between items-start lg:items-center relative overflow-hidden bg-success/5 h-full">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-success" />
                    <span className="font-bold text-success/80 justify-start lg:pl-2 ml-2 lg:ml-0 uppercase tracking-wide lg:tracking-widest text-[10px] lg:text-sm mb-1 lg:mb-0">Amount Paid</span>
                    <span className="text-xl lg:text-4xl font-black text-success flex items-center tracking-tight ml-2 lg:ml-0"><IndianRupee className="w-4 h-4 lg:w-8 lg:h-8 mr-1" />{paymentTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:gap-6 mt-6 md:mt-10 pt-4 md:pt-6 border-t">
            <Button onClick={handleSaveSales} className="flex-1 h-12 md:h-[60px] text-lg md:text-xl bg-primary hover:bg-primary/80 font-bold text-white shadow-none">
              Save Sales Entry
            </Button>
          </div>
        </div>
      </div>

      {/* Sales Entry Modal */}
      <Dialog open={!!salesModalOpen} onOpenChange={(open) => !open && onSalesModalClose && onSalesModalClose()}>
        <DialogContent className="w-[97vw] max-w-2xl max-h-[92vh] overflow-y-auto p-0 [&>button]:hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b sticky top-0 bg-card z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full inline-block" />
                Daily Entry Form
              </DialogTitle>
              <button
                onClick={() => onSalesModalClose && onSalesModalClose()}
                className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-5">
            {/* Date */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-bold text-muted-foreground w-12 shrink-0">Date</Label>
              <Input 
                type="date" 
                value={salesDate} 
                onChange={(e) => setSalesDate(e.target.value)} 
                className="h-10 text-base font-bold border-2 focus-visible:ring-primary"
              />
            </div>

            {/* Section B - Sales */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b pb-2 mb-3">
                <Beef className="h-4 w-4" /> Section B — Sales
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Bone", val: boneSold, setter: setBoneSold, price: sellingCosts.bone, total: boneTotalAmt },
                  { label: "Boneless", val: bonelessSold, setter: setBonelessSold, price: sellingCosts.boneless, total: bonelessTotalAmt },
                  { label: "Fry", val: frySold, setter: setFrySold, price: sellingCosts.fry, total: fryTotalAmt },
                  { label: "Curry", val: currySold, setter: setCurrySold, price: sellingCosts.curry, total: curryTotalAmt },
                  { label: "Mixed", val: mixedSold, setter: setMixedSold, price: sellingCosts.mixed, total: mixedTotalAmt },
                ].map((item) => (
                  <div key={item.label} className="grid grid-cols-3 gap-2 p-3 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label} Sold (kg)</Label>
                      <Input 
                        ref={itemRefs[item.label] as any}
                        type="number" 
                        value={item.val} 
                        onChange={(e) => item.setter(e.target.value)} 
                        placeholder="0" 
                        className="h-11 text-lg font-bold border-2 focus-visible:ring-primary px-3"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price (₹/kg)</Label>
                      <Input readOnly className="h-11 bg-muted/30 font-bold border-2" value={item.price} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total (₹)</Label>
                      <Input readOnly className="h-11 text-lg font-black border-2 border-primary/20 text-primary" value={item.total.toLocaleString("en-IN")} style={{backgroundColor: 'var(--primary-light-bg)'}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section C - Payment */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 border-b pb-2 mb-3">
                <Wallet className="h-4 w-4" /> Section C — Payment
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-sm border-2 border-primary/20 flex justify-between items-center" style={{backgroundColor: 'var(--primary-light-bg)'}}>
                  <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Bill Total</span>
                  <span className="text-2xl font-black text-primary flex items-center"><IndianRupee className="w-5 h-5 mr-0.5" />{grandTotalAmt.toLocaleString("en-IN")}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 p-3 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cash (₹)</Label>
                    <Input type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" className="h-12 text-2xl font-bold border-2 focus-visible:ring-primary px-3" />
                  </div>
                  <div className="space-y-1 p-3 rounded-sm border border-border" style={{backgroundColor: 'var(--table-row-2)'}}>
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PhonePe (₹)</Label>
                    <Input type="number" value={phonePe} onChange={(e) => setPhonePe(e.target.value)} placeholder="0" className="h-12 text-2xl font-bold border-2 focus-visible:ring-primary px-3 text-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-sm border-2 border-destructive badge-error flex flex-col">
                    <span className="font-bold uppercase text-[10px] tracking-wider">Discount</span>
                    <span className="text-xl font-black flex items-center mt-1"><IndianRupee className="w-4 h-4 mr-0.5" />{discountGivenVal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="p-3 rounded-sm border-2 border-success/20 bg-success/5 flex flex-col">
                    <span className="font-bold uppercase text-[10px] tracking-wider text-success/80">Amount Paid</span>
                    <span className="text-xl font-black text-success flex items-center mt-1"><IndianRupee className="w-4 h-4 mr-0.5" />{paymentTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 sticky bottom-0 bg-card pt-3 border-t">
            <Button onClick={handleSaveSales} className="w-full h-12 text-base bg-primary hover:bg-primary/80 font-bold text-white shadow-none">
              Save Sales Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sales Log Table */}
      <div className="rounded-sm border bg-card shadow-none mb-8">
        <div className="px-6 py-4 border-b flex items-center border-border" style={{backgroundColor: 'var(--table-header)'}}>
          <h2 className="text-lg font-black text-foreground uppercase tracking-wide">Daily Sales Log</h2>
        </div>
        <div className="p-2 border-b">
          <DataTable
            isLoading={isLoading}
            columns={[
              { header: "Date", accessor: "date" },
              { header: "Bone (kg)", accessor: (r: OutRecord) => `${r.boneSold}` },
              { header: "Boneless (kg)", accessor: (r: OutRecord) => `${r.bonelessSold}` },
              { header: "Fry Sale (kg)", accessor: (r: OutRecord) => `${r.frySold || 0}` },
              { header: "Curry Sale (kg)", accessor: (r: OutRecord) => `${r.currySold || 0}` },
              { header: "Mixed Sale (kg)", accessor: (r: OutRecord) => `${r.mixedSold || 0}` },
              { header: "Total (₹)", accessor: (r: OutRecord) => `₹${r.total.toLocaleString("en-IN")}` },
              { header: "Discount (₹)", accessor: (r: OutRecord) => `₹${(r.discountGiven || 0).toLocaleString("en-IN")}` },
              { header: "Cash (₹)", accessor: (r: OutRecord) => `₹${r.cash.toLocaleString("en-IN")}` },
              { header: "PhonePe (₹)", accessor: (r: OutRecord) => `₹${r.phonePe.toLocaleString("en-IN")}` },
              { header: "Amount Paid (₹)", accessor: (r: OutRecord) => <strong className="text-primary">₹{(Number(r.cash || 0) + Number(r.phonePe || 0)).toLocaleString("en-IN")}</strong> },
              { 
                header: "Bill", 
                accessor: (r: OutRecord) => (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] uppercase font-bold border-primary text-primary hover:bg-primary hover:text-white"
                    onClick={() => setSelectedBill(r)}
                  >
                    <Receipt className="h-3 w-3 mr-1" /> {r.billId}
                  </Button>
                )
              },
              { 
                header: "Actions", 
                accessor: (r: OutRecord) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r._id || r.id || "")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )
              },
            ]}
            data={filteredRecords.filter((r) => !String(r.billId).startsWith("PREP"))}
            pageSize={10}
          />
        </div>
      </div>

      {/* Bill Preview Modal */}
      <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
        <DialogContent className="w-[95%] w-[95%] sm:max-w-[450px] p-0 overflow-hidden gap-0">
          <div className="bg-primary p-6 text-white flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">Pinaka Meat Shop</h2>
                <p className="text-[10px] opacity-80">Premium Quality Meat & Poultry</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest">Invoice</p>
              <p className="text-xl font-mono">{selectedBill?.billId}</p>
            </div>
          </div>
          
          <div className="p-8 bg-card">
            <div className="flex justify-between mb-8 text-sm">
              <div className="text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Bill To:</p>
                <p>Counter Sale</p>
                <p>Date: {selectedBill?.date}</p>
              </div>
              <div className="text-right text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Payment Status:</p>
                <p className="text-success font-bold uppercase">Paid via {selectedBill && (selectedBill.cash > 0 && selectedBill.phonePe > 0 ? "Mixed" : selectedBill.cash > 0 ? "Cash" : "PhonePe")}</p>
              </div>
            </div>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr className="border-b-2 border-primary/10">
                  <th className="text-left py-2 font-bold">Item</th>
                  <th className="text-center py-2 font-bold">Qty</th>
                  <th className="text-center py-2 font-bold">Rate</th>
                  <th className="text-right py-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { name: "Mutton Bone", sold: selectedBill?.boneSold, price: sellingCosts.bone },
                  { name: "Mutton Boneless", sold: selectedBill?.bonelessSold, price: sellingCosts.boneless },
                  { name: "Mutton Fry", sold: selectedBill?.frySold, price: sellingCosts.fry },
                  { name: "Mutton Curry", sold: selectedBill?.currySold, price: sellingCosts.curry },
                  { name: "Mutton Mixed", sold: selectedBill?.mixedSold, price: sellingCosts.mixed },
                ].map((item) => (
                  item.sold && item.sold > 0 ? (
                    <tr key={item.name}>
                      <td className="py-3">{item.name}</td>
                      <td className="text-center py-3">{item.sold} kg</td>
                      <td className="text-center py-3">₹{item.price}</td>
                      <td className="text-right py-3 font-medium">₹{(item.sold * item.price).toLocaleString("en-IN")}</td>
                    </tr>
                  ) : null
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-primary/10">
                  <td colSpan={3} className="pt-4 pb-1 text-right font-bold uppercase text-[10px] tracking-wider text-muted-foreground">Subtotal</td>
                  <td className="pt-4 pb-1 text-right font-bold text-lg text-foreground">₹{selectedBill?.total.toLocaleString("en-IN")}</td>
                </tr>
                {selectedBill && selectedBill.discountGiven !== undefined && selectedBill.discountGiven > 0 && (
                  <tr>
                    <td colSpan={3} className="pb-1 text-right font-bold uppercase text-[10px] tracking-wider text-destructive">Discount Given</td>
                    <td className="pb-1 text-right font-bold text-md text-destructive">-₹{selectedBill.discountGiven.toLocaleString("en-IN")}</td>
                  </tr>
                )}
                <tr className="border-t border-dashed">
                  <td colSpan={3} className="pt-2 pb-1 text-right font-bold uppercase text-[12px] tracking-wider text-muted-foreground">Amount Paid</td>
                  <td className="pt-2 pb-1 text-right font-black text-xl text-primary">₹{((selectedBill?.cash || 0) + (selectedBill?.phonePe || 0)).toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pb-4 text-right text-[10px] text-muted-foreground flex items-center justify-end gap-2">
                    {selectedBill && selectedBill.cash > 0 && <span>Cash: ₹{selectedBill.cash.toLocaleString("en-IN")}</span>}
                    {selectedBill && selectedBill.phonePe > 0 && <span>PhonePe: ₹{selectedBill.phonePe.toLocaleString("en-IN")}</span>}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <div className="bg-secondary/20 p-4 rounded-sm text-center border-dashed border">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Support & Feedback</p>
              <p className="text-xs font-medium">+91-9876543210 | pinaka.meat@gmail.com</p>
            </div>
          </div>
          
          <DialogFooter className="p-4 bg-muted/30 border-t flex justify-between items-center">
            <p className="text-[10px] text-muted-foreground italic">Thank you for shopping with Pinaka!</p>
            <Button variant="outline" size="sm" onClick={() => setSelectedBill(null)} className="h-8">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Error Modal */}
      <Dialog open={!!stockError} onOpenChange={(open) => !open && setStockError(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              ⚠️ Insufficient Stock
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-foreground text-base">Not enough <strong className="text-primary">{stockError?.item}</strong> stock available.</p>
            <div className="bg-muted p-4 rounded-md space-y-2 border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Available:</span>
                <span className="font-bold text-lg">{stockError?.available.toFixed(2)} <span className="text-xs">kg</span></span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-semibold">Requested:</span>
                <span className="text-destructive font-bold text-lg">{stockError?.requested.toFixed(2)} <span className="text-xs">kg</span></span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Please adjust the quantity to continue.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button 
              className="w-full bg-[#FF6B00] hover:bg-[#FF6B00]/90 text-white font-bold h-12 text-lg"
              onClick={() => {
                const field = stockError?.field;
                setStockError(null);
                if (field && itemRefs[field]?.current) {
                  setTimeout(() => itemRefs[field].current?.focus(), 100);
                }
              }}
            >
              Fix Quantity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

