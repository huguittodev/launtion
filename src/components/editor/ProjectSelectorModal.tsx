'use client';

/**
 * ProjectSelectorModal.tsx
 *
 * Modal component allowing users to:
 * - View a list of their saved cloud projects with timestamps
 * - Load an existing project into the Studio Editor
 * - Create a new project (reset to default template)
 * - Delete unwanted projects with immediate optimistic updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ProjectSummary } from '../../lib/supabase/schema';
import type { SceneGraph } from '../../lib/scene-graph/types';

export interface ProjectSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string | null;
  onSelectProject: (project: { id: string; name: string; scene_graph: SceneGraph }) => Promise<void> | void;
  onNewProject: () => void;
}

export const ProjectSelectorModal: React.FC<ProjectSelectorModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onNewProject,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`No se pudieron cargar los proyectos (${msg})`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    void Promise.resolve().then(async () => {
      if (isCancelled) return;
      await fetchProjects();
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, fetchProjects]);

  const handleLoadProject = async (id: string) => {
    setLoadingProjectId(id);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        throw new Error('Error al obtener el proyecto seleccionado');
      }
      const data = await res.json();
      if (data.project) {
        await onSelectProject(data.project);
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
      return;
    }

    setDeletingProjectId(id);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Error al eliminar proyecto');
      }
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleCreateNew = () => {
    onNewProject();
    onClose();
  };

  if (!isOpen) return null;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#181716] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 text-white max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF5C35]/15 border border-[#FF5C35]/30 flex items-center justify-center text-[#FF5C35]">
              📁
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Mis Proyectos
              </h2>
              <p className="text-xs text-neutral-400">
                Gestiona y abre tus proyectos guardados en la nube
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5C35] hover:bg-[#E04822] text-white text-xs font-medium shadow transition-all active:scale-95"
            >
              <span>+</span>
              <span>Nuevo Proyecto</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Cerrar modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
              <span className="w-5 h-5 border-2 border-white/20 border-t-[#FF5C35] rounded-full animate-spin" />
              <span>Cargando proyectos guardados...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3 text-neutral-400 text-xs border border-dashed border-white/10 rounded-xl p-6 text-center">
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-medium text-neutral-300">Aún no tienes proyectos guardados</p>
                <p className="text-neutral-500 mt-1">
                  Guarda tu composición actual desde el botón &quot;Guardar&quot; en la cabecera del editor.
                </p>
              </div>
            </div>
          ) : (
            projects.map((project) => {
              const isCurrent = project.id === currentProjectId;
              const isThisLoading = loadingProjectId === project.id;
              const isThisDeleting = deletingProjectId === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() => handleLoadProject(project.id)}
                  className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#FF5C35]/10 border-[#FF5C35]/40 hover:bg-[#FF5C35]/15'
                      : 'bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-neutral-200 truncate">
                        {project.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#FF5C35]/20 text-[#FF5C35] border border-[#FF5C35]/30">
                          Actual
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                      Editado: {formatDate(project.updated_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isThisLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadProject(project.id);
                      }}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 text-neutral-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isThisLoading && (
                        <span className="w-2.5 h-2.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      )}
                      <span>{isCurrent ? 'Recargar' : 'Cargar'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isThisDeleting}
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Eliminar proyecto"
                    >
                      {isThisDeleting ? (
                        <span className="w-3.5 h-3.5 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin inline-block" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs text-neutral-500">
          <span>{projects.length} proyecto(s) encontrado(s)</span>
          <button
            type="button"
            onClick={fetchProjects}
            className="hover:text-neutral-300 transition-colors flex items-center gap-1"
          >
            <span>🔄</span>
            <span>Actualizar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
