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
      application_bootstrap: {
        Row: {
          administrator_bootstrapped_at: string | null
          singleton: boolean
        }
        Insert: {
          administrator_bootstrapped_at?: string | null
          singleton?: boolean
        }
        Update: {
          administrator_bootstrapped_at?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          kind: string
          notes: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          kind?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          kind?: string
          notes?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          capacity_per_day: number | null
          company_id: string | null
          created_at: string
          id: string
          initials: string
          is_active: boolean
          is_open_lane: boolean
          lead_contact_id: string | null
          lead_user_id: string | null
          name: string
          sort_order: number
          tone: string
          updated_at: string
        }
        Insert: {
          capacity_per_day?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          is_open_lane?: boolean
          lead_contact_id?: string | null
          lead_user_id?: string | null
          name: string
          sort_order?: number
          tone?: string
          updated_at?: string
        }
        Update: {
          capacity_per_day?: number | null
          company_id?: string | null
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          is_open_lane?: boolean
          lead_contact_id?: string | null
          lead_user_id?: string | null
          name?: string
          sort_order?: number
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_lead_contact_id_fkey"
            columns: ["lead_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      material_items: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      profiles: {
        Row: {
          avatar_tone: string
          created_at: string
          default_commission_rate: number
          default_route: string
          email: string | null
          full_name: string
          initials: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_tone?: string
          created_at?: string
          default_commission_rate?: number
          default_route?: string
          email?: string | null
          full_name?: string
          initials?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_tone?: string
          created_at?: string
          default_commission_rate?: number
          default_route?: string
          email?: string | null
          full_name?: string
          initials?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_areas: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      project_assignments: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role_in_project: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role_in_project: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role_in_project?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          area_id: string | null
          caption: string | null
          created_at: string
          filename: string
          id: string
          kind: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string
          surface_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          area_id?: string | null
          caption?: string | null
          created_at?: string
          filename: string
          id?: string
          kind?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path: string
          surface_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          area_id?: string | null
          caption?: string | null
          created_at?: string
          filename?: string
          id?: string
          kind?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string
          surface_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "project_surfaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_participants: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          project_id: string
          role_in_project: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id: string
          role_in_project: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          project_id?: string
          role_in_project?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_participants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_surfaces: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
          archived_at: string | null
          awarded_at: string | null
          bid_due_date: string | null
          commission_rate_override: number | null
          commission_rule_ref: string | null
          commission_status: string
          commission_user_id: string | null
          commissionable_amount: number | null
          commissionable_source: string
          created_at: string
          created_by: string | null
          crew_lead: string | null
          customer: string | null
          customer_company_id: string | null
          estimator_user_id: string | null
          exception_state: string | null
          follow_up_date: string | null
          gc_company_id: string | null
          id: string
          installation_progress: number
          intake_notes: string | null
          job_number: string | null
          lifecycle_stage: string
          material_status: string
          name: string
          needs_attention: string | null
          next_move: string | null
          next_move_owner: string | null
          pm_user_id: string | null
          primary_contact_id: string | null
          project_manager: string | null
          project_type: string
          readiness_note: string | null
          readiness_pct: number
          salesperson_user_id: string | null
          site_manager_user_id: string | null
          source: string | null
          stage_steps_done: string[]
          start_date: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          awarded_at?: string | null
          bid_due_date?: string | null
          commission_rate_override?: number | null
          commission_rule_ref?: string | null
          commission_status?: string
          commission_user_id?: string | null
          commissionable_amount?: number | null
          commissionable_source?: string
          created_at?: string
          created_by?: string | null
          crew_lead?: string | null
          customer?: string | null
          customer_company_id?: string | null
          estimator_user_id?: string | null
          exception_state?: string | null
          follow_up_date?: string | null
          gc_company_id?: string | null
          id?: string
          installation_progress?: number
          intake_notes?: string | null
          job_number?: string | null
          lifecycle_stage?: string
          material_status?: string
          name: string
          needs_attention?: string | null
          next_move?: string | null
          next_move_owner?: string | null
          pm_user_id?: string | null
          primary_contact_id?: string | null
          project_manager?: string | null
          project_type?: string
          readiness_note?: string | null
          readiness_pct?: number
          salesperson_user_id?: string | null
          site_manager_user_id?: string | null
          source?: string | null
          stage_steps_done?: string[]
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          awarded_at?: string | null
          bid_due_date?: string | null
          commission_rate_override?: number | null
          commission_rule_ref?: string | null
          commission_status?: string
          commission_user_id?: string | null
          commissionable_amount?: number | null
          commissionable_source?: string
          created_at?: string
          created_by?: string | null
          crew_lead?: string | null
          customer?: string | null
          customer_company_id?: string | null
          estimator_user_id?: string | null
          exception_state?: string | null
          follow_up_date?: string | null
          gc_company_id?: string | null
          id?: string
          installation_progress?: number
          intake_notes?: string | null
          job_number?: string | null
          lifecycle_stage?: string
          material_status?: string
          name?: string
          needs_attention?: string | null
          next_move?: string | null
          next_move_owner?: string | null
          pm_user_id?: string | null
          primary_contact_id?: string | null
          project_manager?: string | null
          project_type?: string
          readiness_note?: string | null
          readiness_pct?: number
          salesperson_user_id?: string | null
          site_manager_user_id?: string | null
          source?: string | null
          stage_steps_done?: string[]
          start_date?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_company_id_fkey"
            columns: ["customer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_gc_company_id_fkey"
            columns: ["gc_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      work_item_events: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          kind: string
          message: string
          work_item_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          work_item_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          area_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          impact: string | null
          item_type: string
          next_action: string | null
          owner: string | null
          owner_user_id: string | null
          priority: string
          project_id: string
          status: string
          surface_id: string | null
          title: string
          updated_at: string
          waiting_on: string | null
          waiting_on_company_id: string | null
          waiting_on_contact_id: string | null
          waiting_on_user_id: string | null
          workflow_step: string | null
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          item_type: string
          next_action?: string | null
          owner?: string | null
          owner_user_id?: string | null
          priority?: string
          project_id: string
          status?: string
          surface_id?: string | null
          title: string
          updated_at?: string
          waiting_on?: string | null
          waiting_on_company_id?: string | null
          waiting_on_contact_id?: string | null
          waiting_on_user_id?: string | null
          workflow_step?: string | null
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          item_type?: string
          next_action?: string | null
          owner?: string | null
          owner_user_id?: string | null
          priority?: string
          project_id?: string
          status?: string
          surface_id?: string | null
          title?: string
          updated_at?: string
          waiting_on?: string | null
          waiting_on_company_id?: string | null
          waiting_on_contact_id?: string | null
          waiting_on_user_id?: string | null
          workflow_step?: string | null
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
          {
            foreignKeyName: "work_items_waiting_on_company_id_fkey"
            columns: ["waiting_on_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_waiting_on_contact_id_fkey"
            columns: ["waiting_on_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_project_path: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_admin_data: { Args: { _user_id: string }; Returns: boolean }
      can_edit_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_field_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_operator: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "gm"
        | "sales"
        | "estimator"
        | "pm"
        | "site_manager"
        | "office_coordinator"
        | "accounting"
        | "installer"
        | "viewer"
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
      app_role: [
        "admin",
        "gm",
        "sales",
        "estimator",
        "pm",
        "site_manager",
        "office_coordinator",
        "accounting",
        "installer",
        "viewer",
      ],
    },
  },
} as const
