import { useState, useEffect, useMemo } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/ui/month-picker";
import { downloadSupplyPDF } from "@/utils/exportSupply";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
export default function Supply() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState<"Today" | "This Week" | "Select Month" | "Custom">("Select Month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [inventoryIn, setInventoryIn] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [shopsList, setShopsList] = useState<any[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [invRes, shopRes, supplyRes] = await Promise.all([
        api.get("/central-inventory"),
        api.get("/shops"),
        api.get("/supplies")
      ]);
      setInventoryIn(invRes.data.data || []);
      setShopsList(shopRes.data.data || []);
      
      const mappedSupplies = (supplyRes.data.data || []).map((s: any) => ({
        ...s,
        shopNo: s.shopId ? s.shopId.name : `Others (${s.externalRecipient?.name || ''} - ${s.externalRecipient?.address || ''})`
      }));
      setRecords(mappedSupplies);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { filteredInvIn, filteredRecords } = useMemo(() => {
    let from = "";
    let to = "";
    const now = new Date();
    
    const formatLocalStr = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (dateRange === "Today") {
      from = formatLocalStr(now);
      to = from;
    } else if (dateRange === "This Week") {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      from = formatLocalStr(weekAgo);
      to = formatLocalStr(now);
    } else if (dateRange === "Select Month") {
      const [yr, mo] = selectedMonth.split("-").map(Number);
      from = `${yr}-${String(mo).padStart(2, "0")}-01`;
      const lastDay = new Date(yr, mo, 0).getDate();
      to = `${yr}-${String(mo).padStart(2, "0")}-${lastDay}`;
    } else if (dateRange === "Custom") {
      from = customStart;
      to = customEnd;
    }

    if (!from || !to) return { filteredInvIn: inventoryIn, filteredRecords: records };

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const checkDate = (dStr: string) => {
        if (!dStr) return false;
        const d = new Date(dStr);
        return d >= fromDate && d <= toDate;
    };

    return {
       filteredInvIn: inventoryIn.filter(r => checkDate(r.date)),
       filteredRecords: records.filter(r => checkDate(r.date))
    };
  }, [inventoryIn, records, dateRange, customStart, customEnd]);

  const handleExportPDF = () => {
    const periodStr = dateRange === "Custom" ? `${customStart} to ${customEnd}` : dateRange;
    downloadSupplyPDF(filteredInvIn, filteredRecords, "detailed", periodStr);
  };

  const [shopNo, setShopNo] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherAddress, setOtherAddress] = useState("");

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingSupply, setPendingSupply] = useState<any>(null);
  const [stockConflict, setStockConflict] = useState<any>(null);

  const [batch, setBatch] = useState("");
  const [mixed, setMixed] = useState("");
  const [bone, setBone] = useState("");
  const [boneless, setBoneless] = useState("");
  const [bonePrice, setBonePrice] = useState("");
  const [bonelessPrice, setBonelessPrice] = useState("");
  const [mixedPrice, setMixedPrice] = useState("");
  const [extra, setExtra] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const total = (Number(mixed) || 0) + (Number(bone) || 0) + (Number(boneless) || 0);

  const selectedBatch = inventoryIn.find(i => (i.batchNo || i.batch) === batch);
  
  const nMixed = Number(mixed) || 0;
  const nBone = Number(bone) || 0;
  const nBoneless = Number(boneless) || 0;
  const nExtra = Number(extra) || 0;
  
  const calculatedTotalAmount = (nMixed * (Number(mixedPrice) || 0)) + (nBone * (Number(bonePrice) || 0)) + (nBoneless * (Number(bonelessPrice) || 0));
  const finalTotalAmount = calculatedTotalAmount + nExtra;

  const handleSave = async (overrideFlag = false) => {
    const newErrors: { [key: string]: string } = {};

    if (!shopNo) newErrors.shopNo = "Please select a shop";
    if (shopNo === "Others") {
      if (!otherName) newErrors.otherName = "Please enter shop name";
      if (!otherAddress) newErrors.otherAddress = "Please enter full address";
    }
    if (!batch) newErrors.batch = "Please select a batch";
    if (total <= 0) newErrors.quantities = "Enter at least one quantity";

    if (nBone > 0 && (Number(bonePrice) || 0) <= 0) newErrors.boneField = "Please enter price for Bone";
    if (nBoneless > 0 && (Number(bonelessPrice) || 0) <= 0) newErrors.bonelessField = "Please enter price for Boneless";
    if (nMixed > 0 && (Number(mixedPrice) || 0) <= 0) newErrors.mixedField = "Please enter price for Mixed";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "Missing Information", description: "Please complete required fields to continue.", variant: "destructive" });
      
      const firstErrorKey = Object.keys(newErrors)[0];
      const element = document.getElementById(`supply-field-${firstErrorKey}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus();
      }
      return;
    }

    setErrors({});

    const payload = {
      shopId: shopNo !== "Others" ? shopNo : null,
      externalRecipient: shopNo === "Others" ? { name: otherName, address: otherAddress } : undefined,
      batch: batch,
      bone: nBone,
      boneless: nBoneless,
      mixed: nMixed,
      bonePrice: Number(bonePrice) || 0,
      bonelessPrice: Number(bonelessPrice) || 0,
      mixedPrice: Number(mixedPrice) || 0,
      extra: nExtra,
      overrideFlag,
      date: new Date().toISOString().split("T")[0],
      totalAmount: finalTotalAmount,
      total: finalTotalAmount
    };

    try {
      if (editingRecordId) {
        await api.put(`/supplies/${editingRecordId}`, payload);
        toast({ title: "Updated", description: "Supply record updated." });
        setEditingRecordId(null);
      } else {
        await api.post("/supplies", payload);
        toast({ title: "Saved", description: "Supply record added and synced to exact shop!" });
      }
      
      setShopNo(""); setBatch(""); setMixed(""); setBone(""); setBoneless(""); setExtra(""); setOtherName(""); setOtherAddress("");
      setBonePrice(""); setBonelessPrice(""); setMixedPrice("");
      fetchData();
    } catch (err: any) {
      if (err.response?.data?.canOverride) {
        const available = err.response.data.available || { mixed: 0 };
        const required = err.response.data.required || err.response.data.requiredDelta || { total: total };
        
        setPendingSupply(payload);
        setStockConflict({ available, required });
        
        const newErrs = { ...errors };
        if (required.total > available.mixed) newErrs.quantities = `Combined quantity exceeds available mixed stock (${available.mixed} kg)`;
        
        setErrors(newErrs);
        setShowOverrideModal(true);
      } else {
        toast({ title: "Error", description: err.response?.data?.message || "Failed to supply inventory.", variant: "destructive" });
      }
    }
  };

  const startEditOut = (r: any) => {
    setEditingRecordId(r._id);
    const foundShop = shopsList.find(s => s.name === r.shopNo || s._id === r.shopNo || (r.shopId && s._id === r.shopId._id));
    if (foundShop) {
      setShopNo(foundShop._id);
    } else if (r.shopNo.startsWith("Others")) {
      setShopNo("Others");
      const match = r.shopNo.match(/Others \((.*) - (.*)\)/);
      if (match) {
        setOtherName(match[1]);
        setOtherAddress(match[2]);
      } else if (r.externalRecipient) {
        setOtherName(r.externalRecipient.name);
        setOtherAddress(r.externalRecipient.address);
      }
    }
    setBatch(r.batch);
    setMixed(r.mixed?.toString() || "0");
    setBone(r.bone?.toString() || "0");
    setBoneless(r.boneless?.toString() || "0");
    setBonePrice(r.bonePrice?.toString() || "0");
    setBonelessPrice(r.bonelessPrice?.toString() || "0");
    setMixedPrice(r.mixedPrice?.toString() || "0");
    setExtra(r.extra?.toString() || "0");
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteOut = async (r: any) => {
    try {
      await api.delete(`/supplies/${r._id}`);
      toast({ title: "Restored", description: "Supply deleted and stock moved to Central Inventory." });
      fetchData();
      setRecordToDelete(null);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Breadcrumb items={[{ label: "Inventory & Supply" }]} />
            <h1 className="text-3xl font-black text-foreground tracking-tight mt-2">Inventory & Supply Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Manage packed meat inventory and shop supplies efficiently.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 justify-end self-end sm:self-auto">
            <div className="flex flex-wrap items-center gap-2 bg-primary/5 rounded-md p-1 border border-primary/10 w-fit">
              {(["Today", "This Week", "Select Month", "Custom"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setDateRange(t as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-sm text-sm font-bold transition-all whitespace-nowrap",
                    dateRange === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
                  )}
                >{t}</button>
              ))}
            </div>

            {dateRange === "Select Month" && (
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            )}

            {dateRange === "Custom" && (
              <div className="flex items-center gap-2 bg-card border rounded-sm px-3 py-1">
                <AdvancedDatePicker value={customStart} onChange={setCustomStart} placeholder="Start" />
                <span className="text-muted-foreground font-bold">–</span>
                <AdvancedDatePicker value={customEnd} onChange={setCustomEnd} placeholder="End" />
              </div>
            )}

            <Button 
              onClick={handleExportPDF}
              className="bg-red-500 hover:bg-red-600 text-white rounded-sm h-9 px-3 text-xs font-bold uppercase tracking-wider"
            >
              PDF Export
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col h-[60vh] items-center justify-center p-12 text-center text-muted-foreground w-full">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Inventory...</h2>
        </div>
      ) : (
      <>
        <div className="rounded-sm border bg-card p-6 shadow-none mb-8">
          <h2 className="text-lg font-semibold mb-4">Inventory In (Packed Meat)</h2>
          <DataTable
          columns={[
            { header: "Date", accessor: "date" },
            { header: "Batch", accessor: (r: any) => r.batchNo || r.batch || "-" },
            { header: "Mixed (kg)", accessor: (r: any) => `${r.mixed?.qty || r.mixed || 0}` },
            { header: "1 kg Price (₹)", accessor: (r: any) => {
              const weight = r.totalWeight || r.total_weight || r.total || 0;
              const amount = r.totalAmount || r.total_amount || 0;
              const unitPrice = weight > 0 ? (amount / weight) : 0;
              return `₹${Math.round(unitPrice).toLocaleString("en-IN")}`;
            }},
            { header: "Total Weight (kg)", accessor: (r) => r.totalWeight || r.total_weight || r.total || 0 },
            { header: "Total Amount (₹)", accessor: (r) => (r.totalAmount || r.total_amount) ? `₹${(r.totalAmount || r.total_amount).toLocaleString("en-IN")}` : "-" },
            { header: "Status", accessor: (r) => {
              const weight = r.totalWeight || r.total || 0;
              return (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                weight > 0 ? "badge-success" : "bg-muted text-muted-foreground"
              }`}>
                {weight > 0 ? "Available" : "Empty"}
              </span>
            )}},
          ]}
          data={filteredInvIn}
          isLoading={isLoading}
        />
      </div>

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
          <div className="bg-background rounded-sm shadow-none border w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Insufficient Stock</h3>
            <p className="text-muted-foreground mb-4">
              Not enough stock to complete this supply.
            </p>

            {stockConflict && (
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm bg-muted/30 p-4 border rounded-sm">
                <div>
                  <p className="font-bold text-foreground mb-2 underline decoration-muted-foreground underline-offset-4">Available:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Total Mixed Batch Pool: <span className="font-semibold text-foreground">{stockConflict.available.mixed} kg</span></li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-destructive mb-2 underline decoration-destructive/50 underline-offset-4">Requested (Combined):</p>
                  <ul className="space-y-1 text-destructive font-medium">
                    <li>• Total Quantity: {stockConflict.required.total} kg</li>
                  </ul>
                </div>
              </div>
            )}

            <p className="font-medium text-sm text-foreground mb-6">
              Please reduce the quantity and try again.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold" onClick={() => setShowOverrideModal(false)}>
                Adjust Quantity
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-sm border bg-card p-6 shadow-none mb-8">
        <h2 className="text-lg font-semibold mb-4">Record Supply (To Shop)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Shop Number</Label>
            <select id="supply-field-shopNo" className={`flex h-10 w-full rounded-sm border ${errors.shopNo ? "border-destructive ring-1 ring-destructive" : "border-input"} bg-background px-3 py-2 text-sm`} value={shopNo} onChange={(e) => { setShopNo(e.target.value); setErrors(prev => ({...prev, shopNo: ""})); }}>
              <option value="" className="bg-background text-foreground">Select Shop</option>
              {shopsList.map((s) => (
                <option key={s._id} value={s._id} className="bg-background text-foreground">{s.name}</option>
              ))}
              <option value="Others" className="bg-background text-foreground">Others</option>
            </select>
            {errors.shopNo && <p className="text-xs text-destructive mt-1">{errors.shopNo}</p>}
          </div>
          {shopNo === "Others" && (
            <>
              <div>
                <Label>Shop Name</Label>
                <Input id="supply-field-otherName" value={otherName} onChange={(e) => { setOtherName(e.target.value); setErrors(prev => ({...prev, otherName: ""})); }} placeholder="Enter shop name" className={errors.otherName ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.otherName && <p className="text-xs text-destructive mt-1">{errors.otherName}</p>}
              </div>
              <div>
                <Label>Address</Label>
                <Input id="supply-field-otherAddress" value={otherAddress} onChange={(e) => { setOtherAddress(e.target.value); setErrors(prev => ({...prev, otherAddress: ""})); }} placeholder="Enter full address" className={errors.otherAddress ? "border-destructive ring-1 ring-destructive" : ""} />
                {errors.otherAddress && <p className="text-xs text-destructive mt-1">{errors.otherAddress}</p>}
              </div>
            </>
          )}
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="batch">Batch Number</Label>
            <select id="batch" className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm" value={batch} onChange={(e) => {
              const selectedBatchNo = e.target.value;
              setBatch(selectedBatchNo);
              const found = inventoryIn.find(i => (i.batchNo || i.batch) === selectedBatchNo);
              if (found) {
                setBonePrice(found.bone?.pricePerKg?.toString() || "0");
                setBonelessPrice(found.boneless?.pricePerKg?.toString() || "0");
                setMixedPrice(found.mixed?.pricePerKg?.toString() || "0");
              } else {
                setBonePrice("0"); setBonelessPrice("0"); setMixedPrice("0");
              }
            }}>
              <option value="">Select Batch</option>
              {inventoryIn.map(i => (
                <option key={i._id} value={i.batchNo || i.batch}>{i.batchNo || i.batch}</option>
              ))}
            </select>
            {errors.batch && <p className="text-xs text-destructive">{errors.batch}</p>}
          </div>
          <div><Label>Date</Label><Input type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
          
          <div className="space-y-1.5">
            <Label htmlFor="mixed">Mixed (kg) & Price (₹)</Label>
            <div className="flex gap-2">
              <Input id="mixed" type="number" min="0" value={mixed} onChange={(e) => setMixed(e.target.value)} placeholder="Qty" className={errors.mixedField ? "border-destructive" : ""} />
              <Input type="number" min="0" value={mixedPrice} onChange={(e) => setMixedPrice(e.target.value)} placeholder="Price/kg" />
            </div>
            {errors.mixedField && <p className="text-xs text-destructive font-medium">{errors.mixedField}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bone">Bone (kg) & Price (₹)</Label>
            <div className="flex gap-2">
              <Input id="bone" type="number" min="0" value={bone} onChange={(e) => setBone(e.target.value)} placeholder="Qty" className={errors.boneField ? "border-destructive" : ""} />
              <Input type="number" min="0" value={bonePrice} onChange={(e) => setBonePrice(e.target.value)} placeholder="Price/kg" />
            </div>
            {errors.boneField && <p className="text-xs text-destructive font-medium">{errors.boneField}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="boneless">Boneless (kg) & Price (₹)</Label>
            <div className="flex gap-2">
              <Input id="boneless" type="number" min="0" value={boneless} onChange={(e) => setBoneless(e.target.value)} placeholder="Qty" className={errors.bonelessField ? "border-destructive" : ""} />
              <Input type="number" min="0" value={bonelessPrice} onChange={(e) => setBonelessPrice(e.target.value)} placeholder="Price/kg" />
            </div>
            {errors.bonelessField && <p className="text-xs text-destructive font-medium">{errors.bonelessField}</p>}
          </div>
          
          <div><Label>Extra Money (₹)</Label><Input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Optional" /></div>
        </div>
        
        <div className="mt-4 p-4 bg-muted/30 border rounded-sm">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span>Calculated Amount by Packaging:</span>
            <span>₹{calculatedTotalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between items-center mb-2 text-sm">
            <span>Extra Money:</span>
            <span>₹{nExtra.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between items-center font-bold text-lg border-t pt-2 border-border/50">
            <span>Total Weight: {total} kg</span>
            <span>Total Amount: ₹{finalTotalAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <div className="flex-1 flex flex-col gap-2">
            {Object.keys(errors).length > 0 && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 border border-destructive/20 p-2 text-center rounded-sm">
                ⚠ Please complete required fields
              </div>
            )}
            <Button className="bg-primary hover:bg-primary/80 text-primary-foreground tracking-wide w-full" onClick={() => handleSave(false)}>
              {editingRecordId ? "Update Record" : "Supply to Shop / Sync to Shop Inventory"}
            </Button>
          </div>
          {editingRecordId && (
            <Button variant="outline" className="flex-1 text-muted-foreground hover:bg-accent" onClick={() => {
              setEditingRecordId(null);
              setShopNo(""); setBatch(""); setMixed(""); setBone(""); setBoneless(""); setExtra("");
              setBonePrice(""); setBonelessPrice(""); setMixedPrice("");
              setErrors({});
            }}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-sm border bg-card p-6 shadow-none">
        <h2 className="text-lg font-semibold mb-4">Inventory Out</h2>
        <DataTable
          columns={[
            { header: "Date", accessor: "date" },
            { header: "Shop No", accessor: "shopNo" },
            { header: "Batch", accessor: (r: any) => r.batchNo || r.batch || "-" },
            { header: "Bone (kg)", accessor: (r) => `${r.bone}` },
            { header: "Boneless (kg)", accessor: (r) => `${r.boneless}` },
            { header: "Mixed (kg)", accessor: (r) => `${r.mixed}` },
            { header: "Total Wt.", accessor: (r) => `${(r.bone || 0) + (r.boneless || 0) + (r.mixed || 0)} kg` },
            { header: "Calculated Amount", accessor: (r) => `₹${(r.totalAmount - (r.extra || 0)).toLocaleString("en-IN")}` },
            { header: "Extra (₹)", accessor: (r) => r.extra ? `+₹${r.extra}` : "-" },
            { header: "Grand Total", accessor: (r) => <span className="font-bold text-primary">₹{r.totalAmount.toLocaleString("en-IN")}</span> },
            { header: "Actions", accessor: (r) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditOut(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRecordToDelete(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )},
          ]}
          data={filteredRecords}
          isLoading={isLoading}
        />
      </div>

      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
          <div className="bg-background rounded-sm shadow-none border w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-2">Delete & Move to Inventory</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this supply to <strong>{recordToDelete.shopNo}</strong>? The packed stock ({recordToDelete.total} kg) will be moved back to the original batch in Inventory In.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRecordToDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDeleteOut(recordToDelete)}>Move to Inventory</Button>
            </div>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
}
