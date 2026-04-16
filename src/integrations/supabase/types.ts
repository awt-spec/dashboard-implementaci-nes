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
      ai_usage_logs: {
        Row: {
          client_id: string | null
          completion_tokens: number
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          model: string
          prompt_tokens: number
          status: string
          total_tokens: number
        }
        Insert: {
          client_id?: string | null
          completion_tokens?: number
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          model: string
          prompt_tokens?: number
          status?: string
          total_tokens?: number
        }
        Update: {
          client_id?: string | null
          completion_tokens?: number
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          model?: string
          prompt_tokens?: number
          status?: string
          total_tokens?: number
        }
        Relationships: []
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
      client_contracts: {
        Row: {
          auto_renewal: boolean
          client_id: string
          contract_type: string
          created_at: string
          currency: string
          end_date: string | null
          hourly_rate: number
          id: string
          included_hours: number
          is_active: boolean
          monthly_value: number
          notes: string | null
          payment_terms: string | null
          penalty_clause: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          auto_renewal?: boolean
          client_id: string
          contract_type?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          hourly_rate?: number
          id?: string
          included_hours?: number
          is_active?: boolean
          monthly_value?: number
          notes?: string | null
          payment_terms?: string | null
          penalty_clause?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          auto_renewal?: boolean
          client_id?: string
          contract_type?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          hourly_rate?: number
          id?: string
          included_hours?: number
          is_active?: boolean
          monthly_value?: number
          notes?: string | null
          payment_terms?: string | null
          penalty_clause?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
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
      client_slas: {
        Row: {
          business_hours_only: boolean
          case_type: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          penalty_amount: number | null
          penalty_description: string | null
          priority_level: string
          resolution_time_hours: number
          response_time_hours: number
          updated_at: string
        }
        Insert: {
          business_hours_only?: boolean
          case_type?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          priority_level: string
          resolution_time_hours?: number
          response_time_hours?: number
          updated_at?: string
        }
        Update: {
          business_hours_only?: boolean
          case_type?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          penalty_amount?: number | null
          penalty_description?: string | null
          priority_level?: string
          resolution_time_hours?: number
          response_time_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_team_members: {
        Row: {
          client_id: string
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          client_type: string
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
          client_type?: string
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
          client_type?: string
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
      communication_threads: {
        Row: {
          category: string
          client_id: string
          created_at: string
          created_by: string
          id: string
          linked_deliverable_id: string | null
          linked_task_id: string | null
          linked_thread_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_id: string
          created_at?: string
          created_by?: string
          id?: string
          linked_deliverable_id?: string | null
          linked_task_id?: string | null
          linked_thread_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          linked_deliverable_id?: string | null
          linked_task_id?: string | null
          linked_thread_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_linked_deliverable_id_fkey"
            columns: ["linked_deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_linked_thread_id_fkey"
            columns: ["linked_thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
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
      devops_connections: {
        Row: {
          auto_sync: boolean
          client_id: string
          created_at: string
          default_work_item_type: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          organization: string
          priority_mapping: Json
          project: string
          state_mapping: Json
          sync_interval_minutes: number
          team: string | null
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          client_id: string
          created_at?: string
          default_work_item_type?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization: string
          priority_mapping?: Json
          project: string
          state_mapping?: Json
          sync_interval_minutes?: number
          team?: string | null
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          client_id?: string
          created_at?: string
          default_work_item_type?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          organization?: string
          priority_mapping?: Json
          project?: string
          state_mapping?: Json
          sync_interval_minutes?: number
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      devops_sync_logs: {
        Row: {
          client_id: string
          created_at: string
          details: Json | null
          direction: string
          duration_ms: number
          error_message: string | null
          id: string
          items_failed: number
          items_pulled: number
          items_pushed: number
          status: string
          triggered_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          details?: Json | null
          direction: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          items_failed?: number
          items_pulled?: number
          items_pushed?: number
          status?: string
          triggered_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          details?: Json | null
          direction?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          items_failed?: number
          items_pulled?: number
          items_pushed?: number
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      devops_sync_mappings: {
        Row: {
          client_id: string
          created_at: string
          devops_id: string
          devops_rev: number | null
          devops_url: string | null
          entity_type: string
          id: string
          last_direction: string | null
          last_synced_at: string
          local_id: string
          metadata: Json | null
        }
        Insert: {
          client_id: string
          created_at?: string
          devops_id: string
          devops_rev?: number | null
          devops_url?: string | null
          entity_type: string
          id?: string
          last_direction?: string | null
          last_synced_at?: string
          local_id: string
          metadata?: Json | null
        }
        Update: {
          client_id?: string
          created_at?: string
          devops_id?: string
          devops_rev?: number | null
          devops_url?: string | null
          entity_type?: string
          id?: string
          last_direction?: string | null
          last_synced_at?: string
          local_id?: string
          metadata?: Json | null
        }
        Relationships: []
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
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
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
      pm_ai_analysis: {
        Row: {
          analysis_type: string
          client_priorities: Json | null
          created_at: string
          duration_estimate_weeks: number | null
          executive_summary: string | null
          full_analysis: Json | null
          id: string
          metrics: Json | null
          model: string | null
          recommendations: Json | null
          risks: Json | null
          scope: string | null
          team_health_score: number | null
        }
        Insert: {
          analysis_type?: string
          client_priorities?: Json | null
          created_at?: string
          duration_estimate_weeks?: number | null
          executive_summary?: string | null
          full_analysis?: Json | null
          id?: string
          metrics?: Json | null
          model?: string | null
          recommendations?: Json | null
          risks?: Json | null
          scope?: string | null
          team_health_score?: number | null
        }
        Update: {
          analysis_type?: string
          client_priorities?: Json | null
          created_at?: string
          duration_estimate_weeks?: number | null
          executive_summary?: string | null
          full_analysis?: Json | null
          id?: string
          metrics?: Json | null
          model?: string | null
          recommendations?: Json | null
          risks?: Json | null
          scope?: string | null
          team_health_score?: number | null
        }
        Relationships: []
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
          category: string
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
          category?: string
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
          category?: string
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
      shared_support_presentations: {
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
        Relationships: []
      }
      support_data_updates: {
        Row: {
          client_id: string
          created_at: string
          id: string
          records_count: number
          source_name: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          records_count?: number
          source_name?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          records_count?: number
          source_name?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_data_updates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      support_minutes: {
        Row: {
          action_items: string[]
          agreements: string[]
          attendees: string[]
          cases_referenced: string[]
          client_id: string
          created_at: string
          date: string
          id: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          action_items?: string[]
          agreements?: string[]
          attendees?: string[]
          cases_referenced?: string[]
          client_id: string
          created_at?: string
          date: string
          id?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_items?: string[]
          agreements?: string[]
          attendees?: string[]
          cases_referenced?: string[]
          client_id?: string
          created_at?: string
          date?: string
          id?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_presentation_feedback: {
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
        }
        Relationships: [
          {
            foreignKeyName: "support_presentation_feedback_shared_presentation_id_fkey"
            columns: ["shared_presentation_id"]
            isOneToOne: false
            referencedRelation: "shared_support_presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_sprints: {
        Row: {
          capacity_points: number
          client_id: string
          created_at: string
          end_date: string | null
          goal: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity_points?: number
          client_id: string
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity_points?: number
          client_id?: string
          created_at?: string
          end_date?: string | null
          goal?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          ticket_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          depends_on_ticket_id: string
          id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: string
          depends_on_ticket_id: string
          id?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: string
          depends_on_ticket_id?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_dependencies_depends_on_ticket_id_fkey"
            columns: ["depends_on_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_dependencies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_notes: {
        Row: {
          author: string
          created_at: string
          id: string
          message: string
          ticket_id: string
          visibility: string
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          message: string
          ticket_id: string
          visibility?: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          sort_order: number
          ticket_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          ticket_id: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          ticket_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_subtasks_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          tag: string
          ticket_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          tag: string
          ticket_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          tag?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_tags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_classification: string | null
          ai_risk_level: string | null
          ai_summary: string | null
          asunto: string
          backlog_rank: number | null
          business_value: number | null
          case_actions: Json
          case_agreements: Json
          client_id: string
          created_at: string
          dias_antiguedad: number
          effort: number | null
          estado: string
          fecha_entrega: string | null
          fecha_registro: string | null
          id: string
          notas: string | null
          prioridad: string
          producto: string
          responsable: string | null
          scrum_status: string | null
          sprint_id: string | null
          story_points: number | null
          ticket_id: string
          tipo: string
          updated_at: string
          visibility: string
        }
        Insert: {
          ai_classification?: string | null
          ai_risk_level?: string | null
          ai_summary?: string | null
          asunto?: string
          backlog_rank?: number | null
          business_value?: number | null
          case_actions?: Json
          case_agreements?: Json
          client_id: string
          created_at?: string
          dias_antiguedad?: number
          effort?: number | null
          estado?: string
          fecha_entrega?: string | null
          fecha_registro?: string | null
          id?: string
          notas?: string | null
          prioridad?: string
          producto?: string
          responsable?: string | null
          scrum_status?: string | null
          sprint_id?: string | null
          story_points?: number | null
          ticket_id: string
          tipo?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          ai_classification?: string | null
          ai_risk_level?: string | null
          ai_summary?: string | null
          asunto?: string
          backlog_rank?: number | null
          business_value?: number | null
          case_actions?: Json
          case_agreements?: Json
          client_id?: string
          created_at?: string
          dias_antiguedad?: number
          effort?: number | null
          estado?: string
          fecha_entrega?: string | null
          fecha_registro?: string | null
          id?: string
          notas?: string | null
          prioridad?: string
          producto?: string
          responsable?: string | null
          scrum_status?: string | null
          sprint_id?: string | null
          story_points?: number | null
          ticket_id?: string
          tipo?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "support_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sysde_team_members: {
        Row: {
          created_at: string
          cv_analysis: Json | null
          cv_filename: string | null
          cv_recommended_clients: Json | null
          cv_seniority: string | null
          cv_skills: string[] | null
          cv_uploaded_at: string | null
          cv_url: string | null
          cv_years_experience: number | null
          department: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cv_analysis?: Json | null
          cv_filename?: string | null
          cv_recommended_clients?: Json | null
          cv_seniority?: string | null
          cv_skills?: string[] | null
          cv_uploaded_at?: string | null
          cv_url?: string | null
          cv_years_experience?: number | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cv_analysis?: Json | null
          cv_filename?: string | null
          cv_recommended_clients?: Json | null
          cv_seniority?: string | null
          cv_skills?: string[] | null
          cv_uploaded_at?: string | null
          cv_url?: string | null
          cv_years_experience?: number | null
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
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
          backlog_rank: number | null
          business_value: number | null
          client_id: string
          created_at: string
          description: string | null
          due_date: string
          effort: number | null
          id: string
          original_id: number
          owner: string
          priority: string
          scrum_status: string | null
          sprint_id: string | null
          status: string
          story_points: number | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          assignees?: Json
          backlog_rank?: number | null
          business_value?: number | null
          client_id: string
          created_at?: string
          description?: string | null
          due_date: string
          effort?: number | null
          id?: string
          original_id: number
          owner: string
          priority: string
          scrum_status?: string | null
          sprint_id?: string | null
          status: string
          story_points?: number | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          assignees?: Json
          backlog_rank?: number | null
          business_value?: number | null
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          effort?: number | null
          id?: string
          original_id?: number
          owner?: string
          priority?: string
          scrum_status?: string | null
          sprint_id?: string | null
          status?: string
          story_points?: number | null
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
          {
            foreignKeyName: "tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "support_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          thread_id: string
          user_avatar: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          thread_id: string
          user_avatar?: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          thread_id?: string
          user_avatar?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
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
