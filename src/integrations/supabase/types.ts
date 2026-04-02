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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee: string
          client_id: string
          created_at: string
          due_date: string
          id: string
          linked_task_id: number | null
          original_id: string
          priority: string
          responsible_party: string
          responsible_team: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee: string
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          linked_task_id?: number | null
          original_id: string
          priority: string
          responsible_party?: string
          responsible_team?: string | null
          source: string
          status: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          linked_task_id?: number | null
          original_id?: string
          priority?: string
          responsible_party?: string
          responsible_team?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          department: string | null
          email: string
          id: string
          is_decision_maker: boolean
          is_primary_contact: boolean
          name: string
          notes: string | null
          phone: string | null
          position: string
          role_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          is_decision_maker?: boolean
          is_primary_contact?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          position?: string
          role_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          is_decision_maker?: boolean
          is_primary_contact?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string
          role_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_dashboard_config: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      client_financials: {
        Row: {
          billed: number
          client_id: string
          contract_value: number
          created_at: string
          hours_estimated: number
          hours_used: number
          id: string
          monthly_breakdown: Json
          paid: number
          pending: number
          updated_at: string
        }
        Insert: {
          billed?: number
          client_id: string
          contract_value?: number
          created_at?: string
          hours_estimated?: number
          hours_used?: number
          id?: string
          monthly_breakdown?: Json
          paid?: number
          pending?: number
          updated_at?: string
        }
        Update: {
          billed?: number
          client_id?: string
          contract_value?: number
          created_at?: string
          hours_estimated?: number
          hours_used?: number
          id?: string
          monthly_breakdown?: Json
          paid?: number
          pending?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_financials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          contact_email: string
          contact_name: string
          contract_end: string
          contract_start: string
          country: string
          created_at: string
          id: string
          industry: string
          name: string
          progress: number
          status: string
          team_assigned: string[]
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contract_end: string
          contract_start: string
          country: string
          created_at?: string
          id: string
          industry: string
          name: string
          progress?: number
          status: string
          team_assigned?: string[]
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contract_end?: string
          contract_start?: string
          country?: string
          created_at?: string
          id?: string
          industry?: string
          name?: string
          progress?: number
          status?: string
          team_assigned?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          avatar: string
          client_id: string
          created_at: string
          date: string
          id: string
          message: string
          original_id: string
          type: string
          updated_at: string
          user: string
        }
        Insert: {
          avatar: string
          client_id: string
          created_at?: string
          date: string
          id?: string
          message: string
          original_id: string
          type: string
          updated_at?: string
          user: string
        }
        Update: {
          avatar?: string
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          message?: string
          original_id?: string
          type?: string
          updated_at?: string
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          approved_by: string | null
          client_id: string
          created_at: string
          delivered_date: string | null
          detail: Json | null
          due_date: string
          id: string
          linked_task_id: number | null
          name: string
          original_id: string
          responsible_party: string
          responsible_team: string | null
          status: string
          type: string
          updated_at: string
          version: string
        }
        Insert: {
          approved_by?: string | null
          client_id: string
          created_at?: string
          delivered_date?: string | null
          detail?: Json | null
          due_date: string
          id?: string
          linked_task_id?: number | null
          name: string
          original_id: string
          responsible_party?: string
          responsible_team?: string | null
          status: string
          type: string
          updated_at?: string
          version?: string
        }
        Update: {
          approved_by?: string | null
          client_id?: string
          created_at?: string
          delivered_date?: string | null
          detail?: Json | null
          due_date?: string
          id?: string
          linked_task_id?: number | null
          name?: string
          original_id?: string
          responsible_party?: string
          responsible_team?: string | null
          status?: string
          type?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          client_id: string
          created_at: string
          date: string
          from: string
          id: string
          original_id: string
          preview: string
          status: string
          subject: string
          to: string[]
          type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date: string
          from: string
          id?: string
          original_id: string
          preview: string
          status: string
          subject: string
          to?: string[]
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string
          from?: string
          id?: string
          original_id?: string
          preview?: string
          status?: string
          subject?: string
          to?: string[]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gerente_client_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          action_items: string[]
          agreements: string[]
          attendees: string[]
          client_id: string
          created_at: string
          date: string
          id: string
          next_meeting: string | null
          original_id: string
          presentation_snapshot: Json | null
          summary: string
          title: string
          updated_at: string
          visible_to_client: boolean
        }
        Insert: {
          action_items?: string[]
          agreements?: string[]
          attendees?: string[]
          client_id: string
          created_at?: string
          date: string
          id?: string
          next_meeting?: string | null
          original_id: string
          presentation_snapshot?: Json | null
          summary: string
          title: string
          updated_at?: string
          visible_to_client?: boolean
        }
        Update: {
          action_items?: string[]
          agreements?: string[]
          attendees?: string[]
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          next_meeting?: string | null
          original_id?: string
          presentation_snapshot?: Json | null
          summary?: string
          title?: string
          updated_at?: string
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          client_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          progress: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          progress?: number
          start_date: string
          status: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          progress?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_data: {
        Row: {
          client_id: string
          created_at: string
          data: Json
          data_key: string
          id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          data?: Json
          data_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          data?: Json
          data_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_feedback: {
        Row: {
          comments: string | null
          created_at: string
          deliverable_ratings: Json | null
          id: string
          media_urls: Json | null
          overall_sentiment: string | null
          priority_rankings: Json | null
          service_quality: string | null
          shared_presentation_id: string
          sysde_response_rating: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          deliverable_ratings?: Json | null
          id?: string
          media_urls?: Json | null
          overall_sentiment?: string | null
          priority_rankings?: Json | null
          service_quality?: string | null
          shared_presentation_id: string
          sysde_response_rating?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          deliverable_ratings?: Json | null
          id?: string
          media_urls?: Json | null
          overall_sentiment?: string | null
          priority_rankings?: Json | null
          service_quality?: string | null
          shared_presentation_id?: string
          sysde_response_rating?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_feedback_shared_presentation_id_fkey"
            columns: ["shared_presentation_id"]
            isOneToOne: false
            referencedRelation: "shared_presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      risks: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          impact: string
          mitigation: string | null
          original_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          id?: string
          impact: string
          mitigation?: string | null
          original_id: string
          status: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          impact?: string
          mitigation?: string | null
          original_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_presentations: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string
          id: string
          presentation_snapshot: Json
          selected_slides: number[]
          title: string
          token: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string
          id?: string
          presentation_snapshot: Json
          selected_slides?: number[]
          title: string
          token?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          presentation_snapshot?: Json
          selected_slides?: number[]
          title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_presentations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          changed_by: string
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
        }
        Insert: {
          changed_by?: string
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          tag: string
          task_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          tag: string
          task_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          tag?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignees: Json
          client_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          original_id: number
          owner: string
          priority: string
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assignees?: Json
          client_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          original_id: number
          owner: string
          priority: string
          status: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assignees?: Json
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          original_id?: number
          owner?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "pm" | "gerente"
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
      app_role: ["admin", "pm", "gerente"],
    },
  },
} as const
