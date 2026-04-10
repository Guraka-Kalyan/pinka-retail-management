import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Shield, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";

interface AppUser {
  id: string;
  _id?: string;
  name: string;
  username: string;
  role: string;
}

export default function Profile() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Current user from localStorage
  const storedUser: AppUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("pinaka_user") || "{}");
    } catch {
      return { id: "", name: "", username: "", role: "Staff" };
    }
  })();

  const [currentUser, setCurrentUser] = useState<AppUser>(storedUser);
  const isAdmin = currentUser.role === "Admin";

  // Change Password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);

  // Create User (Admin only)
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newRole, setNewRole] = useState("Staff");
  const [isCreating, setIsCreating] = useState(false);

  // Users list (Admin only)
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      setIsLoadingUsers(true);
      const res = await api.get("/auth/users");
      setUsers(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch fresh user info from server
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get("/auth/me");
        if (res.data.user) {
          setCurrentUser(res.data.user);
          // Also update localStorage so navbar shows correct initials
          const stored = JSON.parse(localStorage.getItem("pinaka_user") || "{}");
          localStorage.setItem("pinaka_user", JSON.stringify({ ...stored, ...res.data.user }));
        }
      } catch {/* ignore */}
    };
    fetchMe();
    fetchUsers();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) {
      toast({ title: "Missing Fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPass !== confirmPass) {
      toast({ title: "Mismatch", description: "New password and confirm password do not match.", variant: "destructive" });
      return;
    }
    if (newPass.length < 6) {
      toast({ title: "Too Short", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    try {
      setIsSavingPass(true);
      await api.put("/auth/change-password", { currentPassword: currentPass, newPassword: newPass });
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to update password.", variant: "destructive" });
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newName || !newUserPass) {
      toast({ title: "Missing Fields", description: "Name and password are required.", variant: "destructive" });
      return;
    }
    try {
      setIsCreating(true);
      await api.post("/auth/register", { name: newName, username: newUsername || newName, password: newUserPass, role: newRole });
      toast({ title: "User Created", description: `${newName} has been added as ${newRole}.` });
      setNewName(""); setNewUsername(""); setNewUserPass(""); setNewRole("Staff");
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to create user.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await api.delete(`/auth/users/${userId}`);
      toast({ title: "Deleted", description: `${userName} removed.` });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to delete user.", variant: "destructive" });
    }
  };

  return (
    <div className="animate-fade-in pb-12 w-full max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 mb-8">
        <Breadcrumb items={[{ label: "Profile" }]} />
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage your account and settings.</p>
        </div>
      </div>

      {/* ── My Account ────────────────────────────────── */}
      <div className="bg-card rounded-sm border border-border shadow-none mb-6">
        <div className="px-6 py-4 border-b" style={{ backgroundColor: "var(--table-header)" }}>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>My Account</h2>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Name</p>
            <p className="text-base font-bold text-foreground">{currentUser.name || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Username</p>
            <p className="text-base font-bold text-foreground">{currentUser.username || currentUser.name || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Role</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${
              currentUser.role === "Admin"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              <Shield className="w-3 h-3" />
              {currentUser.role || "Staff"}
            </span>
          </div>
        </div>

        {/* Change Password */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Change Password</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 pr-10 font-medium"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-11 pr-10 font-medium"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                className={`h-11 font-medium ${confirmPass && confirmPass !== newPass ? "border-destructive" : ""}`}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
              />
              {confirmPass && confirmPass !== newPass && (
                <p className="text-xs text-destructive font-medium">Passwords do not match</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={isSavingPass}
            className="bg-primary hover:bg-primary/80 text-white font-bold shadow-none rounded-sm h-10 px-6"
          >
            {isSavingPass ? "Saving..." : "Update Password"}
          </Button>
        </div>
      </div>

      {/* ── User Management (Admin Only) ───────────────── */}
      {isAdmin && (
        <div className="bg-card rounded-sm border border-border shadow-none">
          <div className="px-6 py-4 border-b" style={{ backgroundColor: "var(--table-header)" }}>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>User Management</h2>
              <span className="ml-auto text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">Admin Only</span>
            </div>
          </div>

          {/* Create User Form */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Create New User</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name *</Label>
                <Input
                  placeholder="Full Name"
                  className="h-10 font-medium"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</Label>
                <Input
                  placeholder="Login username"
                  className="h-10 font-medium"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password *</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="h-10 font-medium"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-10 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreateUser}
              disabled={isCreating}
              className="bg-primary hover:bg-primary/80 text-white font-bold shadow-none rounded-sm h-10 px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isCreating ? "Creating..." : "Create User"}
            </Button>
          </div>

          {/* Users Table */}
          <div className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4">All Users</h3>
            {isLoadingUsers ? (
              <p className="text-muted-foreground text-sm py-4">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No users found.</p>
            ) : (
              <div className="rounded-sm border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "var(--table-header)" }}>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</th>
                      <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</th>
                      <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => {
                      const uid = u._id || u.id;
                      const isSelf = uid === currentUser.id;
                      return (
                        <tr
                          key={uid}
                          className="border-t border-border transition-colors"
                          style={{ backgroundColor: i % 2 === 0 ? "var(--table-row-1)" : "var(--table-row-2)" }}
                        >
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {u.name}
                            {isSelf && (
                              <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">You</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.username || u.name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wider ${
                              u.role === "Admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(uid, u.name)}
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
