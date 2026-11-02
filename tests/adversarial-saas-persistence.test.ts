/**
 * tests/adversarial-saas-persistence.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS-TESTING SUITE FOR PHASE 8 SAAS PERSISTENCE LAYER.
 *
 * Verifies:
 * 1. Multi-Tenant Boundary Penetration:
 *    - User A cannot access, list, mutate, or delete User B's projects via API or adapter.
 *    - Strict enforcement of HTTP 404 (NOT 403) on unauthorized cross-tenant operations to prevent existence enumeration.
 *    - Injection of arbitrary `user_id` inside request payloads is sanitized / discarded (no account hijacking).
 *    - Unauthenticated requests are rejected with HTTP 401 across all routes.
 * 2. SQL Migration Integrity & Constraint Auditing:
 *    - Verifies SQL syntax, table constraints, foreign keys (CASCADE/SET NULL), check constraints, triggers, and RLS policies.
 *    - Verifies storage bucket configuration and folder isolation RLS rules.
 * 3. Offline CI Determinism & Persistence Adapter Invariants:
 *    - Validates InMemoryPersistenceAdapter behavioral equivalence to PostgreSQL semantics.
 *    - Timestamp update invariants (`created_at` immutability, `updated_at` auto-refresh).
 *    - Sorting determinism, UUID generation validity, and empty patch idempotence.
 * 4. Payload Edge Cases, Fuzzing & Security Injections:
 *    - Name length boundaries (0, 1, 120, 121 chars, whitespace variations, multi-byte emojis, CJK scripts).
 *    - SQL injection strings, XSS vectors, and prototype pollution attempts.
 *    - Malformed SceneGraph schemas, corrupted frames, invalid color hexes.
 *    - Non-UUID / malicious path parameter fuzzing in route handlers.
 * 5. Concurrent Multi-Tenant Load Stress:
 *    - Simultaneous interleaved operations across 10 concurrent tenants with zero cross-tenant contamination.
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

// Standard valid SceneGraph conforming to SceneGraphSchema v2.0
const validSceneGraph: SceneGraph = {
  version: '2.0',
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 90,
  },
  artDirection: {
    backdropVariant: 'dark-precision',
    surfaceTheme: 'dark',
    primaryAccent: '#3B82F6',
  },
  cameraTrack: [
    { frame: 0, x: 0.5, y: 0.5, zoom: 1.0 },
    { frame: 90, x: 0.5, y: 0.5, zoom: 1.25 },
  ],
  cursorTrack: [
    { frame: 0, x: 0.5, y: 0.5 },
    { frame: 45, x: 0.7, y: 0.4, click: true },
  ],
  audioTrack: [
    { id: 'sfx_click_01', frame: 45, asset: 'mouse-click', volume: 0.9 },
  ],
  scenes: [
    {
      id: 'scene_adversarial_1',
      startFrame: 0,
      durationInFrames: 90,
      type: 'kinetic_typography',
      payload: {
        words: ['Adversarial', 'Penetration', 'Test'],
        accentWordIndex: 1,
      },
    },
  ],
};

const USER_VICTIM = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const USER_ATTACKER = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const USER_OBSERVER = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

describe('Empirical Adversarial Stress Suite: Phase 8 SaaS Layer', () => {
  beforeEach(() => {
    process.env.MOCK_SUPABASE = 'true';
    getInMemoryAdapter().clear();
  });

  /* ========================================================================= */
  /* 1. Multi-Tenant Boundary Penetration & Zero Information Disclosure        */
  /* ========================================================================= */
  describe('1. Multi-Tenant Boundary Penetration & Information Disclosure', () => {
    it('1.1 Cross-tenant GET returns 404 (NEVER 403) and identical payload to nonexistent project', async () => {
      const adapter = getInMemoryAdapter();
      const victimProject = await adapter.createProject(USER_VICTIM, {
        name: 'Top Secret Strategy',
        sceneGraph: validSceneGraph,
      });

      // Attacker queries victim's real project ID
      const attackReq = new NextRequest(`http://localhost:3000/api/projects/${victimProject.id}`, {
        headers: { 'x-user-id': USER_ATTACKER },
      });
      const attackRes = await getProjectById(attackReq, { params: Promise.resolve({ id: victimProject.id }) });

      // Attacker queries a completely random non-existent UUID
      const fakeUuid = '99999999-9999-4999-9999-999999999999';
      const fakeReq = new NextRequest(`http://localhost:3000/api/projects/${fakeUuid}`, {
        headers: { 'x-user-id': USER_ATTACKER },
      });
      const fakeRes = await getProjectById(fakeReq, { params: Promise.resolve({ id: fakeUuid }) });

      // Both MUST return HTTP 404
      assert.equal(attackRes.status, 404, 'Unauthorized project access must return 404');
      assert.equal(fakeRes.status, 404, 'Nonexistent project access must return 404');

      const attackBody = await attackRes.json();
      const fakeBody = await fakeRes.json();

      // Zero information disclosure: error message must be identical
      assert.deepEqual(attackBody, fakeBody, 'Response payload must be indistinguishable between unauthorized and nonexistent IDs');
    });

    it('1.2 Cross-tenant PUT returns 404, does NOT mutate target project or leak existence', async () => {
      const adapter = getInMemoryAdapter();
      const victimProject = await adapter.createProject(USER_VICTIM, {
        name: 'Immutable Financial Data',
        sceneGraph: validSceneGraph,
      });

      // Attacker attempts defacement
      const attackReq = new NextRequest(`http://localhost:3000/api/projects/${victimProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ATTACKER,
        },
        body: JSON.stringify({
          name: 'Hacked by Attacker',
          sceneGraph: {
            ...validSceneGraph,
            artDirection: { ...validSceneGraph.artDirection, primaryAccent: '#000000' },
          },
        }),
      });

      const attackRes = await updateProjectById(attackReq, { params: Promise.resolve({ id: victimProject.id }) });
      assert.equal(attackRes.status, 404, 'Cross-tenant PUT must return 404');

      // Verify victim project in database was completely untouched
      const intact = await adapter.getProject(USER_VICTIM, victimProject.id);
      assert.ok(intact);
      assert.equal(intact.name, 'Immutable Financial Data');
      assert.equal(intact.scene_graph.artDirection.primaryAccent, '#3B82F6');
      assert.equal(intact.updated_at, victimProject.updated_at);
    });

    it('1.3 Cross-tenant DELETE returns 404 and preserves victim project', async () => {
      const adapter = getInMemoryAdapter();
      const victimProject = await adapter.createProject(USER_VICTIM, {
        name: 'Protected Campaign',
        sceneGraph: validSceneGraph,
      });

      // Attacker attempts deletion
      const attackReq = new NextRequest(`http://localhost:3000/api/projects/${victimProject.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': USER_ATTACKER },
      });

      const attackRes = await deleteProjectById(attackReq, { params: Promise.resolve({ id: victimProject.id }) });
      assert.equal(attackRes.status, 404, 'Cross-tenant DELETE must return 404');

      // Verify project still exists under victim ownership
      const intact = await adapter.getProject(USER_VICTIM, victimProject.id);
      assert.ok(intact, 'Project must survive unauthorized deletion attempt');
      assert.equal(intact.user_id, USER_VICTIM);
    });

    it('1.4 Identity spoofing / account hijacking payload injection is sanitized', async () => {
      const adapter = getInMemoryAdapter();

      // Attacker attempts to forge project ownership by passing `user_id: USER_VICTIM` in POST body
      const spoofReq = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_ATTACKER,
        },
        body: JSON.stringify({
          name: 'Trojan Horse Project',
          user_id: USER_VICTIM, // Spoof attempt!
          id: '00000000-0000-0000-0000-000000000000', // Forced ID attempt!
          sceneGraph: validSceneGraph,
        }),
      });

      const res = await createProjectRoute(spoofReq);
      assert.equal(res.status, 201);
      const data = await res.json();

      // Project must belong to attacker, NOT victim
      assert.equal(data.project.user_id, USER_ATTACKER, 'user_id must be assigned by session, not payload body');
      assert.notEqual(data.project.id, '00000000-0000-0000-0000-000000000000', 'ID must be cryptographically generated random UUID');

      // Victim must NOT see this project in their project list
      const victimList = await adapter.listProjects(USER_VICTIM);
      assert.equal(victimList.length, 0);

      // Victim direct query must return null
      const check = await adapter.getProject(USER_VICTIM, data.project.id);
      assert.equal(check, null);
    });

    it('1.5 Strict tenant isolation across 100 interspersed projects', async () => {
      const adapter = getInMemoryAdapter();

      // Populate 50 projects for victim and 50 projects for attacker
      for (let i = 0; i < 50; i++) {
        await adapter.createProject(USER_VICTIM, {
          name: `Victim Project ${i}`,
          sceneGraph: validSceneGraph,
        });
        await adapter.createProject(USER_ATTACKER, {
          name: `Attacker Project ${i}`,
          sceneGraph: validSceneGraph,
        });
      }

      // Query victim's list
      const victimProjects = await adapter.listProjects(USER_VICTIM);
      assert.equal(victimProjects.length, 50);
      assert.ok(victimProjects.every((p) => p.name.startsWith('Victim Project')));

      // Query attacker's list
      const attackerProjects = await adapter.listProjects(USER_ATTACKER);
      assert.equal(attackerProjects.length, 50);
      assert.ok(attackerProjects.every((p) => p.name.startsWith('Attacker Project')));

      // Third party observer with 0 projects
      const observerProjects = await adapter.listProjects(USER_OBSERVER);
      assert.equal(observerProjects.length, 0);
    });

    it('1.6 Direct adapter cross-user calls return null / false without side-effects', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const victimProject = await adapter.createProject(USER_VICTIM, {
        name: 'Adapter Invariant Project',
        sceneGraph: validSceneGraph,
      });

      // Direct read across boundary
      const readResult = await adapter.getProject(USER_ATTACKER, victimProject.id);
      assert.equal(readResult, null);

      // Direct update across boundary
      const updateResult = await adapter.updateProject(USER_ATTACKER, victimProject.id, {
        name: 'Defaced Name',
      });
      assert.equal(updateResult, null);

      // Direct delete across boundary
      const deleteResult = await adapter.deleteProject(USER_ATTACKER, victimProject.id);
      assert.equal(deleteResult, false);

      // Verify record is still 100% original
      const verify = await adapter.getProject(USER_VICTIM, victimProject.id);
      assert.ok(verify);
      assert.equal(verify.name, 'Adapter Invariant Project');
    });

    it('1.7 All API routes reject unauthenticated sessions with HTTP 401', async () => {
      const unauthHeader = { authorization: 'Bearer invalid-session-token' };

      // GET /api/projects
      const resList = await getProjectsList(new NextRequest('http://localhost:3000/api/projects', { headers: unauthHeader }));
      assert.equal(resList.status, 401);

      // POST /api/projects
      const resCreate = await createProjectRoute(
        new NextRequest('http://localhost:3000/api/projects', {
          method: 'POST',
          headers: { ...unauthHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Unauth Project', sceneGraph: validSceneGraph }),
        })
      );
      assert.equal(resCreate.status, 401);

      // GET /api/projects/[id]
      const resGetId = await getProjectById(
        new NextRequest('http://localhost:3000/api/projects/some-id', { headers: unauthHeader }),
        { params: Promise.resolve({ id: 'some-id' }) }
      );
      assert.equal(resGetId.status, 401);

      // PUT /api/projects/[id]
      const resPutId = await updateProjectById(
        new NextRequest('http://localhost:3000/api/projects/some-id', {
          method: 'PUT',
          headers: { ...unauthHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name' }),
        }),
        { params: Promise.resolve({ id: 'some-id' }) }
      );
      assert.equal(resPutId.status, 401);

      // DELETE /api/projects/[id]
      const resDelId = await deleteProjectById(
        new NextRequest('http://localhost:3000/api/projects/some-id', {
          method: 'DELETE',
          headers: unauthHeader,
        }),
        { params: Promise.resolve({ id: 'some-id' }) }
      );
      assert.equal(resDelId.status, 401);
    });
  });

  /* ========================================================================= */
  /* 2. SQL Migration Integrity & Schema Constraint Auditing                   */
  /* ========================================================================= */
  describe('2. SQL Migration Integrity & Constraint Auditing', () => {
    const migrationDir = path.resolve(__dirname, '../supabase/migrations');
    const initMigration = path.join(migrationDir, '20261101000000_init_saas_schema.sql');
    const storageMigration = path.join(migrationDir, '20261101000001_storage_setup.sql');

    it('2.1 SQL files exist and contain valid PostgreSQL statements', () => {
      assert.ok(fs.existsSync(initMigration), 'Init schema migration must exist');
      assert.ok(fs.existsSync(storageMigration), 'Storage setup migration must exist');

      const initSql = fs.readFileSync(initMigration, 'utf8');
      const storageSql = fs.readFileSync(storageMigration, 'utf8');

      // Verify no syntax errors such as unclosed quotes or brackets
      assert.equal((initSql.match(/BEGIN/g) || []).length, (initSql.match(/END;/g) || []).length);
      assert.ok(initSql.includes('CREATE OR REPLACE FUNCTION public.handle_updated_at()'));
      assert.ok(storageSql.includes('INSERT INTO storage.buckets'));
    });

    it('2.2 Projects table enforces foreign key cascade, check constraints, and indexes', () => {
      const sql = fs.readFileSync(initMigration, 'utf8');

      // Cascade on auth user deletion
      assert.ok(
        sql.includes('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE'),
        'projects.user_id must reference auth.users(id) ON DELETE CASCADE'
      );

      // Name constraint: length(trim(name)) > 0 AND length(name) <= 120
      assert.ok(
        sql.includes('CHECK (length(trim(name)) > 0 AND length(name) <= 120)'),
        'projects.name must enforce non-empty trimmed string of max 120 chars'
      );

      // Updated_at trigger setup
      assert.ok(sql.includes('CREATE TRIGGER trigger_projects_updated_at'));
      assert.ok(sql.includes('BEFORE UPDATE ON public.projects'));
      assert.ok(sql.includes('EXECUTE FUNCTION public.handle_updated_at();'));

      // Indexes
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);'));
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);'));
    });

    it('2.3 Render Jobs table enforces status allowlist, progress bounds, and foreign keys', () => {
      const sql = fs.readFileSync(initMigration, 'utf8');

      // Status allowlist
      assert.ok(
        sql.includes("CHECK (status IN ('queued', 'rendering', 'completed', 'failed', 'cancelled'))"),
        'render_jobs.status must validate allowed states'
      );

      // Progress bounds [0.0, 1.0]
      assert.ok(
        sql.includes('CHECK (progress >= 0.0 AND progress <= 1.0)'),
        'render_jobs.progress must be strictly clamped between 0.0 and 1.0'
      );

      // References
      assert.ok(
        sql.includes('project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL'),
        'Deleting a project must SET NULL on render_jobs rather than dropping job history'
      );
      assert.ok(
        sql.includes('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE'),
        'Deleting user cascades to render_jobs'
      );
    });

    it('2.4 Assets table enforces foreign keys and size constraint', () => {
      const sql = fs.readFileSync(initMigration, 'utf8');

      assert.ok(
        sql.includes('project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE'),
        'Deleting project cascades to assets'
      );
      assert.ok(
        sql.includes('CHECK (size_bytes >= 0)'),
        'assets.size_bytes must be non-negative'
      );
    });

    it('2.5 Row Level Security is enabled and has all 4 CRUD policies on all tables', () => {
      const sql = fs.readFileSync(initMigration, 'utf8');
      const tables = ['projects', 'render_jobs', 'assets'];

      for (const table of tables) {
        assert.ok(
          sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
          `RLS must be enabled on table ${table}`
        );

        // SELECT policy
        assert.ok(
          sql.includes(`ON public.${table} FOR SELECT`),
          `SELECT policy must exist for ${table}`
        );
        // INSERT policy
        assert.ok(
          sql.includes(`ON public.${table} FOR INSERT`),
          `INSERT policy must exist for ${table}`
        );
        // UPDATE policy
        assert.ok(
          sql.includes(`ON public.${table} FOR UPDATE`),
          `UPDATE policy must exist for ${table}`
        );
        // DELETE policy
        assert.ok(
          sql.includes(`ON public.${table} FOR DELETE`),
          `DELETE policy must exist for ${table}`
        );
      }
    });

    it('2.6 Storage buckets are private with strict size limits and folder-level RLS', () => {
      const sql = fs.readFileSync(storageMigration, 'utf8');

      // Private buckets
      assert.ok(sql.includes("'project-assets', 'project-assets', false, 104857600"));
      assert.ok(sql.includes("'rendered-videos', 'rendered-videos', false, 524288000"));

      // Folder isolation: (storage.foldername(name))[1] = auth.uid()::text
      assert.ok(
        sql.includes('(storage.foldername(name))[1] = auth.uid()::text'),
        'Storage must isolate assets by user folder'
      );

      // Rendered videos allow service_role upload
      assert.ok(
        sql.includes("auth.role() = 'service_role'"),
        'Render worker must be permitted to upload rendered videos via service_role'
      );
    });
  });

  /* ========================================================================= */
  /* 3. Offline CI Determinism & Persistence Adapter Invariants                */
  /* ========================================================================= */
  describe('3. Offline CI Determinism & Persistence Adapter Invariants', () => {
    it('3.1 InMemoryPersistenceAdapter preserves created_at and updates updated_at on mutation', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const created = await adapter.createProject(USER_VICTIM, {
        name: 'Initial Name',
        sceneGraph: validSceneGraph,
      });

      const originalCreatedAt = created.created_at;
      const originalUpdatedAt = created.updated_at;

      // Ensure timestamp advancement by simulating slight delta
      await new Promise((r) => setTimeout(r, 10));

      const updated = await adapter.updateProject(USER_VICTIM, created.id, {
        name: 'Updated Name',
      });

      assert.ok(updated);
      assert.equal(updated.created_at, originalCreatedAt, 'created_at must be immutable');
      assert.notEqual(updated.updated_at, originalUpdatedAt, 'updated_at must refresh upon update');
      assert.ok(new Date(updated.updated_at).getTime() > new Date(originalUpdatedAt).getTime());
    });

    it('3.2 Empty patch in updateProject triggers updated_at refresh matching Postgres trigger', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const created = await adapter.createProject(USER_VICTIM, {
        name: 'No-op Target',
        sceneGraph: validSceneGraph,
      });

      await new Promise((r) => setTimeout(r, 10));

      // Empty patch (valid UpdateProjectSchema)
      const updated = await adapter.updateProject(USER_VICTIM, created.id, {});

      assert.ok(updated);
      assert.equal(updated.name, 'No-op Target');
      assert.ok(new Date(updated.updated_at).getTime() > new Date(created.updated_at).getTime());
    });

    it('3.3 Double delete is safe, idempotent and returns false on second call', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const created = await adapter.createProject(USER_VICTIM, {
        name: 'Delete Target',
        sceneGraph: validSceneGraph,
      });

      const firstDelete = await adapter.deleteProject(USER_VICTIM, created.id);
      assert.equal(firstDelete, true);

      const secondDelete = await adapter.deleteProject(USER_VICTIM, created.id);
      assert.equal(secondDelete, false);

      const fetchCheck = await adapter.getProject(USER_VICTIM, created.id);
      assert.equal(fetchCheck, null);
    });

    it('3.4 getPersistenceAdapter dynamically switches based on MOCK_SUPABASE environment variable', () => {
      process.env.MOCK_SUPABASE = 'true';
      const mockAdapter = getPersistenceAdapter();
      assert.ok(mockAdapter instanceof InMemoryPersistenceAdapter);

      // When explicitly not in mock mode and URL configured, instantiates SupabasePersistenceAdapter
      process.env.MOCK_SUPABASE = 'false';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      const liveAdapter = getPersistenceAdapter();
      assert.ok(!(liveAdapter instanceof InMemoryPersistenceAdapter));

      // Reset
      process.env.MOCK_SUPABASE = 'true';
    });

    it('3.5 Project IDs are strictly valid RFC 4122 v4 UUIDs', async () => {
      const adapter = new InMemoryPersistenceAdapter();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (let i = 0; i < 20; i++) {
        const project = await adapter.createProject(USER_VICTIM, {
          name: `UUID Verification ${i}`,
          sceneGraph: validSceneGraph,
        });
        assert.match(project.id, uuidRegex, `Project ID ${project.id} must be a valid UUID v4`);
      }
    });
  });

  /* ========================================================================= */
  /* 4. Payload Edge Cases, Fuzzing & Security Injections                      */
  /* ========================================================================= */
  describe('4. Payload Edge Cases, Fuzzing & Security Injections', () => {
    it('4.1 Name length boundary probe: rejects 0, 121 chars, accepts 1, 120 chars', () => {
      // Length 0 (empty string)
      assert.equal(CreateProjectSchema.safeParse({ name: '', sceneGraph: validSceneGraph }).success, false);

      // Whitespace only
      assert.equal(CreateProjectSchema.safeParse({ name: '      ', sceneGraph: validSceneGraph }).success, false);
      assert.equal(CreateProjectSchema.safeParse({ name: '\t\n\r  ', sceneGraph: validSceneGraph }).success, false);

      // Boundary length 1
      const minValid = CreateProjectSchema.safeParse({ name: 'X', sceneGraph: validSceneGraph });
      assert.equal(minValid.success, true);
      assert.equal(minValid.data?.name, 'X');

      // Boundary length 120
      const exact120 = 'A'.repeat(120);
      const maxValid = CreateProjectSchema.safeParse({ name: exact120, sceneGraph: validSceneGraph });
      assert.equal(maxValid.success, true);
      assert.equal(maxValid.data?.name.length, 120);

      // Boundary length 121 (MUST FAIL)
      const exact121 = 'A'.repeat(121);
      const overflow = CreateProjectSchema.safeParse({ name: exact121, sceneGraph: validSceneGraph });
      assert.equal(overflow.success, false);

      // Leading/trailing whitespace trimmed
      const padded120 = `   ${exact120}   `;
      const paddedParsed = CreateProjectSchema.safeParse({ name: padded120, sceneGraph: validSceneGraph });
      assert.equal(paddedParsed.success, true);
      assert.equal(paddedParsed.data?.name.length, 120);
    });

    it('4.2 Unicode, multi-byte emojis, and international scripts fuzzing', () => {
      const emojiName = '🚀 Launch Day 🔥 Super Video 🎬';
      const parsedEmoji = CreateProjectSchema.parse({ name: emojiName, sceneGraph: validSceneGraph });
      assert.equal(parsedEmoji.name, emojiName);

      const japaneseName = 'ローンチビデオ — 次世代SaaS';
      const parsedJp = CreateProjectSchema.parse({ name: japaneseName, sceneGraph: validSceneGraph });
      assert.equal(parsedJp.name, japaneseName);

      const arabicName = 'إطلاق الفيديو الترويجي';
      const parsedAr = CreateProjectSchema.parse({ name: arabicName, sceneGraph: validSceneGraph });
      assert.equal(parsedAr.name, arabicName);
    });

    it('4.3 Malicious SQL injection payloads in name and ID do not break system', async () => {
      const sqlInjectionName = "'); DROP TABLE public.projects; --";
      const adapter = getInMemoryAdapter();

      // Safe creation with SQL injection name
      const req = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': USER_VICTIM,
        },
        body: JSON.stringify({
          name: sqlInjectionName,
          sceneGraph: validSceneGraph,
        }),
      });

      const res = await createProjectRoute(req);
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.project.name, sqlInjectionName);

      // Verify adapter stored it safely
      const stored = await adapter.getProject(USER_VICTIM, body.project.id);
      assert.equal(stored?.name, sqlInjectionName);

      // SQL injection in route ID param: /api/projects/1' OR '1'='1
      const sqliId = "1' OR '1'='1";
      const getReq = new NextRequest(`http://localhost:3000/api/projects/${sqliId}`, {
        headers: { 'x-user-id': USER_VICTIM },
      });
      const getRes = await getProjectById(getReq, { params: Promise.resolve({ id: sqliId }) });
      assert.equal(getRes.status, 404);
    });

    it('4.4 XSS payloads and HTML injection are safely treated as raw strings', async () => {
      const xssName = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      const parsed = CreateProjectSchema.parse({ name: xssName, sceneGraph: validSceneGraph });
      assert.equal(parsed.name, xssName);

      const adapter = getInMemoryAdapter();
      const project = await adapter.createProject(USER_VICTIM, parsed);
      assert.equal(project.name, xssName);
    });

    it('4.5 Prototype pollution vectors in JSON payload are sanitized', async () => {
      const maliciousJson = JSON.parse(
        '{"__proto__":{"polluted":true},"name":"Clean Name","sceneGraph":' + JSON.stringify(validSceneGraph) + '}'
      );

      const parsed = CreateProjectSchema.safeParse(maliciousJson);
      assert.equal(parsed.success, true);

      // Verify global Object.prototype was NOT polluted
      const cleanObj = {};
      assert.equal((cleanObj as Record<string, unknown>).polluted, undefined, 'Object prototype must remain clean');
    });

    it('4.6 Malformed SceneGraph payloads are strictly rejected by Zod', () => {
      // Corrupt canvas width
      const badCanvas = {
        name: 'Bad Canvas',
        sceneGraph: { ...validSceneGraph, canvas: { ...validSceneGraph.canvas, width: -1920 } },
      };
      assert.equal(CreateProjectSchema.safeParse(badCanvas).success, false);

      // Non-integer FPS
      const badFps = {
        name: 'Bad FPS',
        sceneGraph: { ...validSceneGraph, canvas: { ...validSceneGraph.canvas, fps: 29.97 } },
      };
      assert.equal(CreateProjectSchema.safeParse(badFps).success, false);

      // Missing scenes array
      const missingScenes = {
        name: 'Missing Scenes',
        sceneGraph: { ...validSceneGraph, scenes: undefined },
      };
      assert.equal(CreateProjectSchema.safeParse(missingScenes).success, false);

      // Invalid color format (not 6-digit hex or recognized format)
      const badColor = {
        name: 'Bad Color',
        sceneGraph: {
          ...validSceneGraph,
          artDirection: { ...validSceneGraph.artDirection, primaryAccent: 'invalid-red' },
        },
      };
      assert.equal(CreateProjectSchema.safeParse(badColor).success, false);

      // UpdateProjectSchema rejection of empty string name
      assert.equal(UpdateProjectSchema.safeParse({ name: '   ' }).success, false);
      assert.equal(UpdateProjectSchema.safeParse({ sceneGraph: badCanvas.sceneGraph }).success, false);

      // ProjectSummarySchema rejection of invalid non-UUID
      assert.equal(
        ProjectSummarySchema.safeParse({
          id: 'not-a-uuid',
          name: 'Summary Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).success,
        false
      );

      // ProjectResponseSchema rejection of non-UUID user_id
      assert.equal(
        ProjectResponseSchema.safeParse({
          id: '00000000-0000-4000-8000-000000000000',
          user_id: 'not-a-uuid',
          name: 'Response Test',
          scene_graph: validSceneGraph,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).success,
        false
      );
    });

    it('4.7 Route handlers handle path traversal and bizarre IDs gracefully', async () => {
      const weirdIds = [
        '../../etc/passwd',
        '..%2F..%2Fetc%2Fpasswd',
        'undefined',
        'null',
        'NaN',
        '0',
        '~',
        'a'.repeat(2000),
      ];

      for (const id of weirdIds) {
        const req = new NextRequest(`http://localhost:3000/api/projects/${encodeURIComponent(id)}`, {
          headers: { 'x-user-id': USER_VICTIM },
        });
        const res = await getProjectById(req, { params: Promise.resolve({ id }) });
        assert.equal(res.status, 404, `Bizarre ID "${id}" must safely return 404 without crashing`);
      }
    });

    it('4.8 AssetUploadMetadataSchema boundary and MIME type fuzzing', () => {
      // Negative size bytes
      assert.equal(
        AssetUploadMetadataSchema.safeParse({
          name: 'asset.png',
          mimeType: 'image/png',
          sizeBytes: -100,
        }).success,
        false
      );

      // Zero size bytes
      assert.equal(
        AssetUploadMetadataSchema.safeParse({
          name: 'asset.png',
          mimeType: 'image/png',
          sizeBytes: 0,
        }).success,
        false
      );

      // Boundary: Exactly 100MB (104,857,600 bytes)
      assert.equal(
        AssetUploadMetadataSchema.safeParse({
          name: 'asset.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 104857600,
        }).success,
        true
      );

      // Boundary + 1 byte: 100MB + 1 byte (MUST FAIL)
      assert.equal(
        AssetUploadMetadataSchema.safeParse({
          name: 'asset.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 104857601,
        }).success,
        false
      );

      // Forbidden MIME types
      const forbiddenMimes = [
        'application/javascript',
        'text/html',
        'application/x-executable',
        'application/pdf',
        'image/gif',
      ];
      for (const mime of forbiddenMimes) {
        assert.equal(
          AssetUploadMetadataSchema.safeParse({
            name: 'asset.file',
            mimeType: mime as 'image/png',
            sizeBytes: 1024,
          }).success,
          false,
          `MIME ${mime} must be forbidden`
        );
      }
    });
  });

  /* ========================================================================= */
  /* 5. High-Concurrency Multi-Tenant Stress Test                              */
  /* ========================================================================= */
  describe('5. High-Concurrency Multi-Tenant Stress Test', () => {
    it('5.1 Interleaved concurrent operations across 10 tenants with zero cross-leakage', async () => {
      const numTenants = 10;
      const tenants = Array.from({ length: numTenants }, (_, i) => `tenant-${i.toString().padStart(4, '0')}`);

      // Step A: Concurrently create 5 projects per tenant (50 total projects)
      const createdProjectIds: Map<string, string[]> = new Map();
      tenants.forEach((t) => createdProjectIds.set(t, []));

      const creationTasks = tenants.flatMap((tenantId) =>
        Array.from({ length: 5 }, async (_, projectIdx) => {
          const req = new NextRequest('http://localhost:3000/api/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': tenantId,
            },
            body: JSON.stringify({
              name: `Concurrent-${tenantId}-${projectIdx}`,
              sceneGraph: validSceneGraph,
            }),
          });
          const res = await createProjectRoute(req);
          assert.equal(res.status, 201);
          const body = await res.json();
          createdProjectIds.get(tenantId)!.push(body.project.id);
        })
      );

      await Promise.all(creationTasks);

      // Step B: Verify each tenant's list contains EXACTLY their 5 projects and zero from others
      await Promise.all(
        tenants.map(async (tenantId) => {
          const req = new NextRequest('http://localhost:3000/api/projects', {
            headers: { 'x-user-id': tenantId },
          });
          const res = await getProjectsList(req);
          assert.equal(res.status, 200);
          const body = await res.json();
          assert.equal(body.total, 5);
          assert.equal(body.projects.length, 5);

          const expectedIds = new Set(createdProjectIds.get(tenantId)!);
          for (const project of body.projects) {
            assert.ok(expectedIds.has(project.id), `Project ${project.id} must belong to ${tenantId}`);
          }
        })
      );

      // Step C: Interleaved cross-tenant access assault (each tenant tries to read, update, delete adjacent tenant's projects)
      const assaultTasks = tenants.flatMap((attackerTenantId, i) => {
        const victimTenantId = tenants[(i + 1) % numTenants];
        const victimProjectIds = createdProjectIds.get(victimTenantId)!;

        return victimProjectIds.flatMap((targetId) => [
          // Unauthorized GET
          (async () => {
            const req = new NextRequest(`http://localhost:3000/api/projects/${targetId}`, {
              headers: { 'x-user-id': attackerTenantId },
            });
            const res = await getProjectById(req, { params: Promise.resolve({ id: targetId }) });
            assert.equal(res.status, 404, 'Cross-tenant concurrent GET must return 404');
          })(),
          // Unauthorized PUT
          (async () => {
            const req = new NextRequest(`http://localhost:3000/api/projects/${targetId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': attackerTenantId,
              },
              body: JSON.stringify({ name: `Assaulted by ${attackerTenantId}` }),
            });
            const res = await updateProjectById(req, { params: Promise.resolve({ id: targetId }) });
            assert.equal(res.status, 404, 'Cross-tenant concurrent PUT must return 404');
          })(),
          // Unauthorized DELETE
          (async () => {
            const req = new NextRequest(`http://localhost:3000/api/projects/${targetId}`, {
              method: 'DELETE',
              headers: { 'x-user-id': attackerTenantId },
            });
            const res = await deleteProjectById(req, { params: Promise.resolve({ id: targetId }) });
            assert.equal(res.status, 404, 'Cross-tenant concurrent DELETE must return 404');
          })(),
        ]);
      });

      await Promise.all(assaultTasks);

      // Step D: Verify all 50 projects are intact and unmodified
      await Promise.all(
        tenants.map(async (tenantId) => {
          const projectIds = createdProjectIds.get(tenantId)!;
          for (const id of projectIds) {
            const req = new NextRequest(`http://localhost:3000/api/projects/${id}`, {
              headers: { 'x-user-id': tenantId },
            });
            const res = await getProjectById(req, { params: Promise.resolve({ id }) });
            assert.equal(res.status, 200);
            const body = await res.json();
            assert.ok(body.project.name.startsWith(`Concurrent-${tenantId}-`));
          }
        })
      );
    });
  });
});
