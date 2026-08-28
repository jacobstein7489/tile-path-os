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
      crews: {
        Row: {
          created_at: string
          id: string
          initials: string
          is_open_lane: boolean
          name: string
          sort_order: number
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          is_open_lane?: boolean
          name: string
          sort_order?: number
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          is_open_lane?: boolean
          name?: string
          sort_order?: number
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_items: {
        Row: {
          area_id: string | null
          category: string
          created_at: string
          damaged_qty: number
          expected_date: string | null
          goes_to: string | null
          id: string
          name: string
          needs_attention: boolean
          next_step: string | null
          notes: string | null
          ordered_qty: number
          project_id: string
          received_qty: number
          required_qty: number | null
          responsibility: string | null
          spec: string | null
          status: string
          supplier: string | null
          surface_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          category?: string
          created_at?: string
          damaged_qty?: number
          expected_date?: string | null
          goes_to?: string | null
          id?: string
          name: string
          needs_attention?: boolean
          next_step?: string | null
          notes?: string | null
          ordered_qty?: number
          project_id: string
          received_qty?: number
          required_qty?: number | null
          responsibility?: string | null
          spec?: string | null
          status?: string
          supplier?: string | null
          surface_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          category?: string
          created_at?: string
          damaged_qty?: number
          expected_date?: string | null
          goes_to?: string | null
          id?: string
          name?: string
          needs_attention?: boolean
          next_step?: string | null
          notes?: string | null
          ordered_qty?: number
          project_id?: string
          received_qty?: number
          required_qty?: number | null
          responsibility?: string | null
          spec?: string | null
          status?: string
          supplier?: string | null
          surface_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_items_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "project_surfaces"
            referencedColumns: ["id"]
          },
        ]
      }
      material_receipts: {
        Row: {
          created_at: string
          damaged_qty: number
          id: string
          material_item_id: string
          notes: string | null
          packing_slip: string | null
          po_id: string | null
          receipt_date: string
          received_by: string | null
          received_qty: number
          wrong_qty: number
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          id?: string
          material_item_id: string
          notes?: string | null
          packing_slip?: string | null
          po_id?: string | null
          receipt_date?: string
          received_by?: string | null
          received_qty?: number
          wrong_qty?: number
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          id?: string
          material_item_id?: string
          notes?: string | null
          packing_slip?: string | null
          po_id?: string | null
          receipt_date?: string
          received_by?: string | null
          received_qty?: number
          wrong_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_receipts_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          material_item_id: string | null
          notes: string | null
          po_id: string
          qty: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          material_item_id?: string | null
          notes?: string | null
          po_id: string
          qty?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          material_item_id?: string | null
          notes?: string | null
          po_id?: string
          qty?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_material_item_id_fkey"
            columns: ["material_item_id"]
            isOneToOne: false
            referencedRelation: "material_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      project_areas: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          progress_pct: number
          project_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          progress_pct?: number
          project_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          progress_pct?: number
          project_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_surfaces: {
        Row: {
          area_id: string
          created_at: string
          detail_confirmed: boolean
          field_sf: number | null
          finish_transition: string | null
          grout_color: string | null
          grout_manufacturer: string | null
          id: string
          joint_size: string | null
          layout_direction: string | null
          layout_pattern: string | null
          manufacturer: string | null
          metal_profile: string | null
          name: string
          notes: string | null
          plan_sf: number | null
          prep: string | null
          progress_pct: number
          sort_order: number
          start_point: string | null
          status: string
          supplier: string | null
          tile_finish: string | null
          tile_height: string | null
          tile_size: string | null
          tile_sku: string | null
          tile_tag: string | null
          underlayment: string | null
          updated_at: string
          waterproofing: string | null
        }
        Insert: {
          area_id: string
          created_at?: string
          detail_confirmed?: boolean
          field_sf?: number | null
          finish_transition?: string | null
          grout_color?: string | null
          grout_manufacturer?: string | null
          id?: string
          joint_size?: string | null
          layout_direction?: string | null
          layout_pattern?: string | null
          manufacturer?: string | null
          metal_profile?: string | null
          name: string
          notes?: string | null
          plan_sf?: number | null
          prep?: string | null
          progress_pct?: number
          sort_order?: number
          start_point?: string | null
          status?: string
          supplier?: string | null
          tile_finish?: string | null
          tile_height?: string | null
          tile_size?: string | null
          tile_sku?: string | null
          tile_tag?: string | null
          underlayment?: string | null
          updated_at?: string
          waterproofing?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string
          detail_confirmed?: boolean
          field_sf?: number | null
          finish_transition?: string | null
          grout_color?: string | null
          grout_manufacturer?: string | null
          id?: string
          joint_size?: string | null
          layout_direction?: string | null
          layout_pattern?: string | null
          manufacturer?: string | null
          metal_profile?: string | null
          name?: string
          notes?: string | null
          plan_sf?: number | null
          prep?: string | null
          progress_pct?: number
          sort_order?: number
          start_point?: string | null
          status?: string
          supplier?: string | null
          tile_finish?: string | null
          tile_height?: string | null
          tile_size?: string | null
          tile_sku?: string | null
          tile_tag?: string | null
          underlayment?: string | null
          updated_at?: string
          waterproofing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_surfaces_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string
          crew_lead: string | null
          customer: string | null
          exception_state: string | null
          id: string
          installation_progress: number
          lifecycle_stage: string
          material_status: string
          name: string
          needs_attention: string | null
          next_move: string | null
          next_move_owner: string | null
          project_manager: string | null
          project_type: string
          readiness_note: string | null
          readiness_pct: number
          stage_steps_done: string[]
          start_date: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          crew_lead?: string | null
          customer?: string | null
          exception_state?: string | null
          id?: string
          installation_progress?: number
          lifecycle_stage?: string
          material_status?: string
          name: string
          needs_attention?: string | null
          next_move?: string | null
          next_move_owner?: string | null
          project_manager?: string | null
          project_type?: string
          readiness_note?: string | null
          readiness_pct?: number
          stage_steps_done?: string[]
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          crew_lead?: string | null
          customer?: string | null
          exception_state?: string | null
          id?: string
          installation_progress?: number
          lifecycle_stage?: string
          material_status?: string
          name?: string
          needs_attention?: string | null
          next_move?: string | null
          next_move_owner?: string | null
          project_manager?: string | null
          project_type?: string
          readiness_note?: string | null
          readiness_pct?: number
          stage_steps_done?: string[]
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          expected_date: string | null
          id: string
          notes: string | null
          po_number: string
          project_id: string | null
          status: string
          supplier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          project_id?: string | null
          status?: string
          supplier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          project_id?: string | null
          status?: string
          supplier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          created_at: string
          crew_id: string | null
          id: string
          kind: string
          notes: string | null
          project_id: string
          span_days: number
          status: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          crew_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          project_id: string
          span_days?: number
          status?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          crew_id?: string | null
          id?: string
          kind?: string
          notes?: string | null
          project_id?: string
          span_days?: number
          status?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          project_id: string
          sort_order: number
          updated_at: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          project_id: string
          sort_order?: number
          updated_at?: string
          visit_date?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          area_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          impact: string | null
          item_type: string
          next_action: string | null
          owner: string | null
          priority: string
          project_id: string
          status: string
          surface_id: string | null
          title: string
          updated_at: string
          waiting_on: string | null
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          item_type: string
          next_action?: string | null
          owner?: string | null
          priority?: string
          project_id: string
          status?: string
          surface_id?: string | null
          title: string
          updated_at?: string
          waiting_on?: string | null
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          item_type?: string
          next_action?: string | null
          owner?: string | null
          priority?: string
          project_id?: string
          status?: string
          surface_id?: string | null
          title?: string
          updated_at?: string
          waiting_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "project_surfaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
