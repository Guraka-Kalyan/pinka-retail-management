import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import api from "@/lib/api";

const defaultPackaging = [
  { name: "Bone", price: 350 },
  { name: "Boneless", price: 400 },
  { name: "Mixed", price: 380 },
  { name: "Skin", price: 50 },
  { name: "Meat", price: 450 },
];

export default function Dressing() {
  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const handleEditClick = (r: any) => {
    setEditingBatch(r.batch);
    setEditingId(r._id);
    setEditForm({ ...r, pkgItems: r.pkgItems || { bone: 0, boneless: 0, mixed: 0, skin: 0, meat: 0 } });
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
          [item]: Number(val) || 0
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

  const handleSaveBefore = async () => {
    if (!animalId || !animalWeight) {
      toast({ title: "Error", description: "Fill required fields", variant: "destructive" });
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
    if (!linkedAnimal || totalCarcass === 0) {
      toast({ title: "Error", description: "Fill all weight fields", variant: "destructive" });
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

      toast({ title: "Saved", description: `After slaughter data saved` });

      // Clear fields
      setLinkedAnimal("");
      setHead("");
      setRibs("");
      setHam("");
      setOffals("");
      fetchData();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update record", variant: "destructive" });
    }
  };

  const handleMoveToInventory = async () => {
    if (packagingBatch && packagingId) {
      const packagingData = {
        bone: pkgItems[0].qty,
        boneless: pkgItems[1].qty,
        mixed: pkgItems[2].qty,
        skin: pkgItems[3].qty,
        meat: pkgItems[4].qty,
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
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Failed to move to inventory", variant: "destructive" });
      }
    }
  };

  const handleSavePackaging = async () => {
    if (packagingBatch && packagingId) {
      const packagingData = {
        pkgItems: {
          bone: pkgItems[0].qty,
          boneless: pkgItems[1].qty,
          mixed: pkgItems[2].qty,
          skin: pkgItems[3].qty,
          meat: pkgItems[4].qty,
        }
      };

      try {
        await api.put(`/batches/${packagingId}`, packagingData);
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

  const animalOptions = Array.from(new Set([
    ...records.filter(r => r.status === "Unslaughtered").map(r => ({ _id: r._id, animalId: r.animalId })),
  ]));

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Dressing" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Dressing Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage before and after slaughter processes and yields.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Before Slaughter */}
        <div className="rounded-sm border bg-card p-6 shadow-none">
          <h2 className="text-lg font-semibold mb-4">Before Slaughter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Animal ID</Label><Input value={animalId} onChange={(e) => setAnimalId(e.target.value)} placeholder="AN-106" /></div>
            <div><Label>Animal Weight (kg)</Label><Input type="number" value={animalWeight} onChange={(e) => handleWeightChange(e.target.value)} placeholder="85" /></div>
            <div><Label>Rate per kg (₹)</Label><Input type="number" value={rate} onChange={(e) => handleRateChange(e.target.value)} placeholder="140" /></div>
            <div><Label>Total Cost (₹)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="11900" /></div>
            <div><Label>Date</Label><Input type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
            <div><Label>Farm Location</Label><Input value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="Village Farm" /></div>
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
                {linkedAnimal && (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {linkedAnimal} / {selectedRecord?.animalWeight ? `${selectedRecord.animalWeight} kg` : "N/A"}
                  </span>
                )}
              </div>
              <select
                className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
                value={linkedAnimal}
                onChange={(e) => setLinkedAnimal(e.target.value)}
              >
                <option value="" className="bg-background text-foreground">Select Animal</option>
                {animalOptions.map((a: any) => (
                  <option key={a._id} value={a._id} className="bg-background text-foreground">{a.animalId}</option>
                ))}
              </select>
            </div>
            <div><Label>Head (kg)</Label><Input type="number" value={head} onChange={(e) => setHead(e.target.value)} /></div>
            <div><Label>Ribs (kg)</Label><Input type="number" value={ribs} onChange={(e) => setRibs(e.target.value)} /></div>
            <div><Label>Ham (kg)</Label><Input type="number" value={ham} onChange={(e) => setHam(e.target.value)} /></div>
            <div><Label>Offals (kg)</Label><Input type="number" value={offals} onChange={(e) => setOffals(e.target.value)} /></div>
          </div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground whitespace-nowrap">Total (ASW):</div>
              <strong className="text-lg">{totalCarcass} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Ribs + Ham + Offals</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground whitespace-nowrap">Slaughter Loss:</div>
              <strong className="text-lg">{Number(slaughterLoss).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">BSW - ASW</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground whitespace-nowrap">Carcass Waste:</div>
              <strong className="text-lg">{carcassWaste} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Offals</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground whitespace-nowrap">Total Wastage:</div>
              <strong className="text-lg">{Number(totalWastage).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Loss + Carcass</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3">
              <div className="text-muted-foreground whitespace-nowrap">Wastage %:</div>
              <strong className="text-lg">{wastagePercent}%</strong>
              <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">(Wastage ÷ BSW) × 100</div>
            </div>
            <div className="bg-secondary flex flex-col rounded-sm p-3 border border-primary/20 bg-primary/5">
              <div className="text-primary/80 whitespace-nowrap">Usable Meat:</div>
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
        <div className="rounded-sm border bg-card p-6 shadow-none mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setPackagingBatch(null); setPackagingId(null); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold m-0">Packaging — Batch [{packagingBatch}]</h2>
            </div>
            
            <div className="bg-primary/15 text-primary border border-primary/30 px-5 py-2.5 rounded-sm shadow-none font-bold text-sm tracking-wide self-start sm:self-auto">
              Usable Meat: {(() => {
                const pRec = records.find(r => r.batch === packagingBatch);
                return pRec?.usableMeat && pRec.usableMeat !== "-" ? `${pRec.usableMeat} kg` : "N/A";
              })()}
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
            <Button onClick={handleMoveToInventory} className="bg-primary hover:bg-primary/80 text-white">Move to Inventory</Button>
            <Button variant="outline" onClick={handleSavePackaging} className="border-primary text-primary hover:bg-primary hover:text-white">Save Packaging</Button>
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
                          <div className="text-muted-foreground whitespace-nowrap">Total (ASW):</div>
                          <strong className="text-lg">{eTotal} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Ribs + Ham + Offals</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground whitespace-nowrap">Slaughter Loss:</div>
                          <strong className="text-lg">{Number(eLoss).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">BSW - ASW</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground whitespace-nowrap">Carcass Waste:</div>
                          <strong className="text-lg">{eCarcass} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Head + Offals</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground whitespace-nowrap">Total Wastage:</div>
                          <strong className="text-lg">{Number(eTotalWastage).toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">Loss + Carcass</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-input">
                          <div className="text-muted-foreground whitespace-nowrap">Wastage %:</div>
                          <strong className="text-lg">{ePct}%</strong>
                          <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide leading-tight">(Wastage ÷ BSW) × 100</div>
                        </div>
                        <div className="bg-background flex flex-col rounded-sm p-3 border border-primary/20 bg-primary/5">
                          <div className="text-primary/80 whitespace-nowrap">Usable Meat:</div>
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div><Label>Bone (kg)</Label><Input type="number" value={editForm.pkgItems?.bone || ""} onChange={(e) => handleEditPkg("bone", e.target.value)} /></div>
                  <div><Label>Boneless (kg)</Label><Input type="number" value={editForm.pkgItems?.boneless || ""} onChange={(e) => handleEditPkg("boneless", e.target.value)} /></div>
                  <div><Label>Mixed (kg)</Label><Input type="number" value={editForm.pkgItems?.mixed || ""} onChange={(e) => handleEditPkg("mixed", e.target.value)} /></div>
                  <div><Label>Skin (kg)</Label><Input type="number" value={editForm.pkgItems?.skin || ""} onChange={(e) => handleEditPkg("skin", e.target.value)} /></div>
                  <div><Label>Meat (kg)</Label><Input type="number" value={editForm.pkgItems?.meat || ""} onChange={(e) => handleEditPkg("meat", e.target.value)} /></div>
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
            { header: "Total Weight", accessor: (r) => r.status === "Unslaughtered" ? `${r.animalWeight || "-"} kg` : `${r.totalWeight} kg` },
            { header: "Usable Meat", accessor: (r) => r.usableMeat === "-" ? "-" : `${r.usableMeat} kg` },
            { header: "Wastage %", accessor: (r) => r.wastagePercent === "-" ? "-" : `${r.wastagePercent}%` },
            { header: "Total Cost", accessor: (r) => r.cost ? `₹${r.cost.toLocaleString("en-IN")}` : "-" },
            { header: "Price/kg (Live/Meat)", accessor: (r) => {
               if (!r.cost) return "-";
               const live = r.animalWeight ? (r.cost / r.animalWeight).toFixed(0) : "0";
               const meat = r.usableMeat !== "-" ? (r.cost / Number(r.usableMeat)).toFixed(0) : "0";
               return r.status === "Unslaughtered" ? `₹${live} (L)` : `₹${live} (L) / ₹${meat} (M)`;
            }},
            { header: "Status", accessor: (r) => {
              let colorClass = "bg-secondary text-secondary-foreground";
              if (r.status === "Packed") colorClass = "badge-success";
              else if (r.status === "Slaughtered") colorClass = "badge-warning";
              else if (r.status === "Unslaughtered") colorClass = "badge-error";

              return (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                  {r.status}
                </span>
              );
            }},
            { header: "Action", accessor: (r) => (
              <div className="flex gap-1 items-center">
                {r.status === "Slaughtered" && (
                  <Button variant="outline" size="sm" className="h-8 text-xs border-primary text-primary hover:bg-primary hover:text-white mr-2" onClick={() => { setPackagingBatch(r.batch); setPackagingId(r._id); }}>
                    Packaging
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleEditClick(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r._id, r.batch)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )},
          ]}
          data={records}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
