export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country_code: string
          created_at: string
          customer_id: string
          emirate: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone_e164: string
          recipient_name: string
          updated_at: string
        }
        Insert: {
          city: string
          country_code?: string
          created_at?: string
          customer_id: string
          emirate: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone_e164: string
          recipient_name: string
          updated_at?: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          customer_id?: string
          emirate?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone_e164?: string
          recipient_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_email: string | null
          actor_user_id: string | null
          diff: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          occurred_at: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_email?: string | null
          actor_user_id?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_email?: string | null
          actor_user_id?: string | null
          diff?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          occurred_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          aliases: string[] | null
          brand_tier: string | null
          country_of_origin: string | null
          created_at: string
          display_name: string
          hero_image_url: string | null
          id: string
          is_featured_homepage_brand: boolean
          is_visible_on_directory: boolean
          logo_url: string | null
          long_description: string | null
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          aliases?: string[] | null
          brand_tier?: string | null
          country_of_origin?: string | null
          created_at?: string
          display_name: string
          hero_image_url?: string | null
          id?: string
          is_featured_homepage_brand?: boolean
          is_visible_on_directory?: boolean
          logo_url?: string | null
          long_description?: string | null
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          aliases?: string[] | null
          brand_tier?: string | null
          country_of_origin?: string | null
          created_at?: string
          display_name?: string
          hero_image_url?: string | null
          id?: string
          is_featured_homepage_brand?: boolean
          is_visible_on_directory?: boolean
          logo_url?: string | null
          long_description?: string | null
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          listing_copy: string | null
          name: string
          parent_nav: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          subcategories: string[] | null
          supported_goals: Database["public"]["Enums"]["goal_tag"][] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          listing_copy?: string | null
          name: string
          parent_nav: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          subcategories?: string[] | null
          supported_goals?: Database["public"]["Enums"]["goal_tag"][] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          listing_copy?: string | null
          name?: string
          parent_nav?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          subcategories?: string[] | null
          supported_goals?: Database["public"]["Enums"]["goal_tag"][] | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          consent_at: string
          consent_version: string
          created_at: string
          deleted_at: string | null
          email_verified_at: string | null
          full_name: string
          id: string
          marketing_opt_in: boolean
          marketing_opt_in_at: string | null
          phone_e164: string | null
          updated_at: string
        }
        Insert: {
          consent_at?: string
          consent_version?: string
          created_at?: string
          deleted_at?: string | null
          email_verified_at?: string | null
          full_name: string
          id: string
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          phone_e164?: string | null
          updated_at?: string
        }
        Update: {
          consent_at?: string
          consent_version?: string
          created_at?: string
          deleted_at?: string | null
          email_verified_at?: string | null
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          marketing_opt_in_at?: string | null
          phone_e164?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          category: string | null
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          description: string | null
          display_name: string
          sort_order: number
          tag: Database["public"]["Enums"]["goal_tag"]
        }
        Insert: {
          description?: string | null
          display_name: string
          sort_order?: number
          tag: Database["public"]["Enums"]["goal_tag"]
        }
        Update: {
          description?: string | null
          display_name?: string
          sort_order?: number
          tag?: Database["public"]["Enums"]["goal_tag"]
        }
        Relationships: []
      }
      md_category_mapping: {
        Row: {
          default_public_category_slug: string | null
          md_category: string
          requires_split: boolean
          split_hint: string | null
        }
        Insert: {
          default_public_category_slug?: string | null
          md_category: string
          requires_split?: boolean
          split_hint?: string | null
        }
        Update: {
          default_public_category_slug?: string | null
          md_category?: string
          requires_split?: boolean
          split_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "md_category_mapping_default_public_category_slug_fkey"
            columns: ["default_public_category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_aed: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_aed: number
          variant_flavor: string | null
          variant_id: string | null
          variant_size: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_aed: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price_aed: number
          variant_flavor?: string | null
          variant_id?: string | null
          variant_size: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total_aed?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_aed?: number
          variant_flavor?: string | null
          variant_id?: string | null
          variant_size?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          id: string
          idempotency_key: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_provider: string | null
          payment_provider_intent_id: string | null
          payment_provider_order_id: string | null
          reference: string
          ship_to: Json
          shipped_at: string | null
          shipping_cost_aed: number
          shipping_method: string
          shipping_provider: string | null
          shipping_provider_shipment_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_aed: number
          total_aed: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vat_amount_aed: number
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_provider?: string | null
          payment_provider_intent_id?: string | null
          payment_provider_order_id?: string | null
          reference: string
          ship_to: Json
          shipped_at?: string | null
          shipping_cost_aed?: number
          shipping_method: string
          shipping_provider?: string | null
          shipping_provider_shipment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_aed: number
          total_aed: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vat_amount_aed?: number
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_provider?: string | null
          payment_provider_intent_id?: string | null
          payment_provider_order_id?: string | null
          reference?: string
          ship_to?: Json
          shipped_at?: string | null
          shipping_cost_aed?: number
          shipping_method?: string
          shipping_provider?: string | null
          shipping_provider_shipment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_aed?: number
          total_aed?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vat_amount_aed?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_aed: number
          currency: string
          id: string
          kind: Database["public"]["Enums"]["payment_event_kind"]
          occurred_at: string
          order_id: string
          provider: string
          provider_intent_id: string | null
          provider_transaction_id: string | null
          raw_payload: Json
          recorded_at: string
          signature_received: string | null
        }
        Insert: {
          amount_aed: number
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["payment_event_kind"]
          occurred_at: string
          order_id: string
          provider: string
          provider_intent_id?: string | null
          provider_transaction_id?: string | null
          raw_payload: Json
          recorded_at?: string
          signature_received?: string | null
        }
        Update: {
          amount_aed?: number
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_event_kind"]
          occurred_at?: string
          order_id?: string
          provider?: string
          provider_intent_id?: string | null
          provider_transaction_id?: string | null
          raw_payload?: Json
          recorded_at?: string
          signature_received?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_goal_tags: {
        Row: {
          goal: Database["public"]["Enums"]["goal_tag"]
          is_primary: boolean
          product_id: string
        }
        Insert: {
          goal: Database["public"]["Enums"]["goal_tag"]
          is_primary?: boolean
          product_id: string
        }
        Update: {
          goal?: Database["public"]["Enums"]["goal_tag"]
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_goal_tags_goal_fkey"
            columns: ["goal"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["tag"]
          },
          {
            foreignKeyName: "product_goal_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["image_kind"]
          product_id: string
          public_url: string
          sort_order: number
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["image_kind"]
          product_id: string
          public_url: string
          sort_order?: number
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["image_kind"]
          product_id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          flavor: string | null
          id: string
          in_stock: boolean
          low_stock_threshold: number
          price_aed: number
          product_id: string
          size: string
          sku: string | null
          sort_order: number
          stock_quantity: number | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          flavor?: string | null
          id?: string
          in_stock?: boolean
          low_stock_threshold?: number
          price_aed: number
          product_id: string
          size: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          flavor?: string | null
          id?: string
          in_stock?: boolean
          low_stock_threshold?: number
          price_aed?: number
          product_id?: string
          size?: string
          sku?: string | null
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          admin_review_flags: Json
          brand_id: string | null
          brand_raw: string | null
          category_id: string | null
          compare_at_price_aed: number | null
          completion_score: number
          content: Json
          created_at: string
          featured_score: number
          fields_status: Json
          form: Database["public"]["Enums"]["product_form"] | null
          id: string
          is_add_to_cart_enabled: boolean
          is_checkout_enabled: boolean
          is_public_visible: boolean
          label_data: Json
          name: string
          name_raw: string
          published_at: string | null
          retail_price_aed: number | null
          slug: string
          source_category: string | null
          source_file: string
          source_notes: string | null
          source_row: number[]
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          wholesale_price_internal: number | null
        }
        Insert: {
          admin_review_flags?: Json
          brand_id?: string | null
          brand_raw?: string | null
          category_id?: string | null
          compare_at_price_aed?: number | null
          completion_score?: number
          content?: Json
          created_at?: string
          featured_score?: number
          fields_status?: Json
          form?: Database["public"]["Enums"]["product_form"] | null
          id?: string
          is_add_to_cart_enabled?: boolean
          is_checkout_enabled?: boolean
          is_public_visible?: boolean
          label_data?: Json
          name: string
          name_raw: string
          published_at?: string | null
          retail_price_aed?: number | null
          slug: string
          source_category?: string | null
          source_file?: string
          source_notes?: string | null
          source_row?: number[]
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          wholesale_price_internal?: number | null
        }
        Update: {
          admin_review_flags?: Json
          brand_id?: string | null
          brand_raw?: string | null
          category_id?: string | null
          compare_at_price_aed?: number | null
          completion_score?: number
          content?: Json
          created_at?: string
          featured_score?: number
          fields_status?: Json
          form?: Database["public"]["Enums"]["product_form"] | null
          id?: string
          is_add_to_cart_enabled?: boolean
          is_checkout_enabled?: boolean
          is_public_visible?: boolean
          label_data?: Json
          name?: string
          name_raw?: string
          published_at?: string | null
          retail_price_aed?: number | null
          slug?: string
          source_category?: string | null
          source_file?: string
          source_notes?: string | null
          source_row?: number[]
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          wholesale_price_internal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          id: string
          occurred_at: string
          order_id: string
          provider: string
          provider_shipment_id: string | null
          raw_payload: Json | null
          recorded_at: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          id?: string
          occurred_at: string
          order_id: string
          provider: string
          provider_shipment_id?: string | null
          raw_payload?: Json | null
          recorded_at?: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          id?: string
          occurred_at?: string
          order_id?: string
          provider?: string
          provider_shipment_id?: string | null
          raw_payload?: Json | null
          recorded_at?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      slug_history: {
        Row: {
          changed_at: string
          id: string
          new_slug: string
          old_slug: string
          product_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_slug: string
          old_slug: string
          product_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_slug?: string
          old_slug?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slug_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_id: string | null
          guest_session_id: string | null
          id: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          guest_session_id?: string | null
          id?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          guest_session_id?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          context_refs: Json | null
          conversation_id: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          context_refs?: Json | null
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          context_refs?: Json | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      audit_action:
        | "create"
        | "update"
        | "publish"
        | "unpublish"
        | "archive"
        | "restore"
        | "flag_toggle"
        | "image_upload"
        | "role_change"
      goal_tag:
        | "build_muscle"
        | "boost_energy"
        | "recovery"
        | "weight_management"
        | "endurance"
      image_kind:
        | "front"
        | "label_nutrition"
        | "label_ingredients"
        | "angle"
        | "open"
        | "lifestyle"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "failed"
      payment_event_kind:
        | "intent_created"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
        | "voided"
        | "chargeback"
      payment_method: "card" | "apple_pay" | "tabby" | "tamara" | "cod"
      product_form:
        | "powder"
        | "capsule"
        | "tablet"
        | "softgel"
        | "gummies"
        | "liquid"
        | "rtd"
        | "food"
      product_status:
        | "imported"
        | "draft"
        | "partial"
        | "ready_to_publish"
        | "published"
        | "hidden"
        | "archived"
      shipment_status:
        | "created"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "delivery_failed"
        | "returned"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: [
        "create",
        "update",
        "publish",
        "unpublish",
        "archive",
        "restore",
        "flag_toggle",
        "image_upload",
        "role_change",
      ],
      goal_tag: [
        "build_muscle",
        "boost_energy",
        "recovery",
        "weight_management",
        "endurance",
      ],
      image_kind: [
        "front",
        "label_nutrition",
        "label_ingredients",
        "angle",
        "open",
        "lifestyle",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "failed",
      ],
      payment_event_kind: [
        "intent_created",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "voided",
        "chargeback",
      ],
      payment_method: ["card", "apple_pay", "tabby", "tamara", "cod"],
      product_form: [
        "powder",
        "capsule",
        "tablet",
        "softgel",
        "gummies",
        "liquid",
        "rtd",
        "food",
      ],
      product_status: [
        "imported",
        "draft",
        "partial",
        "ready_to_publish",
        "published",
        "hidden",
        "archived",
      ],
      shipment_status: [
        "created",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "delivery_failed",
        "returned",
        "cancelled",
      ],
    },
  },
} as const

