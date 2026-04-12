import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, Bone, AlertTriangle, Package, Pencil, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";

interface InventoryRecord {
  id?: string;
  _id?: string;
  date?: string;
  createdAt?: string;
  batch: string;
  batchNo?: string;
  transport?: string;
  bone: number;
  boneless: number;
  mixed: number;
  rate?: number;
  total_weight?: number;
  totalWeight?: number;
  total_amount?: number;
  totalAmount?: number;
  total?: number;
}

export default function InventoryIn() {
  const { toast } = useToast();
  const { id } = useParams();
  const isWarehouse = !id;

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [liveStock, setLiveStock] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const endpoint = isWarehouse ? "/central-inventory" : `/shops/${id}/inventory-in`;
      const res = await api.get(endpoint);
      setRecords(res.data.data || []);
      
      if (!isWarehouse) {
        const stockRes = await api.get(`/shops/${id}/stock`);
        setLiveStock(stockRes.data.data);
      }
      
      const batchRes = await api.get("/batches");
      setBatches(batchRes.data.data || []);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to fetch inventory data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, isWarehouse]);
  
  // Form State
  const [entryType, setEntryType] = useState<"central" | "external">("external");
  const [vendorName, setVendorName] = useState("");
  const [batch, setBatch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [transport, setTransport] = useState("");
  const [bone, setBone] = useState("");
  const [boneless, setBoneless] = useState("");
  const [mixed, setMixed] = useState("");
  const [rate, setRate] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  
  // Prices only for Central Inventory
  const [bonePrice, setBonePrice] = useState("");
  const [bonelessPrice, setBonelessPrice] = useState("");
  const [mixedPrice, setMixedPrice] = useState("");

  const totalKgCalculated = (Number(bone) || 0) + (Number(boneless) || 0) + (Number(mixed) || 0);
  const totalAmt = totalKgCalculated * (Number(rate) || 0);

  const totalValue = records.reduce((s, r) => s + (r.totalAmount || r.total_amount || r.total || 0), 0);

  const totalBone = isWarehouse ? records.reduce((s, r) => s + (r.bone?.qty || 0), 0) : (liveStock?.boneStock || 0);
  const totalBoneless = isWarehouse ? records.reduce((s, r) => s + (r.boneless?.qty || 0), 0) : (liveStock?.bonelessStock || 0);
  const totalMixedStock = isWarehouse ? records.reduce((s, r) => s + (r.mixed?.qty || 0), 0) : (liveStock?.mixedStock || 0);
  
  const totalWeightOverall = isWarehouse 
    ? records.reduce((s, r) => s + (r.totalWeight || r.total_weight || ((r.bone?.qty || 0) + (r.boneless?.qty || 0) + (r.mixed?.qty || 0))), 0)
    : (totalBone + totalBoneless + totalMixedStock);

  const handleSave = async () => {
    if (isWarehouse && !batch) {
      toast({ 
        title: "Validation Error", 
        description: "Please provide a Batch Number.", 
        variant: "destructive" 
      });
      return;
    }

    if (!isWarehouse && entryType === 'external' && !vendorName) {
      toast({ 
        title: "Validation Error", 
        description: "Please provide a Vendor Name.", 
        variant: "destructive" 
      });
      return;
    }

    if (!bone && !boneless && !mixed) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill at least one weight field.", 
        variant: "destructive" 
      });
      return;
    }

    const enteredTotalWeight = isWarehouse ? (Number(totalWeight) || 0) : totalKgCalculated;
    if (isWarehouse && enteredTotalWeight !== totalKgCalculated) {
      toast({ 
        title: "Weight Mismatch", 
        description: `Ensure: total_weight (${enteredTotalWeight}) = bone + boneless + mixed (${totalKgCalculated})`, 
        variant: "destructive" 
      });
      return;
    }

    const payload = isWarehouse ? {
      batchNo: batch,
      bone: { qty: Number(bone) || 0, pricePerKg: Number(bonePrice) || 0 },
      boneless: { qty: Number(boneless) || 0, pricePerKg: Number(bonelessPrice) || 0 },
      mixed: { qty: Number(mixed) || 0, pricePerKg: Number(mixedPrice) || 0 },
      date: date
    } : {
      type: entryType,
      batch,
      vendorName: entryType === 'external' ? vendorName : '',
      transport,
      bone: Number(bone) || 0,
      boneless: Number(boneless) || 0,
      mixed: Number(mixed) || 0,
      rate: Number(rate) || 0,
      totalWeight: enteredTotalWeight,
      totalAmount: totalAmt,
      date,
    };

    try {
      const endpoint = isWarehouse ? "/central-inventory" : `/shops/${id}/inventory-in`;
      await api.post(endpoint, payload);
      
      toast({ title: "Success", description: "Inventory stock entry saved successfully." });
      setBatch(""); setVendorName(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setRate(""); setTotalWeight("");
      setBonePrice(""); setBonelessPrice(""); setMixedPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to save stock entry.", variant: "destructive" });
    }
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<InventoryRecord | null>(null);

  const handleDeleteClick = (record: InventoryRecord) => {
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    const deleteId = recordToDelete._id || recordToDelete.id || "";
    try {
      const endpoint = isWarehouse ? `/central-inventory/${deleteId}` : `/shops/${id}/inventory-in/${deleteId}`;
      await api.delete(endpoint);
      toast({ title: "Deleted", description: "Entry removed from records" });
      setDeleteModalOpen(false);
      setRecordToDelete(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  };

  // Editing
  const [editingIndex, setEditingIndex] = useState<string | null>(null);

  const handleEditClick = (record: InventoryRecord) => {
    setEditingIndex(record._id || record.id || null);
    setEntryType((record as any).type || "central");
    setBatch(record.batch || record.batchNo || "");
    setVendorName((record as any).vendorName || "");
    setDate(record.date || record.createdAt?.split("T")[0] || "");
    setTransport(record.transport);
    setBone((isWarehouse ? (record.bone as any)?.qty : record.bone)?.toString() || "0");
    setBoneless((isWarehouse ? (record.boneless as any)?.qty : record.boneless)?.toString() || "0");
    setMixed((isWarehouse ? (record.mixed as any)?.qty : record.mixed)?.toString() || "0");
    if (isWarehouse) {
      setBonePrice((record.bone as any)?.pricePerKg?.toString() || "0");
      setBonelessPrice((record.boneless as any)?.pricePerKg?.toString() || "0");
      setMixedPrice((record.mixed as any)?.pricePerKg?.toString() || "0");
    }
    setRate((record.rate || 0).toString());
    setTotalWeight((record.total_weight || record.totalWeight || 0).toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (!editingIndex) return;
    
    if (isWarehouse && !batch) {
      toast({ 
        title: "Validation Error", 
        description: "Please provide a Batch Number.", 
        variant: "destructive" 
      });
      return;
    }

    if (!isWarehouse && entryType === 'external' && !vendorName) {
      toast({ 
        title: "Validation Error", 
        description: "Please provide a Vendor Name.", 
        variant: "destructive" 
      });
      return;
    }

    if (!bone && !boneless && !mixed) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill at least one weight field.", 
        variant: "destructive" 
      });
      return;
    }

    const enteredTotalWeight = isWarehouse ? (Number(totalWeight) || 0) : totalKgCalculated;
    if (isWarehouse && enteredTotalWeight !== totalKgCalculated) {
      toast({ 
        title: "Weight Mismatch", 
        description: `Ensure: total_weight (${enteredTotalWeight}) = bone + boneless + mixed (${totalKgCalculated})`, 
        variant: "destructive" 
      });
      return;
    }

    const payload = isWarehouse ? {
      batchNo: batch,
      bone: { qty: Number(bone) || 0, pricePerKg: Number(bonePrice) || 0 },
      boneless: { qty: Number(boneless) || 0, pricePerKg: Number(bonelessPrice) || 0 },
      mixed: { qty: Number(mixed) || 0, pricePerKg: Number(mixedPrice) || 0 },
    } : {
      type: entryType,
      batch,
      vendorName: entryType === 'external' ? vendorName : '',
      transport,
      bone: Number(bone) || 0,
      boneless: Number(boneless) || 0,
      mixed: Number(mixed) || 0,
      rate: Number(rate) || 0,
      totalWeight: enteredTotalWeight,
      totalAmount: totalAmt
    };

    try {
      const endpoint = isWarehouse ? `/central-inventory/${editingIndex}` : `/shops/${id}/inventory-in/${editingIndex}`;
      await api.put(endpoint, payload);
      toast({ title: "Updated", description: "Entry updated" });
      setEditingIndex(null);
      setBatch(""); setVendorName(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setRate(""); setTotalWeight("");
      setBonePrice(""); setBonelessPrice(""); setMixedPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update record on server.", variant: "destructive" });
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setBatch(""); setVendorName(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setRate("");
    setBonePrice(""); setBonelessPrice(""); setMixedPrice("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[
          { label: "Inventory", path: "/inventory/in" },
          { label: "Inventory In" }
        ]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inventory In</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Log incoming raw stock batches and track weights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title={isWarehouse ? "total stock kg/price" : "Total Stock / Value"} 
          value={isWarehouse ? `${totalWeightOverall}kg/₹${totalValue.toLocaleString("en-IN")}` : `${totalWeightOverall.toFixed(2)} kg`} 
          icon={null}
        />
        <StatCard 
          title="Total Bone Stock" 
          value={`${typeof totalBone === 'number' ? totalBone.toFixed(2) : totalBone} kg`} 
          icon={null}
        />
        <StatCard 
          title="Total Boneless Stock" 
          value={`${typeof totalBoneless === 'number' ? totalBoneless.toFixed(2) : totalBoneless} kg`} 
          icon={null}
        />
        <StatCard 
          title="Total mixed stock" 
          value={`${typeof totalMixedStock === 'number' ? totalMixedStock.toFixed(2) : totalMixedStock} kg`} 
          icon={null}
        />
      </div>

      <div className="rounded-sm border bg-card p-6 shadow-none mb-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b pb-2 gap-4">
          <h2 className="text-lg font-semibold">Add Stock Form</h2>

        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
          {isWarehouse && (
            <div className="space-y-1.5 min-w-[200px]">
              <Label htmlFor="batch">Batch Number</Label>
              <select id="batch" className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm" value={batch} onChange={(e) => {
                const b = e.target.value;
                setBatch(b);
                const selected = batches.find(x => x.batchNo === b);
                if (selected && selected.cost && selected.usableMeat && selected.usableMeat !== "-") {
                  const cpk = Math.round(selected.cost / Number(selected.usableMeat));
                  setBonePrice(cpk.toString());
                  setBonelessPrice(cpk.toString());
                  setMixedPrice(cpk.toString());
                }
              }}>
                <option value="">Select Batch</option>
                {batches.map(b => <option key={b.batchNo} value={b.batchNo}>{b.batchNo}</option>)}
              </select>
              {batch && batches.find(x => x.batchNo === batch) && (
                <div className="text-xs text-muted-foreground mt-1 bg-secondary/50 p-1.5 rounded-sm border flex flex-col gap-0.5">
                  <div>Original Mixed Qty: <strong className="text-foreground">{batches.find(x => x.batchNo === batch)?.pkgItems?.mixed?.qty || 0} kg</strong></div>
                  <div>Batch Cost: <strong>₹{Math.round(batches.find(x => x.batchNo === batch)?.cost / Number(batches.find(x => x.batchNo === batch)?.usableMeat || 1))}/kg</strong></div>
                </div>
              )}
            </div>
          )}
          {!isWarehouse && entryType === "external" && (
            <div className="space-y-1.5 min-w-[200px]">
              <Label htmlFor="vendorName">Vendor Name</Label>
              <Input id="vendorName" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Local Farm" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {!isWarehouse && (
            <div className="space-y-1.5">
              <Label htmlFor="transport">Transport Details</Label>
              <Input id="transport" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="e.g. Vehicle Number / Name" />
            </div>
          )}
          {!isWarehouse && (
            <div className="space-y-1.5">
              <Label htmlFor="rate">Rate per kg (₹)</Label>
              <Input id="rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bone">Bone (kg)</Label>
            <Input id="bone" type="number" value={bone} onChange={(e) => setBone(e.target.value)} placeholder="qty" />
            {isWarehouse && (
              <Input type="number" className="mt-1" value={bonePrice} onChange={(e) => setBonePrice(e.target.value)} placeholder="price/kg" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boneless">Boneless (kg)</Label>
            <Input id="boneless" type="number" value={boneless} onChange={(e) => setBoneless(e.target.value)} placeholder="qty" />
            {isWarehouse && (
              <Input type="number" className="mt-1" value={bonelessPrice} onChange={(e) => setBonelessPrice(e.target.value)} placeholder="price/kg" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mixed">Mixed (kg)</Label>
            <Input id="mixed" type="number" value={mixed} onChange={(e) => setMixed(e.target.value)} placeholder="qty" />
            {isWarehouse && (
              <Input type="number" className="mt-1" value={mixedPrice} onChange={(e) => setMixedPrice(e.target.value)} placeholder="price/kg" />
            )}
          </div>
          {isWarehouse && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="totalWeight">Total Weight (kg)</Label>
                <Input id="totalWeight" type="number" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} placeholder="0" />
              </div>
            </>
          )}
          <div className="flex flex-col justify-end gap-2">
            {/* Skin and Meat calculated fields have been removed per requirement */}
            {!isWarehouse && (
              <div className="bg-secondary/30 p-2 rounded-sm flex justify-between items-center px-3 border border-dashed text-sm">
                <span className="text-muted-foreground font-medium">Total Amount:</span>
                <span className="font-bold text-primary">₹{totalAmt.toLocaleString("en-IN")}</span>
              </div>
            )}
            {editingIndex !== null ? (
              <div className="flex gap-2 w-full">
                <Button onClick={handleUpdate} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  Update Entry
                </Button>
                <Button onClick={cancelEdit} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/80 text-white w-full">
                Save Stock Entry
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-sm border bg-card p-6 shadow-none">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Inventory In Table</h2>
        <DataTable
          isLoading={isLoading}
          columns={[
            { header: "Date", accessor: (r: InventoryRecord) => r.date || r.createdAt?.split("T")[0] || "" },
            ...(!isWarehouse ? [{ header: "Type", accessor: (r: any) => r.type === 'external' ? 'External' : 'Central' }] : []),
            { header: "Batch / Vendor", accessor: (r: any) => (!isWarehouse && r.type === 'external') ? (`${r.vendorName || 'Vendor'} (${r.batch})`) : (r.batchNo || r.batch || "-") },
            ...(!isWarehouse ? [{ header: "Transport", accessor: (r: InventoryRecord) => r.transport || "" }] : []),
            ...(!isWarehouse ? [
              { header: "Bone (kg)", accessor: (r: InventoryRecord) => `${r.bone || 0}` },
              { header: "Boneless (kg)", accessor: (r: InventoryRecord) => `${r.boneless || 0}` },
              { header: "Mixed (kg)", accessor: (r: InventoryRecord) => `${r.mixed || 0}` },
            ] : [
              { header: "Bone", accessor: (r: any) => `${r.bone?.qty || 0} kg @ ₹${r.bone?.pricePerKg || 0}` },
              { header: "Boneless", accessor: (r: any) => `${r.boneless?.qty || 0} kg @ ₹${r.boneless?.pricePerKg || 0}` },
              { header: "Mixed", accessor: (r: any) => `${r.mixed?.qty || 0} kg @ ₹${r.mixed?.pricePerKg || 0}` },
            ]),
            ...(isWarehouse ? [
              { header: "Total Weight (kg)", accessor: (r: InventoryRecord) => `${r.total_weight || r.totalWeight || 0}` }
            ] : []),
            ...(!isWarehouse ? [
              { header: "Rate (₹)", accessor: (r: InventoryRecord) => `₹${r.rate || 0}` },
              { header: "Total (₹)", accessor: (r: InventoryRecord) => `₹${Number(r.total_amount || r.totalAmount || r.total || 0).toLocaleString("en-IN")}` }
            ] : []),
            { 
              header: "Actions", 
              accessor: (r: InventoryRecord) => (
                <div className="flex gap-1">
                  {r.transport !== "Internal Supply" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                    onClick={() => handleDeleteClick(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            },
          ]}
          data={records}
          pageSize={8}
        />
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {recordToDelete?.transport === "Internal Supply" ? "Return to Central Inventory" : "Delete Entry"}
            </DialogTitle>
            <DialogDescription>
              {recordToDelete?.transport === "Internal Supply" 
                ? "This will remove the stock from this shop and return it to Central Inventory. Are you sure?" 
                : "Are you sure you want to delete this stock entry?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {recordToDelete?.transport === "Internal Supply" ? "Return Stock" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

