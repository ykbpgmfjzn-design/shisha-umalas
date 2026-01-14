export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rating: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rating: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_levels: {
        Row: {
          discount_percent: number
          free_drink: boolean
          free_snack: boolean
          hookahs_required: number
          level: number
          name_en: string
          name_ru: string
          special_bonus: string | null
        }
        Insert: {
          discount_percent: number
          free_drink?: boolean
          free_snack?: boolean
          hookahs_required: number
          level: number
          name_en: string
          name_ru: string
          special_bonus?: string | null
        }
        Update: {
          discount_percent?: number
          free_drink?: boolean
          free_snack?: boolean
          hookahs_required?: number
          level?: number
          name_en?: string
          name_ru?: string
          special_bonus?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          guest_type: Database["public"]["Enums"]["guest_type"]
          id: string
          loyalty_level: number
          loyalty_points: number
          room_number: string | null
          total_hookahs_ordered: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          guest_type?: Database["public"]["Enums"]["guest_type"]
          id: string
          loyalty_level?: number
          loyalty_points?: number
          room_number?: string | null
          total_hookahs_ordered?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          guest_type?: Database["public"]["Enums"]["guest_type"]
          id?: string
          loyalty_level?: number
          loyalty_points?: number
          room_number?: string | null
          total_hookahs_ordered?: number
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number | null
          created_at: string
          discount_applied: number | null
          free_drink_used: boolean | null
          free_snack_used: boolean | null
          hookah_count: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_status: string | null
          telegram_chat_id: number | null
          telegram_message_id: number | null
          user_id: string
          xendit_invoice_id: string | null
          xendit_invoice_url: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          discount_applied?: number | null
          free_drink_used?: boolean | null
          free_snack_used?: boolean | null
          hookah_count?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          user_id: string
          xendit_invoice_id?: string | null
          xendit_invoice_url?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          discount_applied?: number | null
          free_drink_used?: boolean | null
          free_snack_used?: boolean | null
          hookah_count?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          user_id?: string
          xendit_invoice_id?: string | null
          xendit_invoice_url?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          activity_log_id: string | null
          created_at: string
          hookah_count: number
          id: string
          location: string | null
          notes: string | null
          party_size: number
          phone: string
          reservation_date: string
          reservation_time: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_log_id?: string | null
          created_at?: string
          hookah_count?: number
          id?: string
          location?: string | null
          notes?: string | null
          party_size?: number
          phone: string
          reservation_date: string
          reservation_time: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_log_id?: string | null
          created_at?: string
          hookah_count?: number
          id?: string
          location?: string | null
          notes?: string | null
          party_size?: number
          phone?: string
          reservation_date?: string
          reservation_time?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_materials: {
        Row: {
          created_at: string
          description: string | null
          file_type: string
          file_url: string
          id: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type: string
          file_url: string
          id?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string
          file_url?: string
          id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: {
          _action: string
          _activity_type: Database["public"]["Enums"]["activity_type"]
          _details?: Json
        }
        Returns: string
      }
    }
    Enums: {
      activity_type:
        | "auth"
        | "order"
        | "payment"
        | "profile"
        | "admin"
        | "feedback"
        | "reservation"
      app_role: "admin" | "user" | "shisha_master" | "accounting" | "owner"
      guest_type: "guest" | "special"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "auth",
        "order",
        "payment",
        "profile",
        "admin",
        "feedback",
        "reservation",
      ],
      app_role: ["admin", "user", "shisha_master", "accounting", "owner"],
      guest_type: ["guest", "special"],
    },
  },
} as const
