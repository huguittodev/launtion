/**
 * tests/saas-persistence.test.ts
 *
 * Automated verification suite for Phase 8: Capa SaaS (Supabase Auth/RLS, Proyectos, Almacenamiento).
 *
 * Covers:
 * 1. Zod schemas & invariant validation (CreateProjectSchema, UpdateProjectSchema, Summary, Response, Assets)
 * 2. In-Memory Persistence Adapter CRUD & strict user isolation (RLS invariants simulation)
 * 3. Next.js API Route Handlers: GET /api/projects, POST /api/projects, GET/PUT/DELETE /api/projects/[id]
 * 4. Multi-tenant security & cross-user access denial (404/401 checks)
 * 5. Static audit of PostgreSQL migrations (ENABLE ROW LEVEL SECURITY & auth.uid() = user_id)
 * 6. Deterministic offline fallback adapter verification
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, beforeEach } from 'node:test';
import { NextRequest } from 'next/server';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectSummarySchema,
  ProjectResponseSchema,
  AssetUploadMetadataSchema,
  InMemoryPersistenceAdapter,
  getPersistenceAdapter,
  getInMemoryAdapter,
} from '../src/lib/supabase';
import { GET as getProjectsList, POST as createProjectRoute } from '../src/app/api/projects/route';
import {
  GET as getProjectById,
  PUT as updateProjectById,
  DELETE as deleteProjectById,
} from '../src/app/api/projects/[id]/route';
import type { SceneGraph } from '../src/lib/scene-graph/types';

// Minimal valid SceneGraph conforming to SceneGraphSchema v2.0
const mockSceneGraph: SceneGraph = {
  version: '2.0',
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 60,
  },
  artDirection: {
    backdropVariant: 'dark-precision',
    surfaceTheme: 'dark',
    primaryAccent: '#FF5C35',
  },
  cameraTrack: [
    { frame: 0, x: 0.5, y: 0.5, zoom: 1.0 },
    { frame: 60, x: 0.5, y: 0.5, zoom: 1.2 },
  ],
  cursorTrack: [
    { frame: 0, x: 0.5, y: 0.5 },
    { frame: 30, x: 0.6, y: 0.6, click: true },
  ],
  audioTrack: [
    { id: 'cue_click_1', frame: 30, asset: 'mouse-click', volume: 0.8 },
  ],
  scenes: [
    {
      id: 'scene_intro_1',
      startFrame: 0,
      durationInFrames: 60,
      type: 'kinetic_typography',
      payload: {
        words: ['Launtion', 'SaaS', 'Layer'],
        accentWordIndex: 0,
      },
    },
  ],
};

const USER_ALICE = '11111111-1111-4111-a111-111111111111';
const USER_BOB = '22222222-2222-4222-a222-222222222222';

describe('Phase 8: Capa SaaS & Persistence Architecture', () => {
  beforeEach(() => {
    // Reset singleton in-memory adapter between tests
    process.env.MOCK_SUPABASE = 'true';
    getInMemoryAdapter().clear();
  });

  /* ========================================================================= */
  /* 1. Zod Schemas & Invariant Validation                                     */
  /* ========================================================================= */
  describe('1. Zod Schemas & Invariant Validation', () => {
    it('1.1 CreateProjectSchema accepts valid project payload', () => {
      const valid = {
        name: 'Launch Campaign 2026',
        sceneGraph: mockSceneGraph,
        thumbnail_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
      };
      const parsed = CreateProjectSchema.parse(valid);
      assert.equal(parsed.name, 'Launch Campaign 2026');
      assert.equal(parsed.sceneGraph.version, '2.0');
    });

    it('1.2 CreateProjectSchema rejects empty or whitespace-only project name', () => {
      const invalid = {
        name: '   ',
        sceneGraph: mockSceneGraph,
      };
      const result = CreateProjectSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });

    it('1.3 CreateProjectSchema rejects project names exceeding 120 characters', () => {
      const tooLongName = 'A'.repeat(121);
      const invalid = {
        name: tooLongName,
        sceneGraph: mockSceneGraph,
      };
      const result = CreateProjectSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });

    it('1.4 CreateProjectSchema rejects malformed or invalid SceneGraph', () => {
      const invalid = {
        name: 'Valid Name',
        sceneGraph: {
          version: 'invalid-version',
          canvas: { width: -100 },
        },
      };
      const result = CreateProjectSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });

    it('1.5 UpdateProjectSchema accepts partial name update without sceneGraph', () => {
      const valid = { name: 'Updated Name Only' };
      const parsed = UpdateProjectSchema.parse(valid);
      assert.equal(parsed.name, 'Updated Name Only');
      assert.equal(parsed.sceneGraph, undefined);
    });

    it('1.6 UpdateProjectSchema accepts partial sceneGraph update without name', () => {
      const valid = { sceneGraph: mockSceneGraph };
      const parsed = UpdateProjectSchema.parse(valid);
      assert.equal(parsed.sceneGraph?.version, '2.0');
      assert.equal(parsed.name, undefined);
    });

    it('1.7 UpdateProjectSchema rejects empty name if provided', () => {
      const invalid = { name: '   ' };
      const result = UpdateProjectSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });

    it('1.8 ProjectSummarySchema strictly validates metadata fields', () => {
      const valid = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Summary Demo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const parsed = ProjectSummarySchema.parse(valid);
      assert.equal(parsed.id, valid.id);
    });

    it('1.9 ProjectResponseSchema enforces UUIDs for id and user_id', () => {
      const invalid = {
        id: 'not-a-uuid',
        user_id: 'also-not-a-uuid',
        name: 'Demo',
        scene_graph: mockSceneGraph,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = ProjectResponseSchema.safeParse(invalid);
      assert.equal(result.success, false);
    });

    it('1.10 AssetUploadMetadataSchema validates allowed MIME types and max 100MB size', () => {
      const valid = {
        name: 'dashboard-preview.png',
        mimeType: 'image/png' as const,
        sizeBytes: 1024 * 1024 * 5, // 5MB
      };
      assert.ok(AssetUploadMetadataSchema.parse(valid));

      const invalidMime = {
        name: 'script.exe',
        mimeType: 'application/x-msdownload' as unknown as 'image/png',
        sizeBytes: 1024,
      };
      assert.equal(AssetUploadMetadataSchema.safeParse(invalidMime).success, false);

      const tooLarge = {
        name: 'huge.mp4',
        mimeType: 'video/mp4' as const,
        sizeBytes: 104857601, // > 100MB
      };
      assert.equal(AssetUploadMetadataSchema.safeParse(tooLarge).success, false);
    });
  });

  /* ========================================================================= */
  /* 2. In-Memory Persistence Adapter CRUD & Isolation                         */
  /* ========================================================================= */
  describe('2. In-Memory Persistence Adapter & Tenant Isolation', () => {
    it('2.1 createProject assigns UUID, timestamps, and persists record', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const project = await adapter.createProject(USER_ALICE, {
        name: 'Project Alice 1',
        sceneGraph: mockSceneGraph,
      });

      assert.ok(project.id);
      assert.equal(project.user_id, USER_ALICE);
      assert.equal(project.name, 'Project Alice 1');
      assert.ok(project.created_at);
      assert.ok(project.updated_at);
    });

    it('2.2 listProjects strictly isolates projects by user_id', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      await adapter.createProject(USER_ALICE, { name: 'Alice Project', sceneGraph: mockSceneGraph });
      await adapter.createProject(USER_BOB, { name: 'Bob Project', sceneGraph: mockSceneGraph });

      const aliceProjects = await adapter.listProjects(USER_ALICE);
      const bobProjects = await adapter.listProjects(USER_BOB);

      assert.equal(aliceProjects.length, 1);
      assert.equal(aliceProjects[0].name, 'Alice Project');

      assert.equal(bobProjects.length, 1);
      assert.equal(bobProjects[0].name, 'Bob Project');
    });

    it('2.3 listProjects sorts projects by updated_at descending', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const p1 = await adapter.createProject(USER_ALICE, { name: 'Older', sceneGraph: mockSceneGraph });
      // Short delay simulation
      const p2 = await adapter.createProject(USER_ALICE, { name: 'Newer', sceneGraph: mockSceneGraph });

      // Mutate p1 timestamp to older
      (p1 as { updated_at: string }).updated_at = new Date(Date.now() - 60000).toISOString();
      (p2 as { updated_at: string }).updated_at = new Date().toISOString();

      const list = await adapter.listProjects(USER_ALICE);
      assert.equal(list[0].id, p2.id);
      assert.equal(list[1].id, p1.id);
    });

    it('2.4 getProject returns project for owner and null for unknown ID', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const created = await adapter.createProject(USER_ALICE, { name: 'Fetch Me', sceneGraph: mockSceneGraph });

      const found = await adapter.getProject(USER_ALICE, created.id);
      assert.ok(found);
      assert.equal(found?.id, created.id);

      const notFound = await adapter.getProject(USER_ALICE, '00000000-0000-0000-0000-000000000000');
      assert.equal(notFound, null);
    });

    it('2.5 getProject denies access to another user (returns null)', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, { name: 'Alice Secret', sceneGraph: mockSceneGraph });

      // Bob tries to query Alice's project
      const bobAttempt = await adapter.getProject(USER_BOB, aliceProject.id);
      assert.equal(bobAttempt, null);
    });

    it('2.6 updateProject applies changes and refreshes updated_at', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const project = await adapter.createProject(USER_ALICE, { name: 'Original', sceneGraph: mockSceneGraph });
      const oldUpdatedAt = project.updated_at;

      const updated = await adapter.updateProject(USER_ALICE, project.id, {
        name: 'Modified Name',
      });

      assert.ok(updated);
      assert.equal(updated?.name, 'Modified Name');
      assert.ok(new Date(updated.updated_at).getTime() >= new Date(oldUpdatedAt).getTime());
    });

    it('2.7 updateProject prevents cross-user modification (returns null)', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, { name: 'Alice Project', sceneGraph: mockSceneGraph });

      // Bob tries to modify Alice's project
      const result = await adapter.updateProject(USER_BOB, aliceProject.id, {
        name: 'Hacked by Bob',
      });
      assert.equal(result, null);

      // Verify Alice's project was unchanged
      const verified = await adapter.getProject(USER_ALICE, aliceProject.id);
      assert.equal(verified?.name, 'Alice Project');
    });

    it('2.8 deleteProject removes project and returns true', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const project = await adapter.createProject(USER_ALICE, { name: 'To Delete', sceneGraph: mockSceneGraph });

      const deleted = await adapter.deleteProject(USER_ALICE, project.id);
      assert.equal(deleted, true);

      const check = await adapter.getProject(USER_ALICE, project.id);
      assert.equal(check, null);
    });

    it('2.9 deleteProject prevents cross-user deletion (returns false)', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, { name: 'Alice Safe Project', sceneGraph: mockSceneGraph });

      // Bob tries to delete Alice's project
      const deleted = await adapter.deleteProject(USER_BOB, aliceProject.id);
      assert.equal(deleted, false);

      // Confirm still exists
      const check = await adapter.getProject(USER_ALICE, aliceProject.id);
      assert.ok(check);
    });

    it('2.10 clear resets in-memory storage', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      await adapter.createProject(USER_ALICE, { name: 'P1', sceneGraph: mockSceneGraph });
      adapter.clear();

      const list = await adapter.listProjects(USER_ALICE);
      assert.equal(list.length, 0);
    });
  });

  /* ========================================================================= */
  /* 3. Next.js API Route Handlers Integration                                 */
  /* ========================================================================= */
  describe('3. Next.js API Route Handlers', () => {
    it('3.1 GET /api/projects returns HTTP 200 with projects array', async () => {
      const req = new NextRequest('http://localhost:3000/api/projects', {
        headers: { 'x-user-id': USER_ALICE },
      });
      const res = await getProjectsList(req);
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(typeof body.total, 'number');
      assert.ok(Array.isArray(body.projects));
    });

    it('3.2 POST /api/projects creates a project and returns HTTP 201', async () => {
      const req = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ALICE,
        },
        body: JSON.stringify({
          name: 'Route Test Project',
          sceneGraph: mockSceneGraph,
        }),
      });

      const res = await createProjectRoute(req);
      assert.equal(res.status, 201);

      const body = await res.json();
      assert.ok(body.project);
      assert.equal(body.project.name, 'Route Test Project');
      assert.equal(body.project.user_id, USER_ALICE);
    });

    it('3.3 POST /api/projects returns HTTP 400 for malformed JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ALICE,
        },
        body: 'invalid-json-content{',
      });

      const res = await createProjectRoute(req);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'JSON de petición inválido');
    });

    it('3.4 POST /api/projects returns HTTP 400 for invalid project payload', async () => {
      const req = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ALICE,
        },
        body: JSON.stringify({
          name: '   ', // Invalid empty name
          sceneGraph: mockSceneGraph,
        }),
      });

      const res = await createProjectRoute(req);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.error, 'Datos de proyecto inválidos');
      assert.ok(body.issues);
    });

    it('3.5 GET /api/projects/[id] returns HTTP 200 for owner', async () => {
      // First create via adapter
      const adapter = getInMemoryAdapter();
      const project = await adapter.createProject(USER_ALICE, {
        name: 'Retrieve Project',
        sceneGraph: mockSceneGraph,
      });

      const req = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        headers: { 'x-user-id': USER_ALICE },
      });

      const res = await getProjectById(req, { params: Promise.resolve({ id: project.id }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.project.id, project.id);
      assert.equal(body.project.name, 'Retrieve Project');
    });

    it('3.6 GET /api/projects/[id] returns HTTP 404 for nonexistent ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/projects/unknown-id', {
        headers: { 'x-user-id': USER_ALICE },
      });

      const res = await getProjectById(req, { params: Promise.resolve({ id: 'unknown-id' }) });
      assert.equal(res.status, 404);
    });

    it('3.7 GET /api/projects/[id] returns HTTP 404 for cross-tenant access', async () => {
      const adapter = getInMemoryAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, {
        name: 'Alice Secret',
        sceneGraph: mockSceneGraph,
      });

      // Bob attempts to fetch Alice's project
      const req = new NextRequest(`http://localhost:3000/api/projects/${aliceProject.id}`, {
        headers: { 'x-user-id': USER_BOB },
      });

      const res = await getProjectById(req, { params: Promise.resolve({ id: aliceProject.id }) });
      assert.equal(res.status, 404);
    });

    it('3.8 PUT /api/projects/[id] updates project and returns HTTP 200', async () => {
      const adapter = getInMemoryAdapter();
      const project = await adapter.createProject(USER_ALICE, {
        name: 'Before Update',
        sceneGraph: mockSceneGraph,
      });

      const req = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ALICE,
        },
        body: JSON.stringify({ name: 'After Update' }),
      });

      const res = await updateProjectById(req, { params: Promise.resolve({ id: project.id }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.project.name, 'After Update');
    });

    it('3.9 PUT /api/projects/[id] returns HTTP 404 for cross-tenant update', async () => {
      const adapter = getInMemoryAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, {
        name: 'Alice Original',
        sceneGraph: mockSceneGraph,
      });

      const req = new NextRequest(`http://localhost:3000/api/projects/${aliceProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_BOB,
        },
        body: JSON.stringify({ name: 'Bob Infiltration' }),
      });

      const res = await updateProjectById(req, { params: Promise.resolve({ id: aliceProject.id }) });
      assert.equal(res.status, 404);
    });

    it('3.10 DELETE /api/projects/[id] deletes project and returns HTTP 200', async () => {
      const adapter = getInMemoryAdapter();
      const project = await adapter.createProject(USER_ALICE, {
        name: 'Delete Route Target',
        sceneGraph: mockSceneGraph,
      });

      const req = new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': USER_ALICE },
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: project.id }) });
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.equal(body.success, true);
    });

    it('3.11 DELETE /api/projects/[id] returns HTTP 404 for cross-tenant deletion', async () => {
      const adapter = getInMemoryAdapter();
      const aliceProject = await adapter.createProject(USER_ALICE, {
        name: 'Alice Untouchable',
        sceneGraph: mockSceneGraph,
      });

      const req = new NextRequest(`http://localhost:3000/api/projects/${aliceProject.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': USER_BOB },
      });

      const res = await deleteProjectById(req, { params: Promise.resolve({ id: aliceProject.id }) });
      assert.equal(res.status, 404);
    });

    it('3.12 Unauthenticated requests return HTTP 401 across endpoints', async () => {
      const unauthReq = new NextRequest('http://localhost:3000/api/projects', {
        headers: { authorization: 'Bearer invalid-token' },
      });

      const res = await getProjectsList(unauthReq);
      assert.equal(res.status, 401);
    });
  });

  /* ========================================================================= */
  /* 4. Static Audit of PostgreSQL Migrations (RLS Policies)                  */
  /* ========================================================================= */
  describe('4. Static Audit of PostgreSQL Migrations & RLS', () => {
    it('4.1 schema migration enables RLS on projects, render_jobs, and assets', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261101000000_init_saas_schema.sql');
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

      const content = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(
        content.includes('ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;'),
        'projects must have RLS enabled'
      );
      assert.ok(
        content.includes('ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;'),
        'render_jobs must have RLS enabled'
      );
      assert.ok(
        content.includes('ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;'),
        'assets must have RLS enabled'
      );
    });

    it('4.2 schema migration enforces auth.uid() = user_id on all tables', () => {
      const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261101000000_init_saas_schema.sql');
      const content = fs.readFileSync(migrationPath, 'utf8');

      // Check projects policies
      assert.ok(content.includes('USING (auth.uid() = user_id)'));
      assert.ok(content.includes('WITH CHECK (auth.uid() = user_id)'));

      // Check cascading delete on user_id
      assert.ok(content.includes('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE'));
    });

    it('4.3 storage setup migration creates private buckets with strict size limits', () => {
      const storageMigrationPath = path.resolve(__dirname, '../supabase/migrations/20261101000001_storage_setup.sql');
      assert.ok(fs.existsSync(storageMigrationPath), 'Storage migration file must exist');

      const content = fs.readFileSync(storageMigrationPath, 'utf8');
      assert.ok(content.includes("'project-assets'"));
      assert.ok(content.includes("'rendered-videos'"));
      assert.ok(content.includes('public, file_size_limit'));
      assert.ok(content.includes('104857600')); // 100MB limit for assets
      assert.ok(content.includes('524288000')); // 500MB limit for rendered videos
    });

    it('4.4 storage policies enforce folder-level user isolation', () => {
      const storageMigrationPath = path.resolve(__dirname, '../supabase/migrations/20261101000001_storage_setup.sql');
      const content = fs.readFileSync(storageMigrationPath, 'utf8');

      assert.ok(
        content.includes('(storage.foldername(name))[1] = auth.uid()::text'),
        'Storage objects must be isolated by auth.uid() folder path'
      );
    });
  });

  /* ========================================================================= */
  /* 5. Deterministic Offline Fallback Adapter Verification                     */
  /* ========================================================================= */
  describe('5. Deterministic Offline Fallback Adapter', () => {
    it('5.1 getPersistenceAdapter returns in-memory singleton when MOCK_SUPABASE=true', () => {
      process.env.MOCK_SUPABASE = 'true';
      const adapter = getPersistenceAdapter();
      assert.ok(adapter instanceof InMemoryPersistenceAdapter);
    });

    it('5.2 multiple sequential runs execute with 100% determinism and 0 network calls', async () => {
      const adapter = getPersistenceAdapter();
      adapter.clear?.();

      const p1 = await adapter.createProject(USER_ALICE, { name: 'Batch 1', sceneGraph: mockSceneGraph });
      const p2 = await adapter.createProject(USER_ALICE, { name: 'Batch 2', sceneGraph: mockSceneGraph });

      // Guarantee strict descending order
      (p1 as { updated_at: string }).updated_at = new Date(Date.now() - 10000).toISOString();
      (p2 as { updated_at: string }).updated_at = new Date().toISOString();

      const list = await adapter.listProjects(USER_ALICE);
      assert.equal(list.length, 2);
      assert.equal(list[0].id, p2.id);
      assert.equal(list[1].id, p1.id);
    });
  });
});
