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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_name: string
          changed_by_role: string
          correction_reason: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name: string
          changed_by_role: string
          correction_reason?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string
          changed_by_role?: string
          correction_reason?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bom_items: {
        Row: {
          bom_id: number
          id: number
          inventory_item_id: number
          planned_quantity: number
        }
        Insert: {
          bom_id: number
          id?: never
          inventory_item_id: number
          planned_quantity: number
        }
        Update: {
          bom_id?: number
          id?: never
          inventory_item_id?: number
          planned_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "material_stock"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "bom_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_register"
            referencedColumns: ["inventory_item_id"]
          },
        ]
      }
      boms: {
        Row: {
          created_at: string
          expected_output: number
          id: number
          is_active: boolean
          product_id: number
          version: number
        }
        Insert: {
          created_at?: string
          expected_output: number
          id?: never
          is_active?: boolean
          product_id: number
          version?: number
        }
        Update: {
          created_at?: string
          expected_output?: number
          id?: never
          is_active?: boolean
          product_id?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "boms_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          company_name: string
          email: string | null
          gstin: string | null
          id: number
          payment_terms_days: number
          phone: string | null
          pincode: string | null
          state: string
          state_code: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name: string
          email?: string | null
          gstin?: string | null
          id?: number
          payment_terms_days?: number
          phone?: string | null
          pincode?: string | null
          state?: string
          state_code?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string
          email?: string | null
          gstin?: string | null
          id?: number
          payment_terms_days?: number
          phone?: string | null
          pincode?: string | null
          state?: string
          state_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_note_counters: {
        Row: {
          financial_year: string
          last_number: number
        }
        Insert: {
          financial_year: string
          last_number?: number
        }
        Update: {
          financial_year?: string
          last_number?: number
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          cgst_amount: number
          credit_note_id: number
          gst_rate: number
          hsn_code: string | null
          id: number
          igst_amount: number
          invoice_item_id: number
          product_id: number
          product_name: string
          quantity: number
          sgst_amount: number
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          cgst_amount?: number
          credit_note_id: number
          gst_rate: number
          hsn_code?: string | null
          id?: never
          igst_amount?: number
          invoice_item_id: number
          product_id: number
          product_name: string
          quantity: number
          sgst_amount?: number
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Update: {
          cgst_amount?: number
          credit_note_id?: number
          gst_rate?: number
          hsn_code?: string | null
          id?: never
          igst_amount?: number
          invoice_item_id?: number
          product_id?: number
          product_name?: string
          quantity?: number
          sgst_amount?: number
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_note_register"
            referencedColumns: ["credit_note_id"]
          },
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          cgst_amount: number
          created_at: string
          created_by: string
          credit_note_date: string
          credit_note_number: string
          id: number
          igst_amount: number
          invoice_id: number
          reason: string
          sgst_amount: number
          taxable_amount: number
          total_amount: number
        }
        Insert: {
          cgst_amount?: number
          created_at?: string
          created_by: string
          credit_note_date?: string
          credit_note_number: string
          id?: never
          igst_amount?: number
          invoice_id: number
          reason: string
          sgst_amount?: number
          taxable_amount: number
          total_amount: number
        }
        Update: {
          cgst_amount?: number
          created_at?: string
          created_by?: string
          credit_note_date?: string
          credit_note_number?: string
          id?: never
          igst_amount?: number
          invoice_id?: number
          reason?: string
          sgst_amount?: number
          taxable_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "gst_outward_supplies"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoice_receivables"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "receivables_ageing"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "sales_register"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          customer_type: string
          gstin: string | null
          id: number
          is_active: boolean
          name: string
          phone: string | null
          state: string
          state_code: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_type: string
          gstin?: string | null
          id?: never
          is_active?: boolean
          name: string
          phone?: string | null
          state: string
          state_code: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_type?: string
          gstin?: string | null
          id?: never
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string
          state_code?: string
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          created_at: string
          dispatch_date: string
          id: number
          invoice_id: number
          order_id: number
        }
        Insert: {
          created_at?: string
          dispatch_date?: string
          id?: never
          invoice_id: number
          order_id: number
        }
        Update: {
          created_at?: string
          dispatch_date?: string
          id?: never
          invoice_id?: number
          order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "gst_outward_supplies"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "dispatches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoice_receivables"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "dispatches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "receivables_ageing"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "dispatches_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "sales_register"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          average_unit_cost: number
          category: string
          created_at: string
          id: number
          is_active: boolean
          name: string
          name_hi: string | null
          name_ta: string | null
          reorder_level: number
          sku: string
          unit: string
        }
        Insert: {
          average_unit_cost?: number
          category: string
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          name_hi?: string | null
          name_ta?: string | null
          reorder_level?: number
          sku: string
          unit: string
        }
        Update: {
          average_unit_cost?: number
          category?: string
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          name_hi?: string | null
          name_ta?: string | null
          reorder_level?: number
          sku?: string
          unit?: string
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          financial_year: string
          last_number: number
        }
        Insert: {
          financial_year: string
          last_number?: number
        }
        Update: {
          financial_year?: string
          last_number?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          cgst_amount: number
          gst_rate: number
          hsn_code: string | null
          id: number
          igst_amount: number
          invoice_id: number
          product_id: number
          product_name: string
          quantity: number
          sgst_amount: number
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          cgst_amount?: number
          gst_rate: number
          hsn_code?: string | null
          id?: never
          igst_amount?: number
          invoice_id: number
          product_id: number
          product_name: string
          quantity: number
          sgst_amount?: number
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Update: {
          cgst_amount?: number
          gst_rate?: number
          hsn_code?: string | null
          id?: never
          igst_amount?: number
          invoice_id?: number
          product_id?: number
          product_name?: string
          quantity?: number
          sgst_amount?: number
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gst_outward_supplies"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_receivables"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "receivables_ageing"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_register"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cgst_amount: number
          company_snapshot: Json | null
          created_at: string
          customer_address: string | null
          customer_gstin: string | null
          customer_name: string
          due_date: string
          id: number
          igst_amount: number
          invoice_date: string
          invoice_number: string
          order_id: number
          place_of_supply: string
          sgst_amount: number
          state_code: string
          status: string
          taxable_amount: number
          total_amount: number
        }
        Insert: {
          cgst_amount?: number
          company_snapshot?: Json | null
          created_at?: string
          customer_address?: string | null
          customer_gstin?: string | null
          customer_name: string
          due_date?: string
          id?: never
          igst_amount?: number
          invoice_date?: string
          invoice_number: string
          order_id: number
          place_of_supply: string
          sgst_amount?: number
          state_code: string
          status?: string
          taxable_amount: number
          total_amount: number
        }
        Update: {
          cgst_amount?: number
          company_snapshot?: Json | null
          created_at?: string
          customer_address?: string | null
          customer_gstin?: string | null
          customer_name?: string
          due_date?: string
          id?: never
          igst_amount?: number
          invoice_date?: string
          invoice_number?: string
          order_id?: number
          place_of_supply?: string
          sgst_amount?: number
          state_code?: string
          status?: string
          taxable_amount?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: number
          invoice_id: number
          notes: string | null
          payment_date: string
          payment_method: string
          reference_number: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          invoice_id: number
          notes?: string | null
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          invoice_id?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gst_outward_supplies"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_receivables"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "receivables_ageing"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_register"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_consumption: {
        Row: {
          actual_quantity: number
          id: number
          inventory_item_id: number
          planned_quantity: number
          production_run_id: number
          unit_cost: number | null
        }
        Insert: {
          actual_quantity: number
          id?: never
          inventory_item_id: number
          planned_quantity: number
          production_run_id: number
          unit_cost?: number | null
        }
        Update: {
          actual_quantity?: number
          id?: never
          inventory_item_id?: number
          planned_quantity?: number
          production_run_id?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_consumption_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumption_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "material_stock"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "production_consumption_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_register"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "production_consumption_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "production_costing"
            referencedColumns: ["production_run_id"]
          },
          {
            foreignKeyName: "production_consumption_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "production_margin"
            referencedColumns: ["production_run_id"]
          },
          {
            foreignKeyName: "production_consumption_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumption_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "production_summary_report"
            referencedColumns: ["production_run_id"]
          },
          {
            foreignKeyName: "production_consumption_production_run_id_fkey"
            columns: ["production_run_id"]
            isOneToOne: false
            referencedRelation: "production_variance_report"
            referencedColumns: ["production_run_id"]
          },
        ]
      }
      production_runs: {
        Row: {
          actual_output: number | null
          batch_number: string
          bom_id: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          damaged_pouches: number
          id: number
          labour_cost: number
          planned_output: number
          production_date: string
          status: string
          utility_cost: number
        }
        Insert: {
          actual_output?: number | null
          batch_number: string
          bom_id: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          damaged_pouches?: number
          id?: never
          labour_cost?: number
          planned_output: number
          production_date?: string
          status?: string
          utility_cost?: number
        }
        Update: {
          actual_output?: number | null
          batch_number?: string
          bom_id?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          damaged_pouches?: number
          id?: never
          labour_cost?: number
          planned_output?: number
          production_date?: string
          status?: string
          utility_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          gst_rate: number
          hsn_code: string | null
          id: number
          is_active: boolean
          name: string
          name_hi: string | null
          name_ta: string | null
          packet_size_g: number
          packets_per_carton: number | null
          reorder_level: number
          selling_price: number
          sku: string
        }
        Insert: {
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: never
          is_active?: boolean
          name: string
          name_hi?: string | null
          name_ta?: string | null
          packet_size_g: number
          packets_per_carton?: number | null
          reorder_level?: number
          selling_price: number
          sku: string
        }
        Update: {
          created_at?: string
          gst_rate?: number
          hsn_code?: string | null
          id?: never
          is_active?: boolean
          name?: string
          name_hi?: string | null
          name_ta?: string | null
          packet_size_g?: number
          packets_per_carton?: number | null
          reorder_level?: number
          selling_price?: number
          sku?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          role: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          average_cost_before_purchase: number | null
          id: number
          inventory_item_id: number
          purchase_id: number
          quantity: number
          stock_before_purchase: number | null
          unit_price: number
        }
        Insert: {
          average_cost_before_purchase?: number | null
          id?: never
          inventory_item_id: number
          purchase_id: number
          quantity: number
          stock_before_purchase?: number | null
          unit_price: number
        }
        Update: {
          average_cost_before_purchase?: number | null
          id?: never
          inventory_item_id?: number
          purchase_id?: number
          quantity?: number
          stock_before_purchase?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "material_stock"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "purchase_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_register"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase_register"
            referencedColumns: ["purchase_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          id: number
          invoice_number: string
          purchase_date: string
          status: string
          supplier_id: number
          supplier_name: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: never
          invoice_number: string
          purchase_date?: string
          status?: string
          supplier_id: number
          supplier_name: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          id?: never
          invoice_number?: string
          purchase_date?: string
          status?: string
          supplier_id?: number
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          gst_rate: number
          id: number
          order_id: number
          product_id: number
          quantity: number
          unit_price: number
        }
        Insert: {
          gst_rate: number
          id?: never
          order_id: number
          product_id: number
          quantity: number
          unit_price: number
        }
        Update: {
          gst_rate?: number
          id?: never
          order_id?: number
          product_id?: number
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closure_reason: string | null
          created_at: string
          customer_id: number
          id: number
          order_date: string
          order_number: string
          salesman_id: string | null
          salesman_name: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string
          customer_id: number
          id?: never
          order_date?: string
          order_number: string
          salesman_id?: string | null
          salesman_name: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closure_reason?: string | null
          created_at?: string
          customer_id?: number
          id?: never
          order_date?: string
          order_number?: string
          salesman_id?: string | null
          salesman_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_outstanding_report"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_salesman_id_fkey"
            columns: ["salesman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: number
          inventory_item_id: number | null
          movement_date: string
          movement_type: string
          product_id: number | null
          quantity: number
          reference_id: number | null
          reference_type: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: never
          inventory_item_id?: number | null
          movement_date?: string
          movement_type: string
          product_id?: number | null
          quantity: number
          reference_id?: number | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: never
          inventory_item_id?: number | null
          movement_date?: string
          movement_type?: string
          product_id?: number | null
          quantity?: number
          reference_id?: number | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "material_stock"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_register"
            referencedColumns: ["inventory_item_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: number
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          state_code: string | null
          supplier_code: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: never
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          state_code?: string | null
          supplier_code: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: never
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          state_code?: string | null
          supplier_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      credit_note_register: {
        Row: {
          cgst_amount: number | null
          credit_note_date: string | null
          credit_note_id: number | null
          credit_note_number: string | null
          customer_gstin: string | null
          customer_name: string | null
          igst_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          place_of_supply: string | null
          reason: string | null
          sgst_amount: number | null
          state_code: string | null
          taxable_amount: number | null
          total_amount: number | null
          total_gst: number | null
        }
        Relationships: []
      }
      customer_outstanding_report: {
        Row: {
          customer_id: number | null
          customer_name: string | null
          customer_type: string | null
          overdue_amount: number | null
          total_collected: number | null
          total_invoiced: number | null
          total_invoices: number | null
          total_outstanding: number | null
        }
        Relationships: []
      }
      gst_outward_supplies: {
        Row: {
          cgst_amount: number | null
          customer_gstin: string | null
          customer_name: string | null
          gst_rate: number | null
          igst_amount: number | null
          invoice_date: string | null
          invoice_id: number | null
          invoice_number: string | null
          place_of_supply: string | null
          sgst_amount: number | null
          state_code: string | null
          supply_category: string | null
          supply_type: string | null
          taxable_amount: number | null
          total_amount: number | null
          total_gst: number | null
        }
        Relationships: []
      }
      gst_transaction_register: {
        Row: {
          cgst_amount: number | null
          customer_gstin: string | null
          customer_name: string | null
          document_date: string | null
          document_number: string | null
          document_type: string | null
          gst_rate: number | null
          igst_amount: number | null
          original_invoice_number: string | null
          sgst_amount: number | null
          state_code: string | null
          supply_type: string | null
          taxable_amount: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      invoice_receivables: {
        Row: {
          amount_paid: number | null
          customer_name: string | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: number | null
          invoice_number: string | null
          outstanding_amount: number | null
          overdue_days: number | null
          payment_status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      material_stock: {
        Row: {
          average_unit_cost: number | null
          category: string | null
          current_stock: number | null
          inventory_item_id: number | null
          name: string | null
          sku: string | null
          stock_value: number | null
          unit: string | null
        }
        Relationships: []
      }
      payment_collection_report: {
        Row: {
          amount: number | null
          customer_name: string | null
          invoice_number: string | null
          notes: string | null
          payment_date: string | null
          payment_id: number | null
          payment_method: string | null
          reference_number: string | null
          salesman_name: string | null
        }
        Relationships: []
      }
      product_stock: {
        Row: {
          available_stock: number | null
          name: string | null
          packet_size_g: number | null
          physical_stock: number | null
          product_id: number | null
          reserved_stock: number | null
          sku: string | null
        }
        Relationships: []
      }
      production_costing: {
        Row: {
          actual_output: number | null
          batch_number: string | null
          cost_per_packet: number | null
          labour_cost: number | null
          material_cost: number | null
          planned_output: number | null
          product_name: string | null
          production_date: string | null
          production_run_id: number | null
          total_production_cost: number | null
          utility_cost: number | null
        }
        Relationships: []
      }
      production_margin: {
        Row: {
          actual_output: number | null
          batch_number: string | null
          cost_per_packet: number | null
          margin_per_packet: number | null
          margin_percentage: number | null
          product_name: string | null
          production_run_id: number | null
          selling_price: number | null
          total_production_cost: number | null
        }
        Relationships: []
      }
      production_summary_report: {
        Row: {
          actual_output: number | null
          batch_number: string | null
          cost_per_packet: number | null
          damaged_pouches: number | null
          labour_cost: number | null
          margin_per_packet: number | null
          margin_percentage: number | null
          material_cost: number | null
          output_variance: number | null
          planned_output: number | null
          product_name: string | null
          production_date: string | null
          production_run_id: number | null
          selling_price: number | null
          total_production_cost: number | null
          utility_cost: number | null
          yield_percentage: number | null
          yield_status: string | null
          yield_variance_percentage: number | null
        }
        Relationships: []
      }
      production_variance_report: {
        Row: {
          actual_quantity: number | null
          batch_number: string | null
          category: string | null
          cost_variance: number | null
          material_name: string | null
          planned_quantity: number | null
          product_name: string | null
          production_date: string | null
          production_run_id: number | null
          quantity_variance: number | null
          sku: string | null
          unit: string | null
          unit_cost: number | null
          variance_percentage: number | null
          variance_status: string | null
        }
        Relationships: []
      }
      purchase_register: {
        Row: {
          category: string | null
          inventory_item_id: number | null
          invoice_number: string | null
          item_name: string | null
          purchase_date: string | null
          purchase_id: number | null
          purchase_status: string | null
          quantity: number | null
          sku: string | null
          supplier_name: string | null
          total_amount: number | null
          unit: string | null
          unit_price: number | null
        }
        Relationships: []
      }
      receivables_ageing: {
        Row: {
          ageing_bucket: string | null
          customer_name: string | null
          due_date: string | null
          invoice_id: number | null
          invoice_number: string | null
          outstanding_amount: number | null
          overdue_days: number | null
        }
        Relationships: []
      }
      reorder_alerts: {
        Row: {
          alert_status: string | null
          available_stock: number | null
          category: string | null
          item_id: number | null
          item_name: string | null
          reorder_level: number | null
          shortage_quantity: number | null
          sku: string | null
          unit: string | null
        }
        Relationships: []
      }
      sales_register: {
        Row: {
          cgst_amount: number | null
          customer_gstin: string | null
          customer_name: string | null
          customer_type: string | null
          dispatch_date: string | null
          igst_amount: number | null
          invoice_date: string | null
          invoice_id: number | null
          invoice_number: string | null
          invoice_status: string | null
          order_number: string | null
          order_status: string | null
          place_of_supply: string | null
          salesman_name: string | null
          sgst_amount: number | null
          state_code: string | null
          taxable_amount: number | null
          total_amount: number | null
          total_gst: number | null
        }
        Relationships: []
      }
      stock_ledger_report: {
        Row: {
          category: string | null
          created_at: string | null
          item_name: string | null
          movement_date: string | null
          movement_id: number | null
          movement_type: string | null
          reference_id: number | null
          reference_type: string | null
          running_balance: number | null
          sku: string | null
          stock_in: number | null
          stock_out: number | null
          unit: string | null
          unit_cost: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_order: { Args: { p_order_id: number }; Returns: undefined }
      convert_quantity: {
        Args: {
          p_from_unit: string
          p_packets_per_carton?: number
          p_quantity: number
          p_to_unit: string
        }
        Returns: number
      }
      current_user_role: { Args: never; Returns: string }
      customer_sales_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          customer_id: number
          customer_name: string
          customer_type: string
          taxable_sales: number
          total_gst: number
          total_invoices: number
          total_sales: number
        }[]
      }
      dispatch_order: { Args: { p_order_id: number }; Returns: undefined }
      generate_invoice: { Args: { p_order_id: number }; Returns: number }
      gst_summary_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          cgst_amount: number
          igst_amount: number
          sgst_amount: number
          supply_type: string
          taxable_amount: number
          total_amount: number
          total_gst: number
          total_invoices: number
        }[]
      }
      has_role: { Args: { allowed_roles: string[] }; Returns: boolean }
      post_production: { Args: { p_run_id: number }; Returns: undefined }
      post_purchase: { Args: { p_purchase_id: number }; Returns: undefined }
      product_sales_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          product_id: number
          product_name: string
          quantity_sold: number
          sku: string
          taxable_sales: number
          total_gst: number
          total_invoices: number
          total_sales: number
        }[]
      }
      record_payment: {
        Args: {
          p_amount: number
          p_invoice_id: number
          p_method: string
          p_reference?: string
        }
        Returns: undefined
      }
      secure_adjust_stock: {
        Args: {
          p_inventory_item_id?: number
          p_product_id?: number
          p_quantity: number
          p_reason: string
        }
        Returns: number
      }
      secure_approve_order: { Args: { p_order_id: number }; Returns: undefined }
      secure_cancel_production: {
        Args: { p_reason: string; p_run_id: number }
        Returns: undefined
      }
      secure_cancel_purchase: {
        Args: { p_purchase_id: number; p_reason: string }
        Returns: undefined
      }
      secure_close_order: {
        Args: { p_action: string; p_order_id: number; p_reason: string }
        Returns: undefined
      }
      secure_create_bom_version: { Args: { p_bom_id: number }; Returns: number }
      secure_dashboard: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      secure_dispatch_order: {
        Args: { p_order_id: number }
        Returns: undefined
      }
      secure_financial_report: { Args: { p_report: string }; Returns: Json }
      secure_generate_invoice: { Args: { p_order_id: number }; Returns: number }
      secure_gst_register: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      secure_gst_summary_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      secure_issue_credit_note: {
        Args: { p_invoice_id: number; p_reason: string }
        Returns: number
      }
      secure_post_production: { Args: { p_run_id: number }; Returns: undefined }
      secure_post_purchase: {
        Args: { p_purchase_id: number }
        Returns: undefined
      }
      secure_product_stock: {
        Args: never
        Returns: {
          available_stock: number
          name: string
          packet_size_g: number
          physical_stock: number
          product_id: number
          reserved_stock: number
          sku: string
        }[]
      }
      secure_record_payment: {
        Args: {
          p_amount: number
          p_invoice_id: number
          p_method: string
          p_reference?: string
        }
        Returns: undefined
      }
      secure_reopen_order: { Args: { p_order_id: number }; Returns: undefined }
      secure_reorder_alerts: { Args: never; Returns: Json }
      secure_reverse_payment: {
        Args: { p_payment_id: number; p_reason: string }
        Returns: undefined
      }
      secure_reverse_production: {
        Args: { p_reason: string; p_run_id: number }
        Returns: undefined
      }
      secure_reverse_purchase: {
        Args: { p_purchase_id: number; p_reason: string }
        Returns: undefined
      }
      secure_save_bom: {
        Args: {
          p_bom_id?: number
          p_expected_output: number
          p_is_active?: boolean
          p_items: Json
          p_product_id: number
        }
        Returns: number
      }
      secure_save_order: {
        Args: {
          p_customer_id: number
          p_items: Json
          p_order_id?: number
          p_salesman_id?: string
        }
        Returns: number
      }
      secure_save_production: {
        Args: {
          p_actual_output: number
          p_batch_number: string
          p_bom_id: number
          p_damaged_pouches: number
          p_items: Json
          p_labour_cost: number
          p_planned_output: number
          p_production_date: string
          p_run_id?: number
          p_utility_cost: number
        }
        Returns: number
      }
      secure_save_purchase: {
        Args: {
          p_invoice_number: string
          p_items: Json
          p_purchase_date: string
          p_purchase_id?: number
          p_supplier_id: number
        }
        Returns: number
      }
      secure_set_bom_active: {
        Args: { p_bom_id: number; p_is_active: boolean }
        Returns: undefined
      }
      secure_stock_period_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          adjustments: number
          category: string
          closing_stock: number
          issues: number
          item_name: string
          opening_stock: number
          receipts: number
          sku: string
          unit: string
        }[]
      }
      stock_period_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          adjustments: number
          category: string
          closing_stock: number
          issues: number
          item_name: string
          opening_stock: number
          receipts: number
          sku: string
          unit: string
        }[]
      }
      supplier_purchase_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          is_active: boolean
          last_purchase_date: string
          supplier_code: string
          supplier_id: number
          supplier_name: string
          total_purchase_value: number
          total_purchases: number
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
