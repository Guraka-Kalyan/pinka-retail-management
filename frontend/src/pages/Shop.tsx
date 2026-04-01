import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import { 
  Store, 
  Trash2, 
  User, 
  Phone, 
  MapPin, 
  Search, 
  Plus, 
  StoreIcon,
  Check,
  X as XIcon,
  Pencil,
  FileText,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn("flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  />
);

export default function Shop() {
  const [editingShop, setEditingShop] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);

  const [activeShopForNotes, setActiveShopForNotes] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [shopsRes, notesRes] = await Promise.all([
        api.get("/shops"),
        api.get("/shops/notes/all")
      ]);
      setShops(shopsRes.data.data || []);
      setNotes(notesRes.data.data || []);
    } catch (err) {
      console.error("Failed to load shop data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveNote = async (shopId: string) => {
    if (!noteText.trim()) return;
    
    try {
      if (editingNoteId) {
        await api.put(`/shops/notes/${editingNoteId}`, { text: noteText.trim() });
      } else {
        await api.post(`/shops/${shopId}/notes`, { text: noteText.trim(), date: new Date().toISOString().split("T")[0] });
      }
      setEditingNoteId(null);
      setNoteText("");
      fetchData(); // Refresh notes
    } catch (err) {
      console.error("Failed to save note", err);
    }
  };

  const startEditNote = (e: React.MouseEvent, note: any, shop: any) => {
    e.stopPropagation();
    setActiveShopForNotes(shop);
    setEditingNoteId(note._id);
    setNoteText(note.text);
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/shops/notes/${noteId}`);
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setNoteText("");
      }
      fetchData();
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this shop?")) {
      try {
        await api.delete(`/shops/${id}`);
        fetchData();
      } catch (err) {
        console.error("Failed to delete shop", err);
      }
    }
  };

  const startEdit = (e: React.MouseEvent, shop: any) => {
    e.stopPropagation();
    setEditingShop(shop._id || 'new');
    setEditFormData({ ...shop });
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingShop(null);
    if (editingShop === 'new') {
      fetchData(); // Reset the temporary new shop if cancelled
    }
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (editingShop === 'new') {
        await api.post('/shops', editFormData);
      } else {
        await api.put(`/shops/${editingShop}`, editFormData);
      }
      setEditingShop(null);
      fetchData();
    } catch (err) {
      console.error("Failed to save shop", err);
    }
  };

  const handleAddShop = () => {
    const newShop = {
      name: "New Shop",
      displayId: "",
      managerName: "",
      phone: "",
      location: "",
    };
    setShops([newShop, ...shops]);
    setEditingShop('new');
    setEditFormData(newShop);
  };

  return (
    <div className="animate-fade-in pb-12 w-full">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Shop Management" }]} />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Shop Management</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Manage offline shops and owners.</p>
          </div>
          <Button onClick={handleAddShop} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 h-11 px-6 rounded-sm shadow-none">
            <Plus className="w-5 h-5" /> Add New Shop
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col h-[60vh] items-center justify-center p-12 text-center text-muted-foreground w-full">
          <Loader2 className="h-12 w-12 animate-spin mb-4 text-primary" />
          <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Shops...</h2>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="mb-8 max-w-none">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search shops by name, ID or location..." 
                className="pl-12 py-3 h-auto text-base rounded-sm border-border shadow-none focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
          </div>
          
          {/* Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop, idx) => (
              <Card key={shop._id || idx} className="border border-border shadow-none hover:bg-card-hover transition-colors rounded-sm overflow-hidden bg-card">
            <CardContent className="p-6">
              
              {/* Card Header (Icon only now) */}
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-primary/10 text-primary rounded-sm">
                  <StoreIcon className="w-5 h-5" />
                </div>
              </div>

              {editingShop === shop._id || (editingShop === 'new' && !shop._id) ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Shop Name</label>
                    <Input 
                      value={editFormData.name} 
                      onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Shop ID</label>
                    <Input 
                      value={editFormData.displayId} 
                      onChange={e => setEditFormData({...editFormData, displayId: e.target.value})} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Manager Name</label>
                    <Input 
                      value={editFormData.managerName} 
                      onChange={e => setEditFormData({...editFormData, managerName: e.target.value})} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
                    <Input 
                      value={editFormData.phone} 
                      onChange={e => setEditFormData({...editFormData, phone: e.target.value})} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Location</label>
                    <Input 
                      value={editFormData.location} 
                      onChange={e => setEditFormData({...editFormData, location: e.target.value})} 
                      className="h-9"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={saveEdit} className="w-full bg-success hover:bg-success/90 text-success-foreground h-10">
                      <Check className="w-4 h-4 mr-2" /> Save
                    </Button>
                    <Button onClick={cancelEdit} variant="outline" className="w-full h-10 text-muted-foreground hover:bg-accent">
                      <XIcon className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Title, ID and Actions (Edit/Delete) parallel to title */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-foreground leading-tight">{shop.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground mt-1">{shop.displayId}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => startEdit(e, shop)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Edit Details"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, shop._id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-sm transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Delete Shop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="space-y-3.5 mb-8">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{shop.managerName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{shop.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{shop.location}</span>
                    </div>
                  </div>

                  {notes.filter((n: any) => n.shopId?._id === shop._id || n.shopId === shop._id).length > 0 && (
                     <div className="space-y-2 mb-6">
                        {notes.filter((n: any) => n.shopId?._id === shop._id || n.shopId === shop._id).map((note: any) => (
                           <div key={note._id} className="flex justify-between items-start gap-2 bg-muted/20 p-2.5 rounded-sm border border-border/50">
                             <p className="text-xs text-foreground line-clamp-2 leading-relaxed flex-1">{note.text}</p>
                             <div className="flex items-center">
                               <button onClick={(e) => startEditNote(e, note, shop)} className="text-muted-foreground hover:text-primary p-0.5 mr-1">
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                               <button onClick={(e) => handleDeleteNote(e, note._id)} className="text-muted-foreground hover:text-destructive p-0.5">
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           </div>
                        ))}
                     </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button 
                       variant="outline"
                       className="w-full h-10 rounded-sm shadow-none font-semibold text-muted-foreground hover:bg-muted/50"
                       onClick={() => { setActiveShopForNotes(shop); setNoteText(""); setEditingNoteId(null); }}
                     >
                      <FileText className="w-4 h-4 mr-2" /> Add Note
                    </Button>
                    <Link to={`/shop/${shop._id}`} className="block w-full">
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 h-11 rounded-sm shadow-none"
                      >
                        <StoreIcon className="w-4 h-4" /> Open Shop
                      </Button>
                    </Link>
                  </div>
                </>
              )}
              
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    )}

      <Dialog open={!!activeShopForNotes} onOpenChange={(open) => {
         if(!open) {
           setActiveShopForNotes(null);
           setEditingNoteId(null);
           setNoteText("");
         }
      }}>
         <DialogContent className="sm:max-w-[425px]">
           <DialogHeader>
             <DialogTitle>{editingNoteId ? "Edit Note" : "Notes"} — {activeShopForNotes?.name}</DialogTitle>
           </DialogHeader>
           <div className="flex flex-col gap-4 py-2">
             <div className="relative">
               <textarea
                 className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-28 resize-none"
                 placeholder="Write a note about this shop..."
                 value={noteText}
                 onChange={(e) => setNoteText(e.target.value.substring(0, 1000))}
               />
               <span className="text-xs text-muted-foreground absolute bottom-2 right-2 font-medium">{noteText.length}/1000</span>
             </div>
             <div className="flex justify-end gap-2">
               <Button variant="outline" onClick={() => { setActiveShopForNotes(null); setEditingNoteId(null); setNoteText(""); }}>Cancel</Button>
               <Button onClick={() => handleSaveNote(activeShopForNotes._id)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                 {editingNoteId ? "Update Note" : "Save Note"}
               </Button>
             </div>
             
             {notes.filter((n: any) => n.shopId?._id === activeShopForNotes?._id || n.shopId === activeShopForNotes?._id).length > 0 && (
               <div className="mt-4 space-y-3 max-h-[250px] overflow-y-auto pr-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Previous Notes</h4>
                  {notes.filter((n: any) => n.shopId?._id === activeShopForNotes?._id || n.shopId === activeShopForNotes?._id).map((note: any) => (
                     <div key={note._id} className="p-3 bg-card rounded-sm border flex justify-between gap-3 shadow-none group">
                       <div className="flex-1">
                         <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                         <p className="text-[10px] text-muted-foreground mt-2 font-bold">{new Date(note.createdAt || note.date).toLocaleDateString()}</p>
                       </div>
                       <div className="flex items-start shrink-0 h-fit mt-1 gap-1">
                         <button onClick={(e) => startEditNote(e, note, activeShopForNotes)} className="text-muted-foreground hover:text-primary p-1 rounded-sm hover:bg-primary/10 transition-colors">
                           <Pencil className="w-4 h-4" />
                         </button>
                         <button onClick={(e) => handleDeleteNote(e, note._id)} className="text-muted-foreground hover:text-destructive p-1 rounded-sm hover:bg-destructive/10 transition-colors">
                           <Trash2 className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                  ))}
               </div>
             )}
           </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
