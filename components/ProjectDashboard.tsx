import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Project } from "../types";
import * as dbService from "../services/dbService";
import { exportToJson, importFromJson } from "../services/fileService";

interface ProjectDashboardProps {
  onLoadProject: (project: Project) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: number | string) => Promise<void>;
  onClose: () => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onLoadProject,
  onCreateProject,
  onDeleteProject,
  onClose,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      const storedProjects = await dbService.getProjects();
      setProjects(
        storedProjects.sort(
          (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
        ),
      );
    };
    fetchProjects();
  }, []);

  const handleTitleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      setDevMode(true);
    }
  };

  const handleCreate = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
    }
  };

  const handleDelete = async (id: number | string) => {
    await onDeleteProject(id);
    setProjects(projects.filter((p) => p.id !== id));
  };

  const handleExport = (project: Project) => {
    exportToJson(
      project,
      `${project.name.replace(/\s+/g, "_")}_Backup.rfproject`,
    );
  };

  const handleBackupAll = () => {
    exportToJson(
      projects,
      `RF_Suite_All_Projects_Backup_${new Date().toISOString().split("T")[0]}.json`,
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedData = await importFromJson<any>(file);

      if (Array.isArray(importedData)) {
        // Handle multiple projects
        let importCount = 0;
        for (const proj of importedData) {
          if (proj.data && proj.name) {
            const projectToSave: Omit<Project, "id"> = {
              name: proj.name + " (Imported)",
              lastModified: new Date(),
              data: proj.data,
            };
            await dbService.saveProject(projectToSave);
            importCount++;
          }
        }
        const storedProjects = await dbService.getProjects();
        setProjects(
          storedProjects.sort(
            (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
          ),
        );
        toast.success(`Imported ${importCount} projects successfully.`);
      } else {
        // Handle single project
        const importedProject = importedData as Project;
        if (!importedProject.data || !importedProject.name) {
          throw new Error("Invalid project file format.");
        }

        let newName = file.name.replace(/\.[^/.]+$/, "");

        // Strip ID to force creation of new DB entry
        const projectToSave: Omit<Project, "id"> = {
          name: newName,
          lastModified: new Date(),
          data: importedProject.data,
        };

        const newId = await dbService.saveProject(projectToSave);
        const loadedProject = { ...projectToSave, id: newId };

        onLoadProject(loadedProject);
      }
    } catch (error: any) {
      toast.error("Error importing project: " + error.message);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadSourceCode = () => {
    window.location.href = "/api/backup-code-v2";
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99999] flex items-center justify-center p-2">
      <div className="bg-slate-800 border border-indigo-500/30 rounded-md shadow-2xl w-full max-w-2xl text-white">
        <div className="flex justify-between items-center p-2 border-b border-slate-700">
          <h2
            onClick={handleTitleClick}
            className="text-lg font-semibold font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent cursor-default select-none"
          >
            Project Dashboard{" "}
            {devMode && (
              <span className="text-xs text-emerald-400 ml-2">(Dev Mode)</span>
            )}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>

        <div className="p-2 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* New Project Section */}
          <div className="bg-slate-900/50 p-2 rounded-sm">
            <h3 className="font-semibold mb-3 text-indigo-300">
              Create New Project
            </h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project Name (e.g., 'Festival Main Stage')"
              className="w-full bg-slate-800 border border-indigo-500/30 rounded-md p-2 text-slate-200 mb-3"
            />
            <button
              onClick={handleCreate}
              disabled={!newProjectName.trim()}
              className="w-full px-3 py-2 rounded-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white disabled:opacity-50"
            >
              Create & Load
            </button>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <h3 className="font-semibold mb-2 text-cyan-300 text-sm">
                Import / Export
              </h3>
              <input
                type="file"
                accept=".rfproject,.json"
                ref={fileInputRef}
                onChange={handleImportFile}
                className="hidden"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 rounded-sm font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600"
                >
                  📂 Import Project File
                </button>
                <button
                  onClick={handleBackupAll}
                  className="w-full px-3 py-2 rounded-sm font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600"
                >
                  💾 Backup All Projects
                </button>
                {devMode && (
                  <button
                    onClick={handleDownloadSourceCode}
                    className="w-full px-3 py-2 rounded-sm font-semibold bg-emerald-700 text-slate-200 hover:bg-emerald-600 border border-emerald-600 mt-2"
                  >
                    📦 Download App Source Code
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Existing Projects Section */}
          <div className="bg-slate-900/50 p-2 rounded-sm">
            <h3 className="font-semibold mb-3 text-purple-300">
              Load Existing Project
            </h3>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col gap-2 bg-slate-800/40 p-3 rounded-md border border-white/5 hover:border-indigo-500/30 transition-all group"
                  >
                    <div className="min-w-0">
                      <p
                        className="font-bold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition-colors"
                        title={project.name}
                      >
                        {project.name}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5 font-mono uppercase tracking-widest leading-none">
                        {new Date(project.lastModified).toLocaleDateString()} @{" "}
                        {new Date(project.lastModified).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onLoadProject(project)}
                        className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500 hover:text-white transition-all flex-1 text-center whitespace-nowrap"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleExport(project)}
                        className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500 hover:text-white transition-all flex-1 text-center whitespace-nowrap"
                      >
                        Backup
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-2 py-1 text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded hover:bg-rose-500 hover:text-white transition-all flex-1 text-center whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-2">
                  No projects found. Create one or import to get started!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
