import { useState, useEffect } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import DataTable from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function Supply() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
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

  const [shopNo, setShopNo] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherAddress, setOtherAddress] = useState("");

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingSupply, setPendingSupply] = useState<any>(null);

  const [batch, setBatch] = useState("");
  const [mixed, setMixed] = useState("");
  const [bone, setBone] = useState("");
  const [boneless, setBoneless] = useState("");
  const [extra, setExtra] = useState("");

  const total = (Number(mixed) || 0) + (Number(bone) || 0) + (Number(boneless) || 0);

  // Fallback prices if we can't retrieve them
  const defaultPrices = { bone: 350, boneless: 400, mixed: 380 };
  const nMixed = Number(mixed) || 0;
  const nBone = Number(bone) || 0;
  const nBoneless = Number(boneless) || 0;
  const nExtra = Number(extra) || 0;
  
  const calculatedTotalAmount = (nMixed * defaultPrices.mixed) + (nBone * defaultPrices.bone) + (nBoneless * defaultPrices.boneless);
  const finalTotalAmount = calculatedTotalAmount + nExtra;

  const handleSave = async (overrideFlag = false) => {
    if (!shopNo || !batch) {
      toast({ title: "Error", description: "Fill required fields", variant: "destructive" });
      return;
    }
    if (shopNo === "Others" && (!otherName || !otherAddress)) {
      toast({ title: "Error", description: "Fill exact shop name and address for Others", variant: "destructive" });
      return;
    }

    const payload = {
      shopId: shopNo !== "Others" ? shopNo : null,
      externalRecipient: shopNo === "Others" ? { name: otherName, address: otherAddress } : undefined,
      batch: batch,
      bone: nBone,
      boneless: nBoneless,
      mixed: nMixed,
      extra: nExtra,
      overrideFlag,
      date: new Date().toISOString().split("T")[0]
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
      fetchData();
    } catch (err: any) {
      if (err.response?.data?.canOverride) {
        setPendingSupply(payload);
        setShowOverrideModal(true);
      } else {
        toast({ title: "Error", description: err.response?.data?.message || "Failed to supply inventory.", variant: "destructive" });
      }
    }
  };

  const startEditOut = (r: any) => {
    setEditingRecordId(r._id);
    // Find if shopNo is in list
    const foundShop = shopsList.find(s => s.name === r.shopNo || s._id === r.shopNo || (r.shopId && s._id === r.shopId._id));
    if (foundShop) {
      setShopNo(foundShop._id);
    } else if (r.shopNo.startsWith("Others")) {
      setShopNo("Others");
      // Try parsing Others (name - address) roughly
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
    setMixed(r.mixed.toString());
    setBone(r.bone.toString());
    setBoneless(r.boneless.toString());
    setExtra((r.extra || "").toString());
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
        <Breadcrumb items={[{ label: "Inventory & Supply" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inventory & Supply Management</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage and distribute inventory stock to all retail shops.</p>
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
            { header: "Bone (kg)", accessor: "bone" },
            { header: "Boneless (kg)", accessor: "boneless" },
            { header: "Mixed (kg)", accessor: "mixed" },
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
          data={inventoryIn}
          isLoading={isLoading}
        />
      </div>

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
          <div className="bg-background rounded-sm shadow-none border w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-2">Insufficient Inventory</h3>
            <p className="text-muted-foreground mb-6">
              Insufficient inventory based on composition breakdown (Bone/Boneless/Mixed requirements exceed available stock).
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold" onClick={() => setShowOverrideModal(false)}>
                Fix Input
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
            <select className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm" value={shopNo} onChange={(e) => setShopNo(e.target.value)}>
              <option value="" className="bg-background text-foreground">Select Shop</option>
              {shopsList.map((s) => (
                <option key={s._id} value={s._id} className="bg-background text-foreground">{s.name}</option>
              ))}
              <option value="Others" className="bg-background text-foreground">Others</option>
            </select>
          </div>
          {shopNo === "Others" && (
            <>
              <div><Label>Shop Name</Label><Input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Enter shop name" /></div>
              <div><Label>Address</Label><Input value={otherAddress} onChange={(e) => setOtherAddress(e.target.value)} placeholder="Enter full address" /></div>
            </>
          )}
          <div>
            <Label>Batch Number</Label>
            <select className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm" value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="" className="bg-background text-foreground">Select Batch</option>
              {inventoryIn.filter(inv => (inv.totalWeight || inv.total || 0) > 0).map(inv => <option key={inv.batchNo || inv.batch} value={inv.batchNo || inv.batch} className="bg-background text-foreground">{inv.batchNo || inv.batch}</option>)}
              {/* Optional unlinked batches can be hidden or removed now that we pull from inventoryIn */}
            </select>
          </div>
          <div><Label>Date</Label><Input type="date" defaultValue={new Date().toISOString().split("T")[0]} /></div>
          <div><Label>Mixed (kg)</Label><Input type="number" value={mixed} onChange={(e) => setMixed(e.target.value)} /></div>
          <div><Label>Bone (kg)</Label><Input type="number" value={bone} onChange={(e) => setBone(e.target.value)} /></div>
          <div><Label>Boneless (kg)</Label><Input type="number" value={boneless} onChange={(e) => setBoneless(e.target.value)} /></div>
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
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground tracking-wide flex-1" onClick={() => handleSave(false)}>
            {editingRecordId ? "Update Record" : "Supply to Shop / Sync to Shop Inventory"}
          </Button>
          {editingRecordId && (
            <Button variant="outline" className="flex-1 text-muted-foreground hover:bg-accent" onClick={() => {
              setEditingRecordId(null);
              setShopNo(""); setBatch(""); setMixed(""); setBone(""); setBoneless(""); setExtra("");
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
            { header: "Total Wt.", accessor: (r) => `${r.total} kg` },
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
          data={records}
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
