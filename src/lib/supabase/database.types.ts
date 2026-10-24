
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "game_answers": {
                  Row: {
                    "answer": NonNullable<Json>,"fraction": number,"id": string,"player_id": string,"points": number,"question_index": number,"question_key": string,"response_ms": number,"session_id": string,"status": string,"submitted_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"fraction"?: number,"id"?: string,"player_id": string,"points"?: number,"question_index": number,"question_key": string,"response_ms": number,"session_id": string,"status": string,"submitted_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"fraction"?: number,"id"?: string,"player_id"?: string,"points"?: number,"question_index"?: number,"question_key"?: string,"response_ms"?: number,"session_id"?: string,"status"?: string,"submitted_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_answers_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "game_players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_answers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "game_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"game_events": {
                  Row: {
                    "created_at": string,"id": number,"payload": NonNullable<Json>,"session_id": string,"state_version": number,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"session_id": string,"state_version": number,"type": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"payload"?: NonNullable<Json>,"session_id"?: string,"state_version"?: number,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "game_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"game_players": {
                  Row: {
                    "answered_count": number,"correct_count": number,"id": string,"joined_at": string,"kicked": boolean,"last_seen_at": string,"nickname": string,"nickname_key": string,"previous_rank": number | null,"score": number,"session_id": string,"team_id": string | null,"token_hash": string,"total_response_ms": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_count"?: number,"correct_count"?: number,"id"?: string,"joined_at"?: string,"kicked"?: boolean,"last_seen_at"?: string,"nickname": string,"nickname_key": string,"previous_rank"?: number | null,"score"?: number,"session_id": string,"team_id"?: string | null,"token_hash": string,"total_response_ms"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "answered_count"?: number,"correct_count"?: number,"id"?: string,"joined_at"?: string,"kicked"?: boolean,"last_seen_at"?: string,"nickname"?: string,"nickname_key"?: string,"previous_rank"?: number | null,"score"?: number,"session_id"?: string,"team_id"?: string | null,"token_hash"?: string,"total_response_ms"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_players_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "game_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "game_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_players_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"game_question_results": {
                  Row: {
                    "closed_at": string,"id": string,"question_index": number,"question_key": string,"session_id": string,"stats": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string,"id"?: string,"question_index": number,"question_key": string,"session_id": string,"stats": NonNullable<Json>
                  }
                  Update: {
                    "closed_at"?: string,"id"?: string,"question_index"?: number,"question_key"?: string,"session_id"?: string,"stats"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_question_results_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "game_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"game_sessions": {
                  Row: {
                    "created_at": string,"current_index": number,"finished_at": string | null,"host_id": string | null,"id": string,"mode": string,"paused_remaining_ms": number | null,"pin": string | null,"pin_expires_at": string | null,"question_deadline": string | null,"question_order": (number)[],"question_started_at": string | null,"quiz_id": string | null,"quiz_snapshot": NonNullable<Json>,"quiz_title": string,"seed": string,"settings": NonNullable<Json>,"started_at": string | null,"state": string,"state_version": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_index"?: number,"finished_at"?: string | null,"host_id"?: string | null,"id"?: string,"mode": string,"paused_remaining_ms"?: number | null,"pin"?: string | null,"pin_expires_at"?: string | null,"question_deadline"?: string | null,"question_order": (number)[],"question_started_at"?: string | null,"quiz_id"?: string | null,"quiz_snapshot": NonNullable<Json>,"quiz_title"?: string,"seed": string,"settings": NonNullable<Json>,"started_at"?: string | null,"state"?: string,"state_version"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_index"?: number,"finished_at"?: string | null,"host_id"?: string | null,"id"?: string,"mode"?: string,"paused_remaining_ms"?: number | null,"pin"?: string | null,"pin_expires_at"?: string | null,"question_deadline"?: string | null,"question_order"?: (number)[],"question_started_at"?: string | null,"quiz_id"?: string | null,"quiz_snapshot"?: NonNullable<Json>,"quiz_title"?: string,"seed"?: string,"settings"?: NonNullable<Json>,"started_at"?: string | null,"state"?: string,"state_version"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_sessions_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_sessions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"game_teams": {
                  Row: {
                    "color": string,"id": string,"name": string,"position": number,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color": string,"id"?: string,"name": string,"position": number,"session_id": string
                  }
                  Update: {
                    "color"?: string,"id"?: string,"name"?: string,"position"?: number,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_teams_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "game_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"quiz_media": {
                  Row: {
                    "created_at": string,"id": string,"mime_type": string,"owner_id": string,"path": string,"size_bytes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"mime_type": string,"owner_id": string,"path": string,"size_bytes": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"mime_type"?: string,"owner_id"?: string,"path"?: string,"size_bytes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"id": string,"position": number,"question_key": string,"quiz_id": string,"schema_version": number,"title": string,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data": NonNullable<Json>,"id"?: string,"position": number,"question_key": string,"quiz_id": string,"schema_version"?: number,"title"?: string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"position"?: number,"question_key"?: string,"quiz_id"?: string,"schema_version"?: number,"title"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "category": string | null,"cover_image": Json | null,"created_at": string,"description": string,"id": string,"is_playable": boolean,"issue_count": number,"last_played_at": string | null,"owner_id": string,"practice_shared": boolean,"question_count": number,"schema_version": number,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"cover_image"?: Json | null,"created_at"?: string,"description"?: string,"id"?: string,"is_playable"?: boolean,"issue_count"?: number,"last_played_at"?: string | null,"owner_id": string,"practice_shared"?: boolean,"question_count"?: number,"schema_version"?: number,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string | null,"cover_image"?: Json | null,"created_at"?: string,"description"?: string,"id"?: string,"is_playable"?: boolean,"issue_count"?: number,"last_played_at"?: string | null,"owner_id"?: string,"practice_shared"?: boolean,"question_count"?: number,"schema_version"?: number,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quizzes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits"?: number,"key": string,"window_start"?: string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cleanup_stale_games":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"duplicate_quiz":
{ Args: { "p_quiz_id": string }; Returns: string
                           },
"finalize_question":
{ Args: { "p_previous_ranks": Json,"p_question_index": number,"p_question_key": string,"p_session_id": string,"p_stats": Json }; Returns: boolean
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"recalculate_scores":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"save_quiz":
{ Args: { "p_is_playable": boolean,"p_issue_count": number,"p_meta": Json,"p_questions": Json,"p_quiz_id": string }; Returns: string
                           },
"submit_answer":
{ Args: { "p_allow_change": boolean,"p_answer": Json,"p_fraction": number,"p_player_id": string,"p_points": number,"p_question_index": number,"p_question_key": string,"p_response_ms": number,"p_session_id": string,"p_status": string }; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
