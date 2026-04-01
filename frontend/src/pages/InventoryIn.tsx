import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  skin: number;
  meat: number;
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

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const endpoint = isWarehouse ? "/central-inventory" : `/shops/${id}/inventory-in`;
      const res = await api.get(endpoint);
      setRecords(res.data.data || []);
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
  const [batch, setBatch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [transport, setTransport] = useState("");
  const [bone, setBone] = useState("");
  const [boneless, setBoneless] = useState("");
  const [mixed, setMixed] = useState("");
  const [skin, setSkin] = useState("");
  const [meat, setMeat] = useState("");
  const [rate, setRate] = useState("");
  const [totalWeight, setTotalWeight] = useState("");

  const totalKgCalculated = (Number(bone) || 0) + (Number(boneless) || 0) + (Number(mixed) || 0) + (Number(skin) || 0) + (Number(meat) || 0);
  const totalAmt = totalKgCalculated * (Number(rate) || 0);

  const totalBone = records.reduce((s, r) => s + (r.bone || 0), 0);
  const totalBoneless = records.reduce((s, r) => s + (r.boneless || 0), 0);
  const totalValue = records.reduce((s, r) => s + (r.totalAmount || r.total_amount || r.total || 0), 0);
  
  const isLowStock = totalBone + totalBoneless + records.reduce((s, r) => s + (r.mixed || 0), 0) < 5;

  const handleSave = async () => {
    if (!batch || (!bone && !boneless && !mixed)) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill Batch Number and at least one weight field.", 
        variant: "destructive" 
      });
      return;
    }

    const enteredTotalWeight = isWarehouse ? (Number(totalWeight) || 0) : totalKgCalculated;
    if (isWarehouse && enteredTotalWeight !== totalKgCalculated) {
      toast({ 
        title: "Weight Mismatch", 
        description: `Ensure: total_weight (${enteredTotalWeight}) = bone + boneless + mixed + skin + meat (${totalKgCalculated})`, 
        variant: "destructive" 
      });
      return;
    }

    const payload = isWarehouse ? {
      batchNo: batch,
      bone: Number(bone) || 0,
      boneless: Number(boneless) || 0,
      mixed: Number(mixed) || 0,
      skin: Number(skin) || 0,
      meat: Number(meat) || 0,
      date: date
    } : {
      batch,
      transport,
      bone: Number(bone) || 0,
      boneless: Number(boneless) || 0,
      mixed: Number(mixed) || 0,
      skin: 0,
      meat: 0,
      rate: Number(rate) || 0,
      totalWeight: enteredTotalWeight,
      totalAmount: totalAmt,
      date,
    };

    try {
      const endpoint = isWarehouse ? "/central-inventory" : `/shops/${id}/inventory-in`;
      await api.post(endpoint, payload);
      
      toast({ title: "Success", description: "Inventory stock entry saved successfully." });
      setBatch(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setSkin(""); setMeat(""); setRate(""); setTotalWeight("");
      setDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to save stock entry.", variant: "destructive" });
    }
  };

  const handleDelete = async (deleteId: string) => {
    if (!confirm("Delete this inventory entry?")) return;
    try {
      const endpoint = isWarehouse ? `/central-inventory/${deleteId}` : `/shops/${id}/inventory-in/${deleteId}`;
      await api.delete(endpoint);
      toast({ title: "Deleted", description: "Entry removed from records" });
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete from server", variant: "destructive" });
    }
  };

  // Editing
  const [editingIndex, setEditingIndex] = useState<string | null>(null);

  const handleEditClick = (record: InventoryRecord) => {
    setEditingIndex(record._id || record.id || null);
    setBatch(record.batch || record.batchNo || "");
    setDate(record.date || record.createdAt?.split("T")[0] || "");
    setTransport(record.transport);
    setBone(record.bone.toString());
    setBoneless(record.boneless.toString());
    setMixed(record.mixed.toString());
    setSkin((record.skin || 0).toString());
    setMeat((record.meat || 0).toString());
    setRate((record.rate || 0).toString());
    setTotalWeight((record.total_weight || record.totalWeight || 0).toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async () => {
    if (!editingIndex) return;
    const enteredTotalWeight = isWarehouse ? (Number(totalWeight) || 0) : totalKgCalculated;
    if (isWarehouse && enteredTotalWeight !== totalKgCalculated) {
      toast({ 
        title: "Weight Mismatch", 
        description: `Ensure: total_weight (${enteredTotalWeight}) = bone + boneless + mixed + skin + meat (${totalKgCalculated})`, 
        variant: "destructive" 
      });
      return;
    }

    const payload = isWarehouse ? {
      batchNo: batch,
      bone: Number(bone) || 0,
      boneless: Number(boneless) || 0,
      mixed: Number(mixed) || 0,
      skin: Number(skin) || 0,
      meat: Number(meat) || 0,
    } : {
      batch,
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
      setBatch(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setSkin(""); setMeat(""); setRate(""); setTotalWeight("");
      setDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update record on server.", variant: "destructive" });
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setBatch(""); setTransport(""); setBone(""); setBoneless(""); setMixed(""); setRate("");
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
          title="Total Stock Value" 
          value={`₹${totalValue.toLocaleString("en-IN")}`} 
          icon={<IndianRupee className="h-5 w-5 text-info" />} 
          color="info" 
        />
        <StatCard 
          title="Total Bone Stock" 
          value={`${totalBone} kg`} 
          icon={<Bone className="h-5 w-5 text-foreground" />} 
        />
        <StatCard 
          title="Total Boneless Stock" 
          value={`${totalBoneless} kg`} 
          icon={<Package className="h-5 w-5 text-foreground" />} 
        />
        <StatCard 
          title="Low Stock Warning" 
          value={isLowStock ? "Below 5kg!" : "Stock OK"} 
          icon={<AlertTriangle className="h-5 w-5" />} 
          color={isLowStock ? "destructive" : "success"}
          className={isLowStock ? "animate-pulse border-destructive bg-destructive/5" : ""}
        />
      </div>

      <div className="rounded-sm border bg-card p-6 shadow-none mb-8">
        <h2 className="text-lg font-semibold mb-4 border-b pb-2">Add Stock Form</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="batch">Batch Number</Label>
            <Input id="batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="e.g. BAT-202" />
          </div>
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
            <Input id="bone" type="number" value={bone} onChange={(e) => setBone(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boneless">Boneless (kg)</Label>
            <Input id="boneless" type="number" value={boneless} onChange={(e) => setBoneless(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mixed">Mixed (kg)</Label>
            <Input id="mixed" type="number" value={mixed} onChange={(e) => setMixed(e.target.value)} placeholder="0" />
          </div>
          {isWarehouse && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="skin">Skin (kg)</Label>
                <Input id="skin" type="number" value={skin} onChange={(e) => setSkin(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meat">Meat (kg)</Label>
                <Input id="meat" type="number" value={meat} onChange={(e) => setMeat(e.target.value)} placeholder="0" />
              </div>
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
            { header: "Batch", accessor: (r: InventoryRecord) => r.batchNo || r.batch || "-" },
            ...(!isWarehouse ? [{ header: "Transport", accessor: (r: InventoryRecord) => r.transport || "" }] : []),
            { header: "Bone (kg)", accessor: (r: InventoryRecord) => `${r.bone || 0}` },
            { header: "Boneless (kg)", accessor: (r: InventoryRecord) => `${r.boneless || 0}` },
            { header: "Mixed (kg)", accessor: (r: InventoryRecord) => `${r.mixed || 0}` },
            ...(isWarehouse ? [
              { header: "Skin (kg)", accessor: (r: InventoryRecord) => `${r.skin || 0}` },
              { header: "Meat (kg)", accessor: (r: InventoryRecord) => `${r.meat || 0}` },
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                    onClick={() => handleDelete(r._id || r.id || "")}
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
    </div>
  );
}

