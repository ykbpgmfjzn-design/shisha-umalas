import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Shield, Users, Search, Crown, Building2, User,
  ShieldCheck, ShieldX, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/hooks/useProfile";
import type { UserRole } from "@/hooks/useAdmin";

interface UsersTableProps {
  profiles: Profile[];
  userRoles: UserRole[];
  onSelectUser: (user: Profile) => void;
  selectedUserId?: string;
  onToggleAdmin: (userId: string, isAdmin: boolean) => Promise<void>;
}

const UsersTable = ({ 
  profiles, 
  userRoles, 
  onSelectUser, 
  selectedUserId,
  onToggleAdmin 
}: UsersTableProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  const isUserAdmin = (userId: string) => {
    return userRoles.some(r => r.user_id === userId && r.role === "admin");
  };

  const filteredProfiles = profiles.filter(p => 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.room_number?.includes(searchQuery)
  );

  const handleToggleAdmin = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setRoleLoading(userId);
    await onToggleAdmin(userId, isUserAdmin(userId));
    setRoleLoading(null);
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
          const isAdmin = isUserAdmin(profile.id);
          
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
                  <div className={`p-2 rounded-full shrink-0 ${
                    isAdmin 
                      ? "bg-red-500/20" 
                      : profile.guest_type === "special" 
                        ? "bg-golden/20" 
                        : "bg-muted"
                  }`}>
                    {isAdmin ? (
                      <Shield className="w-4 h-4 text-red-400" />
                    ) : profile.guest_type === "special" ? (
                      <Building2 className="w-4 h-4 text-golden" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {profile.email || "Без email"}
                      </p>
                      {isAdmin && (
                        <Badge variant="outline" className="border-red-400 text-red-400 text-xs shrink-0">
                          Админ
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profile.room_number ? `Комната ${profile.room_number}` : "Гость"} • 
                      {profile.full_name || "Без имени"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Loyalty Level */}
                  <div className="flex items-center gap-1 text-golden">
                    <Crown className="w-4 h-4" />
                    <span className="text-sm font-bold">{profile.loyalty_level}</span>
                  </div>

                  {/* Toggle Admin Button */}
                  <Button
                    size="sm"
                    variant={isAdmin ? "destructive" : "outline"}
                    className="shrink-0"
                    disabled={roleLoading === profile.id}
                    onClick={(e) => handleToggleAdmin(e, profile.id)}
                  >
                    {isAdmin ? (
                      <ShieldX className="w-3 h-3" />
                    ) : (
                      <ShieldCheck className="w-3 h-3" />
                    )}
                  </Button>
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
