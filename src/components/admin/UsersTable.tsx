import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Shield, Users, Search, Crown, Building2, User,
  Wind, Calculator, ChevronDown, UserCircle
} from "lucide-react";
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
import type { UserRole } from "@/hooks/useAdmin";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UsersTableProps {
  profiles: Profile[];
  userRoles: UserRole[];
  onSelectUser: (user: Profile) => void;
  selectedUserId?: string;
  onToggleAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
  onAddRole?: (userId: string, role: AppRole) => Promise<void>;
  onRemoveRole?: (userId: string, role: AppRole) => Promise<void>;
  t?: (key: string) => string;
}

const getRoleConfig = (t?: (key: string) => string) => ({
  owner: { 
    labelKey: "role.owner",
    label: t ? t("role.owner") : "Owner", 
    icon: Crown, 
    color: "text-golden", 
    bgColor: "bg-golden/20 border-golden" 
  },
  admin: { 
    labelKey: "role.admin",
    label: t ? t("role.admin") : "Admin", 
    icon: Shield, 
    color: "text-red-400", 
    bgColor: "bg-red-500/20 border-red-400" 
  },
  user: { 
    labelKey: "role.guest",
    label: t ? t("role.guest") : "Guest", 
    icon: UserCircle, 
    color: "text-green-400", 
    bgColor: "bg-green-500/20 border-green-400" 
  },
  shisha_master: { 
    labelKey: "role.shishaMaster",
    label: t ? t("role.shishaMaster") : "Shisha Master", 
    icon: Wind, 
    color: "text-purple-400", 
    bgColor: "bg-purple-500/20 border-purple-400" 
  },
  accounting: { 
    labelKey: "role.accounting",
    label: t ? t("role.accounting") : "Accounting", 
    icon: Calculator, 
    color: "text-blue-400", 
    bgColor: "bg-blue-500/20 border-blue-400" 
  },
});

const UsersTable = ({ 
  profiles, 
  userRoles, 
  onSelectUser, 
  selectedUserId,
  onToggleAdmin,
  onAddRole,
  onRemoveRole,
  t,
}: UsersTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  
  const ROLE_CONFIG = getRoleConfig(t);

  const getUserRoles = (userId: string): AppRole[] => {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const hasRole = (userId: string, role: AppRole) => {
    return userRoles.some(r => r.user_id === userId && r.role === role);
  };

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.room_number?.includes(searchQuery)
  );

  const handleSetRole = async (e: React.MouseEvent, userId: string, newRole: AppRole) => {
    e.stopPropagation();
    setRoleLoading(`${userId}-${newRole}`);
    
    const currentRoles = getUserRoles(userId);
    
    // Remove all current roles except the new one
    for (const role of currentRoles) {
      if (role !== newRole) {
        if (role === "admin") {
          await onToggleAdmin(userId, true);
        } else {
          await onRemoveRole?.(userId, role);
        }
      }
    }
    
    // Add new role if not already present
    if (!currentRoles.includes(newRole)) {
      if (newRole === "admin") {
        await onToggleAdmin(userId, false);
      } else {
        await onAddRole?.(userId, newRole);
      }
    }
    
    setRoleLoading(null);
  };

  const getMainRoleIcon = (userId: string) => {
    const roles = getUserRoles(userId);
    if (roles.includes("owner")) {
      return <Crown className="w-4 h-4 text-golden" />;
    }
    if (roles.includes("admin")) {
      return <Shield className="w-4 h-4 text-red-400" />;
    }
    if (roles.includes("shisha_master")) {
      return <Wind className="w-4 h-4 text-purple-400" />;
    }
    if (roles.includes("accounting")) {
      return <Calculator className="w-4 h-4 text-blue-400" />;
    }
    const profile = profiles.find(p => p.id === userId);
    if (profile?.guest_type === "special") {
      return <Building2 className="w-4 h-4 text-golden" />;
    }
    return <User className="w-4 h-4 text-muted-foreground" />;
  };

  const isOwner = (userId: string) => {
    return getUserRoles(userId).includes("owner");
  };

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
    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-5 h-5 text-golden" />
        <h2 className="font-display text-xl">Пользователи</h2>
        <span className="ml-auto text-sm text-muted-foreground">
          {profiles.length} всего
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по email, имени или комнате..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-background/50"
        />
      </div>

      {/* User List */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {filteredProfiles.map((profile, index) => {
          const roles = getUserRoles(profile.id);
          
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
                  {/* Role/Type Icon */}
                  <div className={`p-2 rounded-full shrink-0 ${getMainRoleBg(profile.id)}`}>
                    {getMainRoleIcon(profile.id)}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {profile.email || "Без email"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profile.room_number ? `Комната ${profile.room_number}` : "Гость"} • 
                      {profile.full_name || "Без имени"}
                    </p>
                    {/* Role Badges */}
                    {roles.filter(r => r !== "user").length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {roles.filter(r => r !== "user").map(role => {
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
                  {/* Loyalty Level */}
                  <div className="flex items-center gap-1 text-golden">
                    <Crown className="w-4 h-4" />
                    <span className="text-sm font-bold">{profile.loyalty_level}</span>
                  </div>

                  {/* Roles Dropdown - hidden for owners */}
                  {!isOwner(profile.id) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1"
                        >
                          <Shield className="w-3 h-3" />
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>{t ? t("admin.manageRoles") : "Manage Roles"}</DropdownMenuLabel>
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
                                  <Badge variant="secondary" className="text-xs">
                                    ✓
                                  </Badge>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            </motion.button>
          );
        })}

        {filteredProfiles.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Пользователи не найдены
          </p>
        )}
      </div>
    </div>
  );
};

export default UsersTable;
