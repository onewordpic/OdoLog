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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_summaries: {
        Row: {
          created_at: string
          id: string
          month: string
          payload: Json
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          payload: Json
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          payload?: Json
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          expires_at: string
          refresh_token: string
          scope: string | null
          sync_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          expires_at: string
          refresh_token: string
          scope?: string | null
          sync_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          expires_at?: string
          refresh_token?: string
          scope?: string | null
          sync_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          condition: string | null
          cost_inr: number | null
          created_at: string
          id: string
          next_service_date: string | null
          next_service_odo_km: number | null
          notes: string | null
          odo_km: number | null
          service_date: string
          service_type: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          condition?: string | null
          cost_inr?: number | null
          created_at?: string
          id?: string
          next_service_date?: string | null
          next_service_odo_km?: number | null
          notes?: string | null
          odo_km?: number | null
          service_date?: string
          service_type: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          condition?: string | null
          cost_inr?: number | null
          created_at?: string
          id?: string
          next_service_date?: string | null
          next_service_odo_km?: number | null
          notes?: string | null
          odo_km?: number | null
          service_date?: string
          service_type?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      perf_samples: {
        Row: {
          app_version: string | null
          connection: string | null
          created_at: string
          device: string | null
          fcp_ms: number | null
          hydration_ms: number | null
          id: string
          lcp_ms: number | null
          route: string
          route_load_ms: number | null
          slow_resources: Json
          total_ms: number | null
          ttfb_ms: number | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          connection?: string | null
          created_at?: string
          device?: string | null
          fcp_ms?: number | null
          hydration_ms?: number | null
          id?: string
          lcp_ms?: number | null
          route: string
          route_load_ms?: number | null
          slow_resources?: Json
          total_ms?: number | null
          ttfb_ms?: number | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          connection?: string | null
          created_at?: string
          device?: string | null
          fcp_ms?: number | null
          hydration_ms?: number | null
          id?: string
          lcp_ms?: number | null
          route?: string
          route_load_ms?: number | null
          slow_resources?: Json
          total_ms?: number | null
          ttfb_ms?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_city: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_city?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_city?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      refuels: {
        Row: {
          amount_inr: number
          created_at: string
          fuel_brand: string | null
          fuel_subtype: string | null
          full_tank: boolean
          id: string
          litres: number
          notes: string | null
          odo_km: number | null
          rate_per_litre: number
          refuel_date: string
          reserve_km: number | null
          reserve_switch_odo_km: number | null
          tank_state: string | null
          tank_state_after: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          fuel_brand?: string | null
          fuel_subtype?: string | null
          full_tank?: boolean
          id?: string
          litres: number
          notes?: string | null
          odo_km?: number | null
          rate_per_litre: number
          refuel_date?: string
          reserve_km?: number | null
          reserve_switch_odo_km?: number | null
          tank_state?: string | null
          tank_state_after?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          fuel_brand?: string | null
          fuel_subtype?: string | null
          full_tank?: boolean
          id?: string
          litres?: number
          notes?: string | null
          odo_km?: number | null
          rate_per_litre?: number
          refuel_date?: string
          reserve_km?: number | null
          reserve_switch_odo_km?: number | null
          tank_state?: string | null
          tank_state_after?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refuels_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          end_odo_km: number | null
          id: string
          notes: string | null
          purpose: string | null
          start_odo_km: number | null
          tolls_inr: number | null
          trip_date: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          end_odo_km?: number | null
          id?: string
          notes?: string | null
          purpose?: string | null
          start_odo_km?: number | null
          tolls_inr?: number | null
          trip_date?: string
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          end_odo_km?: number | null
          id?: string
          notes?: string | null
          purpose?: string | null
          start_odo_km?: number | null
          tolls_inr?: number | null
          trip_date?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          has_reserve: boolean
          icon: string
          id: string
          image_url: string | null
          insurance_expiry: string | null
          is_guest: boolean
          make: string | null
          model_year: number | null
          name: string
          owner_name: string | null
          puc_expiry: string | null
          purchase_date: string | null
          purchase_price_inr: number | null
          reg_number: string | null
          reserve_litres: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          has_reserve?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          is_guest?: boolean
          make?: string | null
          model_year?: number | null
          name: string
          owner_name?: string | null
          puc_expiry?: string | null
          purchase_date?: string | null
          purchase_price_inr?: number | null
          reg_number?: string | null
          reserve_litres?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          has_reserve?: boolean
          icon?: string
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          is_guest?: boolean
          make?: string | null
          model_year?: number | null
          name?: string
          owner_name?: string | null
          puc_expiry?: string | null
          purchase_date?: string | null
          purchase_price_inr?: number | null
          reg_number?: string | null
          reserve_litres?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      fuel_type: "petrol" | "diesel" | "cng" | "electric"
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
      fuel_type: ["petrol", "diesel", "cng", "electric"],
    },
  },
} as const
