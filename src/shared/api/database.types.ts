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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      auth_identities: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          provider: string
          provider_uid: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          provider: string
          provider_uid: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          provider?: string
          provider_uid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: number
          is_active: boolean
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          id?: number
          is_active?: boolean
          slug: string
          sort_order: number
          title: string
        }
        Update: {
          id?: number
          is_active?: boolean
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: number
          project_id: number | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: number
          project_id?: number | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: number
          project_id?: number | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          fx_rate_used: number
          id: string
          intent: string
          original_amount: number
          original_currency: string
          points_granted: number
          project_id: number
          provider: string
          provider_event_id: string | null
          provider_payment_id: string | null
          status: string
          target_project_id: number | null
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          fx_rate_used: number
          id?: string
          intent: string
          original_amount: number
          original_currency: string
          points_granted: number
          project_id: number
          provider: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          status?: string
          target_project_id?: number | null
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          fx_rate_used?: number
          id?: string
          intent?: string
          original_amount?: number
          original_currency?: string
          points_granted?: number
          project_id?: number
          provider?: string
          provider_event_id?: string | null
          provider_payment_id?: string | null
          status?: string
          target_project_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_clicks: {
        Row: {
          day: string
          project_id: number
          user_id: string
        }
        Insert: {
          day: string
          project_id: number
          user_id: string
        }
        Update: {
          day?: string
          project_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clicks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_clicks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category_id: number
          clicks: number
          created_at: string
          id: number
          initial_stake: number | null
          name: string
          og_description: string | null
          og_fetched_at: string | null
          og_image_url: string | null
          og_status: string
          paid_amount: number
          rank1_since: string | null
          status: string
          tg_bot_is_admin: boolean
          tg_chat_id: number | null
          type: string
          updated_at: string
          url: string
          user_id: string
          votes: number
        }
        Insert: {
          category_id: number
          clicks?: number
          created_at?: string
          id?: number
          initial_stake?: number | null
          name: string
          og_description?: string | null
          og_fetched_at?: string | null
          og_image_url?: string | null
          og_status?: string
          paid_amount?: number
          rank1_since?: string | null
          status?: string
          tg_bot_is_admin?: boolean
          tg_chat_id?: number | null
          type: string
          updated_at?: string
          url: string
          user_id: string
          votes?: number
        }
        Update: {
          category_id?: number
          clicks?: number
          created_at?: string
          id?: number
          initial_stake?: number | null
          name?: string
          og_description?: string | null
          og_fetched_at?: string | null
          og_image_url?: string | null
          og_status?: string
          paid_amount?: number
          rank1_since?: string | null
          status?: string
          tg_bot_is_admin?: boolean
          tg_chat_id?: number | null
          type?: string
          updated_at?: string
          url?: string
          user_id?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stake_transactions: {
        Row: {
          actor_user_id: string
          amount: number
          coefficient: number | null
          created_at: string
          id: number
          payment_id: string | null
          project_id: number
          target_project_id: number | null
          transaction_group_id: string
          type: string
        }
        Insert: {
          actor_user_id: string
          amount: number
          coefficient?: number | null
          created_at?: string
          id?: number
          payment_id?: string | null
          project_id: number
          target_project_id?: number | null
          transaction_group_id: string
          type: string
        }
        Update: {
          actor_user_id?: string
          amount?: number
          coefficient?: number | null
          created_at?: string
          id?: number
          payment_id?: string | null
          project_id?: number
          target_project_id?: number | null
          transaction_group_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stake_transactions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stake_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stake_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stake_transactions_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: number
          project_id: number | null
          reward_votes: number
          status: string
          task_id: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: number
          project_id?: number | null
          reward_votes: number
          status: string
          task_id: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: number
          project_id?: number | null
          reward_votes?: number
          status?: string
          task_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          reward_votes: number
          target_project_id: number | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          reward_votes: number
          target_project_id?: number | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          reward_votes?: number
          target_project_id?: number | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_currency: string
          display_name: string
          id: string
          referrer_id: string | null
          status: string
          vote_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_currency?: string
          display_name: string
          id?: string
          referrer_id?: string | null
          status?: string
          vote_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_currency?: string
          display_name?: string
          id?: string
          referrer_id?: string | null
          status?: string
          vote_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_transactions: {
        Row: {
          amount: number
          created_at: string
          id: number
          project_id: number
          reference_id: number | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          project_id: number
          reference_id?: number | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          project_id?: number
          reference_id?: number | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      category_stats: {
        Row: {
          category_id: number | null
          leader_name: string | null
          pool: number | null
          project_count: number | null
          slug: string | null
          sort_order: number | null
          title: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      resolve_telegram_identity: {
        Args: {
          p_avatar_url: string
          p_display_name: string
          p_meta: Json
          p_referrer_id: string
          p_telegram_id: string
        }
        Returns: {
          is_new: boolean
          user_id: string
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
