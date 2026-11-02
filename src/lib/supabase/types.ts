/**
 * types.ts
 *
 * Database type definitions for Supabase public schema.
 */

import type { SceneGraph } from '../scene-graph/types';
import type { RenderJobStatus, RenderSettings, RenderError } from '../render/types';

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          scene_graph: SceneGraph;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          scene_graph: SceneGraph;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          scene_graph?: SceneGraph;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      render_jobs: {
        Row: {
          id: string;
          project_id: string | null;
          user_id: string;
          composition_id: string;
          status: RenderJobStatus;
          progress: number;
          output_url: string | null;
          error: RenderError | null;
          settings: RenderSettings;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id: string;
          project_id?: string | null;
          user_id: string;
          composition_id?: string;
          status?: RenderJobStatus;
          progress?: number;
          output_url?: string | null;
          error?: RenderError | null;
          settings?: RenderSettings;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          user_id?: string;
          composition_id?: string;
          status?: RenderJobStatus;
          progress?: number;
          output_url?: string | null;
          error?: RenderError | null;
          settings?: RenderSettings;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          name: string;
          file_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          name: string;
          file_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          name?: string;
          file_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type RenderJobRow = Database['public']['Tables']['render_jobs']['Row'];
export type RenderJobInsert = Database['public']['Tables']['render_jobs']['Insert'];
export type RenderJobUpdate = Database['public']['Tables']['render_jobs']['Update'];

export type AssetRow = Database['public']['Tables']['assets']['Row'];
export type AssetInsert = Database['public']['Tables']['assets']['Insert'];
export type AssetUpdate = Database['public']['Tables']['assets']['Update'];
