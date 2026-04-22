import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, ArrowLeft, Loader2, FileDown, ChevronDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdvancedDatePicker } from "@/components/ui/advanced-date-picker";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { MonthPicker } from "@/components/ui/month-picker";
import { downloadDressingPDF } from "@/utils/exportDressing";

const defaultPackaging = [
  { name: "Mixed", price: 380 },
];

export default function Dressing() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRange, setDateRange] = useState<"Today" | "This Week" | "Select Month" | "Custom">("Select Month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/batches");
      // Map batchNo to batch for backwards compatibility with the UI
      const fetchedRecords = (res.data.data || []).map((r: any) => ({
        ...r,
        batch: r.batchNo
      }));
      setRecords(fetchedRecords);
    } catch (err) {
      console.error("Failed to load batches", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRecords = useMemo(() => {
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

    if (!from || !to) return records;

    // We do simple string comparison for dates or construct full dates
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    return records.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= fromDate && d <= toDate;
    });
  }, [records, dateRange, customStart, customEnd]);

  // ── Export State ──────────────────────────────────────────────────
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<"all" | "specific">("all");
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const allBatchNos = useMemo(() =>
    [...new Set(filteredRecords.map((r: any) => r.batchNo || r.batch).filter(Boolean))]
  , [filteredRecords]);

  const toggleBatch = (b: string) =>
    setSelectedBatches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const handleExportPDF = () => {
    const periodStr = dateRange === "Custom" ? `${customStart} to ${customEnd}` : dateRange;
    const exportRecords = batchMode === "all"
      ? filteredRecords
      : filteredRecords.filter((r: any) => selectedBatches.includes(r.batchNo || r.batch));
    if (exportRecords.length === 0) return;
    downloadDressingPDF(exportRecords, "detailed", periodStr);
    setIsExportOpen(false);
  };

  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const handleEditClick = (r: any) => {
    setEditingBatch(r.batch);
    setEditingId(r._id);
    setEditForm({ ...r, pkgItems: r.pkgItems || { mixed: { qty: 0, pricePerKg: 0 } } });
  };

  const handleEditField = (field: string, val: any) => {
    const next = { ...editForm, [field]: val };
    if (['head', 'ribs', 'ham', 'offals'].includes(field)) {
      const hc = Number(next.head) || 0;
      const rc = Number(next.ribs) || 0;
      const hmc = Number(next.ham) || 0;
      const oc = Number(next.offals) || 0;
      const tCarcass = hc + rc + hmc + oc;
      const wst = hc + oc;
      const wstPct = tCarcass > 0 ? ((wst / tCarcass) * 100).toFixed(1) : "0";
      next.totalWeight = tCarcass;
      next.usableMeat = tCarcass - wst;
      next.wastagePercent = Number(wstPct);
    }
    if (['animalWeight', 'rate'].includes(field)) {
      next.cost = Math.round((Number(next.animalWeight) || 0) * (Number(next.rate) || 0));
    }
    setEditForm(next);
  };

  const handleEditPkg = (item: string, val: any) => {
    setEditForm({
      ...editForm,
      pkgItems: {
        ...editForm.pkgItems,
        [item]: {
          qty: Number(val.qty) || 0,
          pricePerKg: Number(val.pricePerKg) || 0
        }
      }
    });
  };

  const handleEditSave = async () => {
    try {
      await api.put(`/batches/${editingId}`, editForm);
      toast({ title: "Updated", description: "Record updated successfully!" });
      setEditingBatch(null);
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error("Failed to update record", err);
      toast({ title: "Error", description: "Failed to update record", variant: "destructive" });
    }
  };

  // Before slaughter form
  const [animalId, setAnimalId] = useState("");
  const [animalWeight, setAnimalWeight] = useState("");
  const [rate, setRate] = useState("");
  const [cost, setCost] = useState("");
  const [farmLocation, setFarmLocation] = useState("");

  const handleWeightChange = (val: string) => {
    setAnimalWeight(val);
    if (rate && val) {
      setCost(Math.round(Number(rate) * Number(val)).toString());
    }
  };

  const handleRateChange = (val: string) => {
    setRate(val);
    if (val && animalWeight) {
      setCost(Math.round(Number(val) * Number(animalWeight)).toString());
    }
  };

  // After slaughter form
  const [linkedAnimal, setLinkedAnimal] = useState("");
  const [head, setHead] = useState("");
  const [ribs, setRibs] = useState("");
  const [ham, setHam] = useState("");
  const [offals, setOffals] = useState("");
  const [packagingBatch, setPackagingBatch] = useState<string | null>(null);
  const [packagingId, setPackagingId] = useState<string | null>(null);

  // Packaging
  const [pkgItems, setPkgItems] = useState(
    defaultPackaging.map(p => ({ qty: 0, price: p.price }))
  );

  const selectedRecord: any = records.find(r => r._id === linkedAnimal);
  const animalWeightBSW = selectedRecord?.animalWeight || 0;

  const totalCarcass = (Number(head) || 0) + (Number(ribs) || 0) + (Number(ham) || 0) + (Number(offals) || 0);
  const slaughterLoss = animalWeightBSW > 0 ? animalWeightBSW - totalCarcass : 0;
  const carcassWaste = (Number(head) || 0) + (Number(offals) || 0);
  const totalWastage = slaughterLoss + carcassWaste;
  const wastagePercent = animalWeightBSW > 0 ? ((totalWastage / animalWeightBSW) * 100).toFixed(2) : "0.00";
  const usableMeat = totalCarcass - carcassWaste;

  const totalCost = selectedRecord?.cost || 0;
  const costPerKg = (totalCost > 0 && usableMeat > 0) ? (totalCost / usableMeat).toFixed(2) : "0.00";

  const nextBatch = "Auto-generated";
  const [afterSlaughterErrors, setAfterSlaughterErrors] = useState<any>({});

  const handleSaveBefore = async () => {
    if (!animalId || !animalWeight) {
      toast({ title: "Missing Details", description: "Please fill in all required fields to register the animal.", variant: "destructive" });
      return;
    }
    const newRecord = {
      animalId,
      date: new Date().toISOString().split("T")[0],
      animalWeight: Number(animalWeight) || 0,
      cost: Number(cost) || 0,
      rate: Number(rate) || 0,
      farmLocation,
    };

    try {
      await api.post("/batches", newRecord);
      toast({ title: "Saved", description: `Animal ${animalId} recorded successfully` });
      setAnimalId("");
      setAnimalWeight("");
      setRate("");
      setCost("");
      setFarmLocation("");
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not save record", variant: "destructive" });
    }
  };

  const handleSaveAfter = async () => {
    const errors: any = {};
    let hasError = false;
    let missingWeight = false;

    if (!linkedAnimal) {
      errors.linkedAnimal = true;
      hasError = true;
    }

    if (!head || head === "") { errors.head = true; missingWeight = true; hasError = true; }
    if (!ribs || ribs === "") { errors.ribs = true; missingWeight = true; hasError = true; }
    if (!ham || ham === "") { errors.ham = true; missingWeight = true; hasError = true; }
    if (!offals || offals === "") { errors.offals = true; missingWeight = true; hasError = true; }

    setAfterSlaughterErrors(errors);

    if (hasError) {
      if (!linkedAnimal) {
        toast({ title: "Animal Required", description: "Please select an animal to continue.", variant: "destructive" });
      } else if (missingWeight) {
        toast({ title: "Missing Details", description: "Please enter all required weight fields (Head, Ribs, Ham, Offals).", variant: "destructive" });
      }
      return;
    }

    try {
      await api.put(`/batches/${linkedAnimal}`, {
        totalWeight: totalCarcass,
        usableMeat,
        wastagePercent: Number(wastagePercent),
        status: "Slaughtered",
        head: Number(head) || 0,
        ribs: Number(ribs) || 0,
        ham: Number(ham) || 0,
        offals: Number(offals) || 0,
      });

      const updatedRecord = records.find(r => r._id === linkedAnimal);
      const batchName = updatedRecord?.batchNo || updatedRecord?.batch || "Unknown";

      toast({ title: "Saved", description: `Saved successfully. Continue with packaging below.` });

      // Automatically open packaging
      setPackagingBatch(batchName);
      setPackagingId(linkedAnimal);

      // Clear fields
      setLinkedAnimal("");
      setHead("");
      setRibs("");
      setHam("");
      setOffals("");
      setAfterSlaughterErrors({});
      fetchData();

      setTimeout(() => {
        document.getElementById("packaging-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update record", variant: "destructive" });
    }
  };

  const handleMoveToInventory = async () => {
    if (packagingBatch && packagingId) {
      const pRecord = records.find(r => r.batch === packagingBatch);
      const packagingUsableMeat = pRecord && pRecord.usableMeat && pRecord.usableMeat !== "-" ? Number(pRecord.usableMeat) : 0;
      const totalQty = pkgItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      
      if (packagingUsableMeat > 0 && totalQty > packagingUsableMeat) {
        toast({
          title: "Packaging exceeds available meat.",
          description: (
            <div className="mt-1 flex flex-col gap-1">
              <div>Usable Meat: {packagingUsableMeat} kg</div>
              <div>Entered: {totalQty} kg</div>
              <div className="mt-2 text-sm font-medium">Please adjust quantities.</div>
            </div>
          ),
          variant: "destructive"
        });
        return;
      }

      const packagingData = {
        mixed: { qty: pkgItems[0].qty, pricePerKg: pkgItems[0].price },
      };

      try {
        await api.put(`/batches/${packagingId}/packaging`, { pkgItems: packagingData });
        toast({ title: "Moved to Inventory", description: "All packets added to inventory successfully!" });
        setPackagingBatch(null);
        setPackagingId(null);
        setPkgItems(defaultPackaging.map(p => ({ qty: 0, price: p.price })));
        setLinkedAnimal("");
        setHead("");
        setRibs("");
        setHam("");
        setOffals("");
        fetchData();
        navigate("/supply");
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to move to inventory", variant: "destructive" });
      }
    }
  };

  const handleSavePackaging = async () => {
    if (packagingBatch && packagingId) {
      const pRecord = records.find(r => r.batch === packagingBatch);
      const packagingUsableMeat = pRecord && pRecord.usableMeat && pRecord.usableMeat !== "-" ? Number(pRecord.usableMeat) : 0;
      const totalQty = pkgItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      
      if (packagingUsableMeat > 0 && totalQty > packagingUsableMeat) {
        toast({
          title: "Packaging exceeds available meat.",
          description: (
            <div className="mt-1 flex flex-col gap-1">
              <div>Usable Meat: {packagingUsableMeat} kg</div>
              <div>Entered: {totalQty} kg</div>
              <div className="mt-2 text-sm font-medium">Please adjust quantities.</div>
            </div>
          ),
          variant: "destructive"
        });
        return;
      }

      const packagingData = {
        pkgItems: {
          mixed: { qty: pkgItems[0].qty, pricePerKg: pkgItems[0].price },
        }
      };

      try {
        // Use /packaging endpoint so CentralInventory is also updated
        await api.put(`/batches/${packagingId}/packaging`, packagingData);
        toast({ title: "Packaging Saved", description: `Packaging data saved for ${packagingBatch}` });
        setPackagingBatch(null);
        setPackagingId(null);
        setPkgItems(defaultPackaging.map(p => ({ qty: 0, price: p.price })));
        fetchData();
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to save packaging", variant: "destructive" });
      }
    }
  };

  const handleDelete = async (id: string, batchNo: string) => {
    try {
      await api.delete(`/batches/${id}`);
      toast({ title: "Deleted", description: `Record ${batchNo} deleted` });
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" });
    }
  };

  const grandTotal = pkgItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const totalQty = pkgItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const pRecord = records.find(r => r.batch === packagingBatch);
  const packagingUsableMeat = pRecord && pRecord.usableMeat && pRecord.usableMeat !== "-" ? Number(pRecord.usableMeat) : 0;
  const isExceeded = packagingUsableMeat > 0 && totalQty > packagingUsableMeat;

  const animalOptions = records.filter(r => r.status === "Unslaughtered");

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Breadcrumb items={[{ label: "Dressing" }]} />
            <h1 className="text-3xl font-black text-foreground tracking-tight mt-2">Dressing Management</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Manage before and after slaughter processes and yields.</p>
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
                >
                  {t}
                </button>
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
              onClick={() => { setBatchMode("all"); setSelectedBatches([]); setIsExportOpen(true); }}
              className="bg-red-500 hover:bg-red-600 text-white rounded-sm h-9 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF Export
            </Button>

            {/* ── Export Options Dialog ───────────────────────────── */}
            <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <FileDown className="h-4 w-4 text-red-500" /> Export Dressing PDF
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Batch Mode Toggle */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Batch Selection</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setBatchMode("all"); setSelectedBatches([]); }}
                        className={`h-10 rounded-sm border-2 text-sm font-bold transition-all ${
                          batchMode === "all"
                            ? "border-red-500 bg-red-50 text-red-600"
                            : "border-border text-muted-foreground hover:border-red-300"
                        }`}
                      >
                        All Batches
                      </button>
                      <button
                        onClick={() => setBatchMode("specific")}
                        className={`h-10 rounded-sm border-2 text-sm font-bold transition-all ${
                          batchMode === "specific"
                            ? "border-red-500 bg-red-50 text-red-600"
                            : "border-border text-muted-foreground hover:border-red-300"
                        }`}
                      >
                        Specific Batches
                      </button>
                    </div>
                  </div>

                  {/* Batch Multi-Select */}
                  {batchMode === "specific" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Select Batches ({selectedBatches.length} selected)
                      </Label>
                      <div className="border rounded-sm max-h-44 overflow-y-auto divide-y">
                        {allBatchNos.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3">No batches in current date range.</p>
                        ) : allBatchNos.map((b: string) => (
                          <button
                            key={b}
                            onClick={() => toggleBatch(b)}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/40 transition-colors ${
                              selectedBatches.includes(b) ? "bg-red-50 font-bold text-red-600" : ""
                            }`}
                          >
                            <span>{b}</span>
                            {selectedBatches.includes(b) && <X className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                      {selectedBatches.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {selectedBatches.join(", ")}
                          {selectedBatches.length === 1 && <span className="ml-1 text-red-500 font-semibold">(KPI card layout)</span>}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Info Banner */}
                  <div className="bg-muted/30 border rounded-sm px-3 py-2 text-xs text-muted-foreground">
                    {batchMode === "all"
                      ? `Exporting all ${filteredRecords.length} batch(es) in current date range with bar charts.`
                      : selectedBatches.length === 1
                        ? "Single batch selected — PDF will use KPI card layout (BSW, ASW, Yield, Packed, Profit, Wastage)."
                        : selectedBatches.length > 1
                          ? `${selectedBatches.length} batches selected — PDF will use bar chart layout.`
                          : "Select at least one batch to export."}
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" className="rounded-sm font-bold" onClick={() => setIsExportOpen(false)}>Cancel</Button>
                  <Button
                    className="bg-red-500 hover:bg-red-600 text-white rounded-sm font-bold px-6"
                    disabled={batchMode === "specific" && selectedBatches.length === 0}
                    onClick={handleExportPDF}
                  >
                    <FileDown className="h-4 w-4 mr-1" /> Download PDF
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Before Slaughter */}
        <div className="rounded-sm border bg-card p-6 shadow-none">
          <h2 className="text-lg font-semibold mb-4">Before Slaughter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Animal ID</Label><Input value={animalId} onChange={(e) => setAnimalId(e.target.value)} /></div>
            <div><Label>Animal Weight (kg)</Label><Input type="number" value={animalWeight} onChange={(e) => handleWeightChange(e.target.value)} /></div>
            <div><Label>Rate per kg (₹)</Label><Input type="number" value={rate} onChange={(e) => handleRateChange(e.target.value)} /></div>
            <div><Label>Total Cost (₹)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
            <div><Label>Farm Location</Label><Input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} /></div>
          </div>
          <Button className="mt-4" onClick={handleSaveBefore}>Save</Button>
        </div>

        {/* After Slaughter */}
        <div className="rounded-sm border bg-card p-6 shadow-none">
          <h2 className="text-lg font-semibold mb-4">After Slaughter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Batch Number (Auto)</Label>
              <Input value={nextBatch} disabled />
            </div>
            <div>
              <div className="flex flex-wrap justify-between items-center mb-1 gap-1">
                <Label>Link to Animal ID</Label>
                {linkedAnimal && selectedRecord && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {selectedRecord.animalId} — {selectedRecord.animalWeight || 0} kg
                  </span>
                )}
              </div>
              <select
                className={`flex h-10 w-full rounded-sm border ${afterSlaughterErrors.linkedAnimal ? "border-destructive ring-1 ring-destructive" : "border-input"} bg-background px-3 py-2 text-sm`}
                value={linkedAnimal}
                onChange={(e) => {
                  setLinkedAnimal(e.target.value);
                  if (afterSlaughterErrors.linkedAnimal) setAfterSlaughterErrors({ ...afterSlaughterErrors, linkedAnimal: false });
                }}
              >
                <option value="" className="bg-background text-foreground">Select Animal</option>
                {animalOptions.map((a: any) => (
                  <option key={a._id} value={a._id} className="bg-background text-foreground">
                    {a.animalId}
                  </option>
                ))}
              </select>
              {afterSlaughterErrors.linkedAnimal && <p className="text-xs text-destructive mt-1">This field is required</p>}
            </div>
            <div>
              <Label>Head (kg)</Label>
              <Input 
                type="number" 
                value={head} 
                onChange={(e) => {
                  setHead(e.target.value);
                  if (afterSlaughterErrors.head) setAfterSlaughterErrors({ ...afterSlaughterErrors, head: false });
                }} 
                className={afterSlaughterErrors.head ? "border-destructive focus-visible:ring-destructive" : ""} 
              />
              {afterSlaughterErrors.head && <p className="text-xs text-destructive mt-1">This field is required</p>}
            </div>
            <div>
              <Label>Ribs (kg)</Label>
              <Input 
                type="number" 
                value={ribs} 
                onChange={(e) => {
                  setRibs(e.target.value);
                  if (afterSlaughterErrors.ribs) setAfterSlaughterErrors({ ...afterSlaughterErrors, ribs: false });
                }} 
                className={afterSlaughterErrors.ribs ? "border-destructive focus-visible:ring-destructive" : ""} 
              />
              {afterSlaughterErrors.ribs && <p className="text-xs text-destructive mt-1">This field is required</p>}
            </div>
            <div>
              <Label>Ham (kg)</Label>
              <Input 
                type="number" 
                value={ham} 
                onChange={(e) => {
                  setHam(e.target.value);
                  if (afterSlaughterErrors.ham) setAfterSlaughterErrors({ ...afterSlaughterErrors, ham: false });
                }} 
                className={afterSlaughterErrors.ham ? "border-destructive focus-visible:ring-destructive" : ""} 
              />
              {afterSlaughterErrors.ham && <p className="text-xs text-destructive mt-1">This field is required</p>}
            </div>
            <div>
              <Label>Offals (kg)</Label>
              <Input 
                type="number" 
                value={offals} 
                onChange={(e) => {
                  setOffals(e.target.value);
                  if (afterSlaughterErrors.offals) setAfterSlaughterErrors({ ...afterSlaughterErrors, offals: false });
                }} 
                className={afterSlaughterErrors.offals ? "border-destructive focus-visible:ring-destructive" : ""} 
              />
              {afterSlaughterErrors.offals && <p className="text-xs text-destructive mt-1">This field is required</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground">Total (ASW):</div>
              <strong className="text-lg">{totalCarcass} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Ribs + Ham + Offals</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground">Slaughter Loss:</div>
              <strong className="text-lg">{Number(slaughterLoss).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">BSW - ASW</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground">Carcass Waste:</div>
              <strong className="text-lg">{carcassWaste} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Offals</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground">Total Wastage:</div>
              <strong className="text-lg">{Number(totalWastage).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Loss + Carcass</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground">Wastage %:</div>
              <strong className="text-lg">{wastagePercent}%</strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">(Wastage ÷ BSW) × 100</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3 border border-primary/20 bg-primary/5">
              <div className="text-primary/80">Usable Meat:</div>
              <strong className="text-lg text-primary">{usableMeat} <span className="text-sm font-normal text-primary/70">kg</span></strong>
              <div className="text-[10px] text-primary/50 mt-1 uppercase tracking-wide leading-tight">ASW - Carcass</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-2">
              <span className="text-muted-foreground">Total Amount:</span> <strong className="text-primary">₹{totalCost.toLocaleString("en-IN")}</strong>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-2">
              <span className="text-muted-foreground">Cost per kg:</span> <strong className="text-primary">₹{costPerKg}/kg</strong>
            </div>
          </div>
          <Button className="mt-4" onClick={handleSaveAfter}>Save</Button>
        </div>
      </div>

      {/* Packaging */}
      {packagingBatch && (
        <div id="packaging-section" className="rounded-sm border bg-card p-6 shadow-none mb-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setPackagingBatch(null); setPackagingId(null); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold m-0">Packaging — Batch [{packagingBatch}]</h2>
            </div>

            <div className={`px-5 py-2.5 rounded-sm shadow-none font-bold text-sm tracking-wide self-start sm:self-auto border ${isExceeded ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-primary/15 text-primary border-primary/30'}`}>
              Total Packed: {totalQty} / {packagingUsableMeat > 0 ? `${packagingUsableMeat} kg` : "N/A"}
              {isExceeded && <span className="ml-2 text-xs opacity-80">(Exceeded)</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit Price</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {defaultPackaging.map((p, i) => (
                  <tr key={i} className={`border-b ${i % 2 === 1 ? "bg-stripe" : ""}`}>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        className="w-20"
                        value={pkgItems[i].qty || ""}
                        onChange={(e) => {
                          const next = [...pkgItems];
                          next[i] = { ...next[i], qty: Number(e.target.value) || 0 };
                          setPkgItems(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          className="w-20 inline-flex"
                          value={pkgItems[i].price || ""}
                          onChange={(e) => {
                            const next = [...pkgItems];
                            next[i] = { ...next[i], price: Number(e.target.value) || 0 };
                            setPkgItems(next);
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">₹{pkgItems[i].qty * pkgItems[i].price}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="px-4 py-3" colSpan={3}>Grand Total</td>
                  <td className="px-4 py-3">₹{grandTotal.toLocaleString("en-IN")}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={handleMoveToInventory} className="bg-primary hover:bg-primary/80 text-white">Save & Go to Inventory</Button>
            <Button variant="outline" onClick={handleSavePackaging} className="border-primary text-primary hover:bg-primary hover:text-white">Save</Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
        <DialogContent className="w-full max-w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Record — {editingBatch}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-6">
              {/* Before Slaughter */}
              <div className="border rounded-sm p-4 bg-muted/20">
                <h3 className="font-medium mb-3">Before Slaughter</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><Label>Animal ID</Label><Input value={editForm.animalId || ""} onChange={(e) => handleEditField("animalId", e.target.value)} /></div>
                  <div><Label>Date</Label><Input type="date" value={editForm.date || ""} onChange={(e) => handleEditField("date", e.target.value)} /></div>
                  <div><Label>Farm Location</Label><Input value={editForm.farmLocation || ""} onChange={(e) => handleEditField("farmLocation", e.target.value)} /></div>
                  <div><Label>Animal Weight</Label><Input type="number" value={editForm.animalWeight || ""} onChange={(e) => handleEditField("animalWeight", e.target.value)} /></div>
                  <div><Label>Rate</Label><Input type="number" value={editForm.rate || ""} onChange={(e) => handleEditField("rate", e.target.value)} /></div>
                  <div><Label>Total Cost</Label><Input type="number" value={editForm.cost || ""} onChange={(e) => handleEditField("cost", e.target.value)} /></div>
                </div>
              </div>

              {/* After Slaughter */}
              <div className="border rounded-sm p-4 bg-muted/20">
                <h3 className="font-medium mb-3">After Slaughter</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><Label>Head (kg)</Label><Input type="number" value={editForm.head || ""} onChange={(e) => handleEditField("head", e.target.value)} /></div>
                  <div><Label>Ribs (kg)</Label><Input type="number" value={editForm.ribs || ""} onChange={(e) => handleEditField("ribs", e.target.value)} /></div>
                  <div><Label>Ham (kg)</Label><Input type="number" value={editForm.ham || ""} onChange={(e) => handleEditField("ham", e.target.value)} /></div>
                  <div><Label>Offals (kg)</Label><Input type="number" value={editForm.offals || ""} onChange={(e) => handleEditField("offals", e.target.value)} /></div>
                </div>
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
                  {(() => {
                    const ew = Number(editForm.animalWeight) || 0;
                    const eh = Number(editForm.head) || 0;
                    const er = Number(editForm.ribs) || 0;
                    const eham = Number(editForm.ham) || 0;
                    const eo = Number(editForm.offals) || 0;
                    
                    const eTotal = eh + er + eham + eo;
                    const eLoss = ew > 0 ? (ew - eTotal) : 0;
                    const eCarcass = eh + eo;
                    const eTotalWastage = eLoss + eCarcass;
                    const ePct = ew > 0 ? ((eTotalWastage / ew) * 100).toFixed(2) : "0.00";
                    const eUsable = eTotal - eCarcass;

                    return (
                      <>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground">Total (ASW):</div>
                          <strong className="text-lg">{eTotal} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Ribs + Ham + Offals</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground">Slaughter Loss:</div>
                          <strong className="text-lg">{Number(eLoss).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">BSW - ASW</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground">Carcass Waste:</div>
                          <strong className="text-lg">{eCarcass} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Offals</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground">Total Wastage:</div>
                          <strong className="text-lg">{Number(eTotalWastage).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Loss + Carcass</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground">Wastage %:</div>
                          <strong className="text-lg">{ePct}%</strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">(Wastage ÷ BSW) × 100</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-primary/20 bg-primary/5">
                          <div className="text-primary/80">Usable Meat:</div>
                          <strong className="text-lg text-primary">{eUsable} <span className="text-sm font-normal text-primary/70">kg</span></strong>
                          <div className="text-[10px] text-primary/50 mt-1 uppercase tracking-wide leading-tight">ASW - Carcass</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Packaging */}
              <div className="border rounded-sm p-4 bg-muted/20">
                <h3 className="font-medium mb-3">Packaging</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Mixed (kg)</Label>
                    <Input type="number" value={editForm.pkgItems?.mixed?.qty || ""} onChange={(e) => handleEditPkg("mixed", { ...(editForm.pkgItems?.mixed || {}), qty: e.target.value })} />
                  </div>
                  <div>
                    <Label>Mixed Unit Price (₹)</Label>
                    <Input type="number" value={editForm.pkgItems?.mixed?.pricePerKg || ""} onChange={(e) => handleEditPkg("mixed", { ...(editForm.pkgItems?.mixed || {}), pricePerKg: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Label>Status:</Label>
                <select className="h-9 rounded-sm border text-sm px-2 bg-background" value={editForm.status} onChange={(e) => handleEditField("status", e.target.value)}>
                  <option value="Unslaughtered" className="bg-background text-foreground">Unslaughtered</option>
                  <option value="Slaughtered" className="bg-background text-foreground">Slaughtered</option>
                  <option value="Packed" className="bg-background text-foreground">Packed</option>
                </select>
              </div>

            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingBatch(null); setEditingId(null); }}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary/80" onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Records */}
      <div className="rounded-sm border bg-card p-6 shadow-none">
        <h2 className="text-lg font-semibold mb-4">Dressing Records</h2>
        <DataTable
          columns={[
            { header: "Batch", accessor: (r: any) => r.batchNo || r.batch || '-' },
            { header: "Animal ID", accessor: "animalId" },
            { header: "Date", accessor: "date" },
            { header: "BSW (kg)", accessor: (r) => r.animalWeight ? `${r.animalWeight} kg` : "-" },
            { header: "ASW (kg)", accessor: (r) => r.status === "Unslaughtered" ? "-" : `${r.totalWeight} kg` },
            { header: "Usable Meat", accessor: (r) => r.usableMeat === "-" ? "-" : `${r.usableMeat} kg` },
            { header: "Wastage %", accessor: (r) => r.wastagePercent === "-" ? "-" : `${r.wastagePercent}%` },
            { header: "Total Cost", accessor: (r) => r.cost ? `₹${r.cost.toLocaleString("en-IN")}` : "-" },
            {
              header: "PRICE/KG (BS/PS)", accessor: (r) => {
                if (!r.cost) return "-";
                const live = r.animalWeight ? (r.cost / r.animalWeight).toFixed(0) : "0";
                const meat = r.usableMeat !== "-" ? (r.cost / Number(r.usableMeat)).toFixed(0) : "0";
                return r.status === "Unslaughtered" ? `₹${live} (BS)` : `₹${live} (BS) / ₹${meat} (AS)`;
              }
            },
            {
              header: "Packed Meat", accessor: (r: any) => {
                if (r.status !== "Packed" || !r.pkgItems) return <span className="text-muted-foreground text-xs">-</span>;
                const bone      = r.pkgItems?.bone     || {};
                const boneless  = r.pkgItems?.boneless || {};
                const mixed     = r.pkgItems?.mixed    || {};
                const totalQty  = (Number(bone.qty) || 0) + (Number(boneless.qty) || 0) + (Number(mixed.qty) || 0);
                const totalVal  = (Number(bone.qty) || 0)     * (Number(bone.pricePerKg)     || 0)
                                + (Number(boneless.qty) || 0) * (Number(boneless.pricePerKg) || 0)
                                + (Number(mixed.qty) || 0)    * (Number(mixed.pricePerKg)    || 0);
                if (totalQty === 0) return <span className="text-muted-foreground text-xs">-</span>;
                return (
                  <div className="text-xs leading-snug">
                    <div className="font-bold text-[#16A34A]">{totalQty} kg</div>
                    <div className="text-muted-foreground">₹{totalVal.toLocaleString("en-IN")}</div>
                  </div>
                );
              }
            },
            {
              header: "Status", accessor: (r: any) => {
                let colorClass = "bg-secondary text-secondary-foreground";
                if (r.status === "Packed") colorClass = "badge-success";
                else if (r.status === "Slaughtered") colorClass = "badge-warning";
                else if (r.status === "Unslaughtered") colorClass = "badge-error";

                return (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                    {r.status}
                  </span>
                );
              }
            },
            {
              header: "Action", accessor: (r) => (
                <div className="flex gap-1 items-center">
                  {r.status === "Slaughtered" && (
                    <Button variant="outline" size="sm" className="h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white mr-2" onClick={() => { 
                      setPackagingBatch(r.batch); 
                      setPackagingId(r._id);
                      setTimeout(() => {
                        document.getElementById("packaging-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 100);
                    }}>
                      Packaging
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleEditClick(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r._id, r.batch)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )
            },
          ]}
          data={filteredRecords}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
