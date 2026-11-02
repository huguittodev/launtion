/**
 * persistence-adapter.ts
 *
 * Unified persistence abstraction decoupling Next.js routes from Supabase network transport.
 * Allows deterministic, offline test execution in CI while running strict RLS and Zod validation.
 */

import { randomUUID } from 'node:crypto';
import type { ProjectRow, Database } from './types';
import type { CreateProjectInput, UpdateProjectInput, ProjectSummary } from './schema';
import { getSupabaseServerClient } from './server';

export interface ProjectPersistenceAdapter {
  listProjects(userId: string): Promise<ProjectSummary[]>;
  getProject(userId: string, projectId: string): Promise<ProjectRow | null>;
  createProject(userId: string, input: CreateProjectInput): Promise<ProjectRow>;
  updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectRow | null>;
  deleteProject(userId: string, projectId: string): Promise<boolean>;
  clear?(): void;
}

/**
 * In-Memory persistence adapter for CI, unit testing, and offline development.
 * Strictly enforces user isolation (User A cannot access User B's projects).
 */
export class InMemoryPersistenceAdapter implements ProjectPersistenceAdapter {
  private projects: Map<string, ProjectRow> = new Map();

  public async listProjects(userId: string): Promise<ProjectSummary[]> {
    const userProjects = Array.from(this.projects.values())
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return userProjects.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail_url: p.thumbnail_url,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }

  public async getProject(userId: string, projectId: string): Promise<ProjectRow | null> {
    const project = this.projects.get(projectId);
    if (!project || project.user_id !== userId) {
      return null;
    }
    return project;
  }

  public async createProject(userId: string, input: CreateProjectInput): Promise<ProjectRow> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const newProject: ProjectRow = {
      id,
      user_id: userId,
      name: input.name,
      scene_graph: input.sceneGraph,
      thumbnail_url: input.thumbnail_url ?? null,
      created_at: now,
      updated_at: now,
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  public async updateProject(
    userId: string,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<ProjectRow | null> {
    const existing = this.projects.get(projectId);
    if (!existing || existing.user_id !== userId) {
      return null;
    }

    const updated: ProjectRow = {
      ...existing,
      name: input.name ?? existing.name,
      scene_graph: input.sceneGraph ?? existing.scene_graph,
      thumbnail_url: input.thumbnail_url !== undefined ? input.thumbnail_url : existing.thumbnail_url,
      updated_at: new Date().toISOString(),
    };
    this.projects.set(projectId, updated);
    return updated;
  }

  public async deleteProject(userId: string, projectId: string): Promise<boolean> {
    const existing = this.projects.get(projectId);
    if (!existing || existing.user_id !== userId) {
      return false;
    }
    this.projects.delete(projectId);
    return true;
  }

  public clear(): void {
    this.projects.clear();
  }
}

interface SupabaseProjectsTableQuery {
  insert(values: Database['public']['Tables']['projects']['Insert']): {
    select(): {
      single(): Promise<{ data: ProjectRow | null; error: Error | null }>;
    };
  };
  update(values: Partial<Database['public']['Tables']['projects']['Update']>): {
    eq(column: string, value: string): {
      select(): {
        maybeSingle(): Promise<{ data: ProjectRow | null; error: Error | null }>;
      };
    };
  };
}

/**
 * Supabase live database persistence adapter.
 * Uses Server Client with user session cookies, inheriting Postgres RLS enforcement.
 */
export class SupabasePersistenceAdapter implements ProjectPersistenceAdapter {
  public async listProjects(_userId: string): Promise<ProjectSummary[]> {
    void _userId;
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error('Supabase client unavailable');

    // RLS in Supabase automatically filters to auth.uid() = user_id
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, thumbnail_url, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Supabase query error: ${error.message}`);
    return (data as ProjectSummary[]) ?? [];
  }

  public async getProject(userId: string, projectId: string): Promise<ProjectRow | null> {
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error('Supabase client unavailable');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw new Error(`Supabase query error: ${error.message}`);
    return data as ProjectRow | null;
  }

  public async createProject(userId: string, input: CreateProjectInput): Promise<ProjectRow> {
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error('Supabase client unavailable');

    const insertPayload: Database['public']['Tables']['projects']['Insert'] = {
      user_id: userId,
      name: input.name,
      scene_graph: input.sceneGraph,
      thumbnail_url: input.thumbnail_url ?? null,
    };

    const query = supabase.from('projects') as unknown as SupabaseProjectsTableQuery;
    const { data, error } = await query
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new Error(`Supabase insert error: ${error.message}`);
    return data as ProjectRow;
  }

  public async updateProject(
    userId: string,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<ProjectRow | null> {
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error('Supabase client unavailable');

    const patch: Partial<Database['public']['Tables']['projects']['Update']> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.sceneGraph !== undefined) patch.scene_graph = input.sceneGraph;
    if (input.thumbnail_url !== undefined) patch.thumbnail_url = input.thumbnail_url;

    const query = supabase.from('projects') as unknown as SupabaseProjectsTableQuery;
    const { data, error } = await query
      .update(patch)
      .eq('id', projectId)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Supabase update error: ${error.message}`);
    return data as ProjectRow | null;
  }

  public async deleteProject(userId: string, projectId: string): Promise<boolean> {
    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new Error('Supabase client unavailable');

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) return false;
    return true;
  }
}

// Global singleton instance for in-memory fallback
const inMemoryAdapterInstance = new InMemoryPersistenceAdapter();

export function getPersistenceAdapter(): ProjectPersistenceAdapter {
  const isMock = process.env.MOCK_SUPABASE === 'true' || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isMock) {
    return inMemoryAdapterInstance;
  }
  return new SupabasePersistenceAdapter();
}

export function getInMemoryAdapter(): InMemoryPersistenceAdapter {
  return inMemoryAdapterInstance;
}
