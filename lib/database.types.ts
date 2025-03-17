export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
          updated_at: string
          subscription_id: string | null
          is_admin: boolean
        }
        Insert: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          updated_at?: string
          subscription_id?: string | null
          is_admin?: boolean
        }
        Update: {
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          updated_at?: string
          subscription_id?: string | null
          is_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      quizzes: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          questions: Json
          created_at: string
          updated_at: string
          subject: string | null
          category: string | null
          settings: Json
          is_language_learning: boolean | null
          source_language: string | null
          target_language: string | null
          extraction_type: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          questions: Json
          created_at?: string
          updated_at?: string
          subject?: string | null
          category?: string | null
          settings?: Json
          is_language_learning?: boolean | null
          source_language?: string | null
          target_language?: string | null
          extraction_type?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          questions?: Json
          created_at?: string
          updated_at?: string
          subject?: string | null
          category?: string | null
          settings?: Json
          is_language_learning?: boolean | null
          source_language?: string | null
          target_language?: string | null
          extraction_type?: string | null
        }
      }
      learning_progress: {
        Row: {
          id: string
          user_id: string
          quiz_id: string
          progress: Json
          score: number
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quiz_id: string
          progress?: Json
          score?: number
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          quiz_id?: string
          progress?: Json
          score?: number
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          status: string
          plan_type: string
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          status?: string
          plan_type?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          status?: string
          plan_type?: string
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      feature_suggestions: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
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
  }
} 