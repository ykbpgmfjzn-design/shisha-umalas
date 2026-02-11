import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  Shield, Users, Search, Crown, Building2, User,
  Wind, Calculator, ChevronDown, UserCircle, Footprints
} from "lucide-react";
import { normalizeCustomerName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/hooks/useProfile";
import type { UserRole, PurchaseWithProfile } from "@/hooks/useAdmin";
import type { Database } from "@/integrations/supabase/types";
import { logActivity } from "@/hooks/useActivityLog";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UsersTableProps {
  profiles: Profile[];
  userRoles: UserRole[];
  purchases?: PurchaseWithProfile[];
  onSelectUser: (user: Profile) => void;
  selectedUserId?: string;
  onToggleAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
  onAddRole?: (userId: string, role: AppRole) => Promise<void>;
  onRemoveRole?: (userId: string, role: AppRole) => Promise<void>;
  filterMode?: "staff" | "customers";
  t?: (key: string) => string;
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Crown; color: string; bgColor: string }> = {
  owner: { label: "Owner", icon: Crown, color: "text-golden", bgColor: "bg-golden/20 border-golden" },
  admin: { label: "Admin", icon: Shield, color: "text-red-400", bgColor: "bg-red-500/20 border-red-400" },
  user: { label: "Guest", icon: UserCircle, color: "text-green-400", bgColor: "bg-green-500/20 border-green-400" },
  shisha_master: { label: "Shisha Master", icon: Wind, color: "text-purple-400", bgColor: "bg-purple-500/20 border-purple-400" },
  accounting: { label: "Accounting", icon: Calculator, color: "text-blue-400", bgColor: "bg-blue-500/20 border-blue-400" },
};

const UsersTable = ({ 
  profiles, 
  userRoles, 
  purchases = [],
  onSelectUser, 
  selectedUserId,
  onToggleAdmin,
  onAddRole,
  onRemoveRole,
  filterMode,
  t,
}: UsersTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const getUserRoles = (userId: string): AppRole[] => {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const getStaffDisplayName = (userId: string): string | null => {
    const role = userRoles.find(r => r.user_id === userId && r.display_name);
    return role?.display_name || null;
  };

  const hasRole = (userId: string, role: AppRole) => {
    return userRoles.some(r => r.user_id === userId && r.role === role);
  };

  const STAFF_ROLES: AppRole[] = ["admin", "owner", "shisha_master", "accounting"];

  // Build walk-in pseudo-profiles from purchases with no user_id
  const walkinProfiles = useMemo(() => {
    if (filterMode !== "customers") return [];
    const walkinMap = new Map<string, Profile>();
    for (const p of purchases) {
      if (p.user_id) continue; // has a registered account
      const name = p.customer_name;
      if (!name) continue;
      const key = normalizeCustomerName(name);
      if (walkinMap.has(key)) continue;
      walkinMap.set(key, {
        id: `walkin_${key}`,
        email: null,
        full_name: name,
        avatar_url: p.customer_photo_url || null,
        room_number: null,
        phone: null,
        guest_type: "guest",
        total_hookahs_ordered: 0,
        loyalty_level: 0,
        loyalty_points: 0,
        created_at: p.created_at,
        updated_at: p.created_at,
      });
    }
    return Array.from(walkinMap.values());
  }, [purchases, filterMode]);

  // Count orders per customer (registered by user_id, walk-in by normalized name)
  const orderCountMap = useMemo(() => {
    if (filterMode !== "customers") return new Map<string, number>();
    const map = new Map<string, number>();
    for (const p of purchases) {
      if (p.user_id) {
        map.set(p.user_id, (map.get(p.user_id) || 0) + 1);
      } else if (p.customer_name) {
        const key = `walkin_${normalizeCustomerName(p.customer_name)}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return map;
  }, [purchases, filterMode]);

  const filteredProfiles = useMemo(() => {
    const base = filterMode === "customers"
      ? [
          ...profiles.filter(p => {
            const roles = getUserRoles(p.id);
            return !roles.some(r => STAFF_ROLES.includes(r));
          }),
          ...walkinProfiles,
        ]
      : filterMode === "staff"
        ? profiles.filter(p => {
            const roles = getUserRoles(p.id);
            return roles.some(r => STAFF_ROLES.includes(r));
          })
        : profiles;

    if (!searchQuery) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(p =>
      p.email?.toLowerCase().includes(q) ||
      p.full_name?.toLowerCase().includes(q) ||
      p.room_number?.includes(searchQuery)
    );
  }, [profiles, walkinProfiles, userRoles, filterMode, searchQuery]);

  const handleSetRole = async (e: React.MouseEvent, userId: string, newRole: AppRole) => {
    e.stopPropagation();
    setRoleLoading(`${userId}-${newRole}`);
    
    const currentRoles = getUserRoles(userId);
    const userProfile = profiles.find(p => p.id === userId);
    const userEmail = userProfile?.email || 'Unknown';
    
    for (const role of currentRoles) {
      if (role !== newRole) {
        if (role === "admin") {
          await onToggleAdmin(userId, true);
        } else {
          await onRemoveRole?.(userId, role);
        }
        await logActivity('admin', `Role ${ROLE_CONFIG[role]?.label || role} removed`, {
          target_user_id: userId,
          target_user_email: userEmail,
          removed_role: role,
        });
      }
    }
    
    if (!currentRoles.includes(newRole)) {
      if (newRole === "admin") {
        await onToggleAdmin(userId, false);
      } else {
        await onAddRole?.(userId, newRole);
      }
      await logActivity('admin', `Role ${ROLE_CONFIG[newRole]?.label || newRole} assigned`, {
        target_user_id: userId,
        target_user_email: userEmail,
        added_role: newRole,
      });
    }
    
    setRoleLoading(null);
  };

  const getMainRoleIcon = (userId: string) => {
    const roles = getUserRoles(userId);
    if (roles.includes("owner")) return <Crown className="w-4 h-4 text-golden" />;
    if (roles.includes("admin")) return <Shield className="w-4 h-4 text-red-400" />;
    if (roles.includes("shisha_master")) return <Wind className="w-4 h-4 text-purple-400" />;
    if (roles.includes("accounting")) return <Calculator className="w-4 h-4 text-blue-400" />;
    const profile = profiles.find(p => p.id === userId);
    if (profile?.guest_type === "special") return <Building2 className="w-4 h-4 text-golden" />;
    return <User className="w-4 h-4 text-muted-foreground" />;
  };

  const isOwner = (userId: string) => getUserRoles(userId).includes("owner");

  const getMainRoleBg = (userId: string) => {
    const roles = getUserRoles(userId);
    if (roles.includes("owner")) return "bg-golden/20";
    if (roles.includes("admin")) return "bg-red-500/20";
    if (roles.includes("shisha_master")) return "bg-purple-500/20";
    if (roles.includes("accounting")) return "bg-blue-500/20";
    const profile = profiles.find(p => p.id === userId);
    if (profile?.guest_type === "special") return "bg-golden/20";
    return "bg-muted";
  };

  return (
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-6">
        {filterMode === "staff" ? <Shield className="w-5 h-5 text-golden" /> : <Users className="w-5 h-5 text-golden" />}
        <h2 className="font-display text-xl">{filterMode === "staff" ? "Staff" : filterMode === "customers" ? "Customers" : "Users"}</h2>
        <span className="ml-auto text-sm text-muted-foreground">
          {filteredProfiles.length} total
        </span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email, name or room..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50"
        />
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {filteredProfiles.map((profile, index) => {
          const isWalkin = profile.id.startsWith("walkin_");
          const roles = isWalkin ? [] : getUserRoles(profile.id);
          return (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => onSelectUser(profile)}
              className={`w-full text-left p-4 rounded-xl transition-all ${
                selectedUserId === profile.id
                  ? "bg-golden/20 border border-golden/30"
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {profile.avatar_url ? (
                    <img
                      loading="lazy" src={profile.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
                    />
                   ) : isWalkin ? (
                    <div className="p-2 rounded-full shrink-0 bg-muted">
                      <Footprints className="w-4 h-4 text-muted-foreground" />
                    </div>
                   ) : (
                    <div className={`p-2 rounded-full shrink-0 ${getMainRoleBg(profile.id)}`}>
                      {getMainRoleIcon(profile.id)}
                    </div>
                  )}
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {isWalkin ? profile.full_name || "No name" : (filterMode === "staff" && getStaffDisplayName(profile.id)) || profile.email || "No email"}
                      </p>
                      {isWalkin && (
                        <Badge variant="outline" className="text-xs bg-muted border-border text-muted-foreground">
                          Walk-in
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isWalkin
                        ? "Walk-in customer"
                        : `${profile.room_number ? `Room ${profile.room_number}` : "Guest"} • ${profile.full_name || "No name"}`}
                      {filterMode === "customers" && (
                        <span className="ml-1">• {orderCountMap.get(profile.id) || 0} orders</span>
                      )}
                    </p>
                    {!isWalkin && roles.filter(r => r !== "user" && r !== "owner").length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {roles.filter(r => r !== "user" && r !== "owner").map(role => {
                          const config = ROLE_CONFIG[role];
                          return (
                            <Badge 
                              key={role} 
                              variant="outline" 
                              className={`${config.bgColor} ${config.color} text-xs`}
                            >
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {!isWalkin && (
                    <div className="flex items-center gap-1 text-golden">
                      <Crown className="w-4 h-4" />
                      <span className="text-sm font-bold">{profile.loyalty_level}</span>
                    </div>
                  )}

                  {isWalkin ? (
                    <Badge variant="outline" className="text-xs bg-muted border-border text-muted-foreground">
                      <Footprints className="w-3 h-3 mr-1" />
                      Walk-in
                    </Badge>
                  ) : !isOwner(profile.id) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="shrink-0 gap-1">
                          <Shield className="w-3 h-3" />
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Manage Roles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(Object.keys(ROLE_CONFIG) as AppRole[]).filter(role => role !== "owner").map(role => {
                          const config = ROLE_CONFIG[role];
                          const Icon = config.icon;
                          const currentRoles = getUserRoles(profile.id);
                          const isActive = currentRoles.includes(role) && currentRoles.length === 1;
                          const isLoading = roleLoading === `${profile.id}-${role}`;
                          
                          return (
                            <DropdownMenuItem
                              key={role}
                              onClick={(e) => handleSetRole(e, profile.id, role)}
                              disabled={isLoading}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${config.color}`} />
                                  <span>{config.label}</span>
                                </div>
                                {isActive && (
                                  <Badge variant="secondary" className="text-xs">✓</Badge>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge variant="outline" className="bg-golden/20 border-golden text-golden">
                      Owner
                    </Badge>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        {filteredProfiles.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No users found
          </p>
        )}
      </div>
    </div>
  );
};

export default UsersTable;
