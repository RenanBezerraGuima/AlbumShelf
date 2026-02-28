"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Search as SearchIcon,
  GripVertical,
  Settings,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFolderStore } from "@/lib/store";
import type { Folder as FolderType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FolderItemProps {
  folder: FolderType;
  depth: number;
  parentId: string | null;
}

const FolderItem = React.memo(function FolderItem({
  folder,
  depth,
  parentId,
}: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);

  const subfolderInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingSubfolder) {
      const timer = setTimeout(() => {
        subfolderInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isCreatingSubfolder]);

  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        editInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<
    "before" | "inside" | "after" | null
  >(null);

  const isSelected = useFolderStore(
    (state) => state.selectedFolderId === folder.id,
  );

  const hasSubfolders = folder.subfolders.length > 0;

  const handleClick = () => {
    useFolderStore.getState().setSelectedFolder(folder.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    useFolderStore.getState().toggleFolderExpanded(folder.id);
  };

  const handleRename = () => {
    if (editName.trim()) {
      useFolderStore.getState().renameFolder(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    useFolderStore.getState().deleteFolder(folder.id);
  };

  const handleCreateSubfolder = () => {
    if (newSubfolderName.trim()) {
      useFolderStore
        .getState()
        .createFolder(newSubfolderName.trim(), folder.id);
      setNewSubfolderName("");
      setIsCreatingSubfolder(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    useFolderStore.getState().setDraggedFolder(folder, parentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    useFolderStore.getState().setDraggedFolder(null, null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.stopPropagation();

    const { draggedFolder, draggedAlbum, draggedFolderId } = useFolderStore.getState();

    // If dragging a folder
    if (draggedFolder) {
      // Don't allow dropping on itself
      if (draggedFolder.id === folder.id) return;

      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      let newPosition: "before" | "inside" | "after" | null = null;
      if (y < height * 0.25) {
        newPosition = "before";
      } else if (y > height * 0.75) {
        newPosition = "after";
      } else {
        newPosition = "inside";
      }

      // Optimization: Only update state if the drop position or drag status has actually changed.
      // This prevents thousands of redundant re-renders during high-frequency dragOver events.
      if (newPosition !== dropPosition) {
        setDropPosition(newPosition);
      }
      if (!isDragOver) setIsDragOver(true);
      e.dataTransfer.dropEffect = "move";
    } else if (draggedAlbum) {
      // Only allow dropping if it's a different folder
      if (draggedFolderId !== folder.id) {
        e.preventDefault();
        if (dropPosition !== "inside") setDropPosition("inside");
        if (!isDragOver) setIsDragOver(true);
        e.dataTransfer.dropEffect = "move";
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDropPosition(null);

    const {
      draggedAlbum,
      draggedFolderId,
      moveAlbum,
      setDraggedAlbum,
      draggedFolder,
      moveFolder,
      setDraggedFolder,
    } = useFolderStore.getState();

    // Handle album drop
    if (draggedAlbum && draggedFolderId) {
      if (draggedFolderId !== folder.id) {
        moveAlbum(draggedFolderId, folder.id, draggedAlbum.id);
      }
      setDraggedAlbum(null, null, null);
      return;
    }

    // Handle folder drop
    if (draggedFolder && draggedFolder.id !== folder.id) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      if (y < height * 0.25) {
        // Drop before this folder (same parent)
        moveFolder(draggedFolder.id, parentId, folder.id);
      } else if (y > height * 0.75) {
        // Drop after this folder (same parent)
        moveFolder(draggedFolder.id, parentId, null);
      } else {
        // Drop inside this folder
        moveFolder(draggedFolder.id, folder.id, null);
      }
      setDraggedFolder(null, null);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-none cursor-pointer transition-all duration-100 border-l-4 border-transparent",
              isSelected
                ? "bg-primary text-primary-foreground border-border"
                : "hover:bg-muted",
              isDragOver &&
                dropPosition === "inside" &&
                "bg-primary/20 ring-2 ring-primary",
              isDragOver &&
                dropPosition === "before" &&
                "border-t-2 border-primary",
              isDragOver &&
                dropPosition === "after" &&
                "border-b-2 border-primary",
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={handleClick}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(folder.name); }}
            draggable={!isEditing}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span
              title="Drag to reorder"
              aria-label="Drag to reorder"
              className="opacity-40 group-hover:opacity-100 cursor-grab shrink-0"
            >
              <GripVertical className="h-3 w-3" />
            </span>

            <button
              onClick={handleToggle}
              className={cn(
                "p-0.5 rounded-none hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0",
                !hasSubfolders && "invisible",
              )}
              tabIndex={!hasSubfolders ? -1 : undefined}
              aria-label={
                folder.isExpanded ? "Collapse collection" : "Expand collection"
              }
              title={folder.isExpanded ? "Collapse" : "Expand"}
            >
              {folder.isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {folder.isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 shrink-0" />
            )}

            {isEditing ? (
              <div
                className="flex items-center gap-1 flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex-1 min-w-0">
                  <Input
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-6 text-sm py-0 pr-12 flex-1 min-w-0 rounded-none border-border text-foreground"
                    autoFocus
                    maxLength={100}
                    aria-label="Rename collection"
                    aria-describedby={`rename-counter-${folder.id}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setIsEditing(false);
                    }}
                  />
                  <div id={`rename-counter-${folder.id}`} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none select-none uppercase">
                    {editName.length}/100
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={handleRename}
                  aria-label="Confirm rename"
                  title="Confirm rename"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setIsEditing(false)}
                  aria-label="Cancel rename"
                  title="Cancel rename"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm truncate flex-1 min-w-0 font-medium tracking-tighter">
                  {folder.name}
                </span>
                <span className="text-[10px] font-mono shrink-0 opacity-70">
                  [{folder.albums.length}]
                </span>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0 opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Collection actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
                      Collection actions
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        setEditName(folder.name);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!folder.isExpanded) {
                          useFolderStore
                            .getState()
                            .toggleFolderExpanded(folder.id);
                        }
                        setIsCreatingSubfolder(true);
                      }}
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Create Subfolder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setEditName(folder.name);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              if (!folder.isExpanded) {
                useFolderStore.getState().toggleFolderExpanded(folder.id);
              }
              setIsCreatingSubfolder(true);
            }}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Create Subfolder
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsDeleteDialogOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{folder.name}"? This action cannot
              be undone and will remove all albums and sub-collections within
              it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-none border-2 border-transparent hover:border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDelete();
                setIsDeleteDialogOpen(false);
              }}
              className="rounded-none brutalist-shadow-sm"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {folder.isExpanded && (hasSubfolders || isCreatingSubfolder) && (
        <div>
          {isCreatingSubfolder && (
            <div
              className="flex items-center gap-1 px-2 py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <Folder className="h-4 w-4 text-accent shrink-0" />
              <div className="relative flex-1 min-w-0">
                <Input
                  ref={subfolderInputRef}
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  placeholder="Sub-collection name"
                  className="h-6 text-sm py-0 pr-12 flex-1 min-w-0"
                  autoFocus
                  maxLength={100}
                  aria-label="Sub-collection name"
                  aria-describedby={`subfolder-counter-${folder.id}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSubfolder();
                    if (e.key === "Escape") {
                      setIsCreatingSubfolder(false);
                      setNewSubfolderName("");
                    }
                  }}
                />
                <div id={`subfolder-counter-${folder.id}`} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none select-none uppercase">
                  {newSubfolderName.length}/100
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={handleCreateSubfolder}
                aria-label="Create sub-collection"
                title="Create sub-collection"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setIsCreatingSubfolder(false);
                  setNewSubfolderName("");
                }}
                aria-label="Cancel sub-collection creation"
                title="Cancel sub-collection creation"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {folder.subfolders.map((subfolder) => (
            <FolderItem
              key={subfolder.id}
              folder={subfolder}
              depth={depth + 1}
              parentId={folder.id}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export function FolderTree() {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) {
      const timer = setTimeout(() => {
        createInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isCreating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName || "",
        ) || (document.activeElement as HTMLElement)?.isContentEditable;

      if (
        e.key.toLowerCase() === "n" &&
        !isInputActive &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsCreating(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);

  // Granular subscriptions for data used in render.
  // Actions are accessed via useFolderStore.getState() in handlers to avoid redundant subscriptions.
  const folders = useFolderStore((state) => state.sharedFolders ?? state.folders);
  const draggedFolder = useFolderStore((state) => state.draggedFolder);

  const filteredFolders = React.useMemo(() => {
    if (!searchQuery.trim()) return folders;

    const query = searchQuery.toLowerCase();

    const filterFolder = (folder: FolderType): FolderType | null => {
      const matchesName = folder.name.toLowerCase().includes(query);
      const matchesAlbum = folder.albums.some((album) =>
        album.name.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query),
      );

      const filteredSubfolders = folder.subfolders
        .map(filterFolder)
        .filter((f): f is FolderType => f !== null);

      if (matchesName || matchesAlbum || filteredSubfolders.length > 0) {
        return {
          ...folder,
          subfolders: filteredSubfolders,
          // Expand folders that contain search results
          isExpanded: true,
        };
      }

      return null;
    };

    return folders
      .map(filterFolder)
      .filter((f): f is FolderType => f !== null);
  }, [folders, searchQuery]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      useFolderStore.getState().createFolder(newFolderName.trim(), null);
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (draggedFolder) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleRootDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (draggedFolder) {
      const { moveFolder, setDraggedFolder } = useFolderStore.getState();
      moveFolder(draggedFolder.id, null, null);
      setDraggedFolder(null, null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-r-2 border-border">
      <div className="h-[73px] p-4 border-b-2 border-border flex items-center justify-between shrink-0 bg-background">
        <h2 className="text-lg font-medium tracking-tighter">
          Collections
        </h2>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-none border-border"
                onClick={() => useFolderStore.getState().setSettingsOpen(true)}
                aria-label="Settings [S]"
                aria-keyshortcuts="s"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              Settings [S]
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-none hover:bg-primary hover:text-primary-foreground border-border"
                onClick={() => setIsCreating(true)}
                aria-label="Create collection [N]"
                aria-keyshortcuts="n"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] font-mono uppercase tracking-widest border-2 border-border brutalist-shadow-sm rounded-none">
              Create collection [N]
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="px-4 py-3 border-b-2 border-border bg-background/50">
        <div className="relative group">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm rounded-none border-2 border-border focus:border-primary transition-all bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:text-primary transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div
          className={cn("p-2 min-h-full", isDragOver && "bg-primary/10")}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          {isCreating && (
            <div className="flex items-center gap-1 px-2 py-1.5 mb-2">
              <Folder className="h-4 w-4 text-accent shrink-0 ml-5" />
              <div className="relative flex-1 min-w-0">
                <Input
                  ref={createInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Collection name"
                  className="h-7 text-sm pr-12 flex-1 w-full"
                  autoFocus
                  maxLength={100}
                  aria-label="Collection name"
                  aria-describedby="root-folder-counter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFolder();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewFolderName("");
                    }
                  }}
                />
                <div id="root-folder-counter" className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground pointer-events-none select-none uppercase">
                  {newFolderName.length}/100
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={handleCreateFolder}
                aria-label="Create collection"
                title="Create collection"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName("");
                }}
                aria-label="Cancel collection creation"
                title="Cancel collection creation"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {folders.length > 0 && filteredFolders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm text-muted-foreground font-mono mb-2">
                No results for "{searchQuery}"
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-xs font-mono uppercase tracking-tighter"
              >
                Clear search
              </Button>
            </div>
          )}

          {folders.length === 0 && !isCreating && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm text-muted-foreground font-mono mb-4">
                No collections found.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="gap-2 rounded-none border-2 border-dashed border-muted-foreground/50 hover:border-primary hover:text-primary transition-all tracking-tighter font-medium h-auto py-3 px-4"
              >
                <FolderPlus className="h-4 w-4" />
                Create your first collection
              </Button>
            </div>
          )}

          {filteredFolders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              parentId={null}
            />
          ))}

          {/* Drop zone at the bottom for easier folder reordering */}
          {draggedFolder && (
            <div
              className={cn(
                "h-16 mt-2 rounded-none border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-xs font-mono transition-colors",
                isDragOver && "border-primary bg-primary/10 text-primary",
              )}
              onDragOver={handleRootDragOver}
              onDragLeave={handleRootDragLeave}
              onDrop={handleRootDrop}
            >
              Move to root
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
