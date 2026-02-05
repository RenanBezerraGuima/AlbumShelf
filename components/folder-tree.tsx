'use client';

import React, { useState } from 'react';
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
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsDialog } from '@/components/settings-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useFolderStore } from '@/lib/store';
import type { Folder as FolderType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FolderItemProps {
  folder: FolderType;
  depth: number;
  parentId: string | null;
}

const FolderItem = React.memo(function FolderItem({ folder, depth, parentId }: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after' | null>(null);

  const isSelected = useFolderStore(state => state.selectedFolderId === folder.id);

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
      useFolderStore.getState().createFolder(newSubfolderName.trim(), folder.id);
      setNewSubfolderName('');
      setIsCreatingSubfolder(false);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    useFolderStore.getState().setDraggedFolder(folder, parentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    useFolderStore.getState().setDraggedFolder(null, null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { draggedFolder, draggedAlbum } = useFolderStore.getState();

    // If dragging a folder
    if (draggedFolder) {
      // Don't allow dropping on itself
      if (draggedFolder.id === folder.id) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      
      if (y < height * 0.25) {
        setDropPosition('before');
      } else if (y > height * 0.75) {
        setDropPosition('after');
      } else {
        setDropPosition('inside');
      }
      setIsDragOver(true);
    } else if (draggedAlbum) {
      setIsDragOver(true);
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
      setDraggedFolder
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
              'group flex items-center gap-2 px-3 py-2 rounded-none cursor-pointer transition-all duration-100 border-l-4 border-transparent',
          isSelected
            ? 'bg-primary text-primary-foreground border-border'
            : 'hover:bg-muted',
          isDragOver && dropPosition === 'inside' && 'bg-primary/20 ring-2 ring-primary',
          isDragOver && dropPosition === 'before' && 'border-t-2 border-primary',
          isDragOver && dropPosition === 'after' && 'border-b-2 border-primary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
        
        <button
          onClick={handleToggle}
          className={cn(
            'p-0.5 rounded-none hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0',
            !hasSubfolders && 'invisible'
          )}
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
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-6 text-sm py-0 flex-1 min-w-0 rounded-none border-border"
              autoFocus
              maxLength={100}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleRename}>
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={() => setIsEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm truncate flex-1 min-w-0 font-bold uppercase tracking-tighter">{folder.name}</span>
            <span className="text-[10px] font-mono shrink-0 opacity-70">
              [{folder.albums.length}]
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Collection actions"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
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
                      toggleFolderExpanded(folder.id);
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
                    handleDelete();
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
                toggleFolderExpanded(folder.id);
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
              handleDelete();
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {folder.isExpanded && (hasSubfolders || isCreatingSubfolder) && (
        <div>
          {isCreatingSubfolder && (
            <div
              className="flex items-center gap-1 px-2 py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <Folder className="h-4 w-4 text-accent shrink-0" />
              <Input
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                placeholder="Sub-collection name"
                className="h-6 text-sm py-0 flex-1 min-w-0"
                autoFocus
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubfolder();
                  if (e.key === 'Escape') {
                    setIsCreatingSubfolder(false);
                    setNewSubfolderName('');
                  }
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCreateSubfolder}>
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setIsCreatingSubfolder(false);
                  setNewSubfolderName('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {folder.subfolders.map((subfolder) => (
            <FolderItem key={subfolder.id} folder={subfolder} depth={depth + 1} parentId={folder.id} />
          ))}
        </div>
      )}
    </div>
  );
});

export function FolderTree() {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const folders = useFolderStore(state => state.folders);
  const createFolder = useFolderStore(state => state.createFolder);
  const draggedFolder = useFolderStore(state => state.draggedFolder);
  const moveFolder = useFolderStore(state => state.moveFolder);
  const setDraggedFolder = useFolderStore(state => state.setDraggedFolder);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim(), null);
      setNewFolderName('');
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
      moveFolder(draggedFolder.id, null, null);
      setDraggedFolder(null, null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-r-2 border-border">
      <div className="h-[73px] p-4 border-b-2 border-border flex items-center justify-between shrink-0 bg-background">
        <h2 className="text-lg font-black uppercase tracking-tighter">Collections</h2>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SettingsDialog />
          <Button
            size="icon"
            variant="ghost"
            className="rounded-none hover:bg-primary hover:text-primary-foreground border-border"
            onClick={() => setIsCreating(true)}
            title="Create collection"
            aria-label="Create collection"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div 
          className={cn(
            "p-2 min-h-full",
            isDragOver && "bg-primary/10"
          )}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          {isCreating && (
            <div className="flex items-center gap-1 px-2 py-1.5 mb-2">
              <Folder className="h-4 w-4 text-accent shrink-0 ml-5" />
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Collection name"
                className="h-7 text-sm flex-1"
                autoFocus
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewFolderName('');
                  }
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCreateFolder}>
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {folders.length === 0 && !isCreating && (
            <p className="text-sm text-muted-foreground text-center py-8 px-4 font-mono uppercase">
              No collections found.
            </p>
          )}

          {folders.map((folder) => (
            <FolderItem key={folder.id} folder={folder} depth={0} parentId={null} />
          ))}
          
          {/* Drop zone at the bottom for easier folder reordering */}
          {draggedFolder && (
            <div
              className={cn(
                "h-16 mt-2 rounded-none border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-xs font-mono uppercase transition-colors",
                isDragOver && "border-primary bg-primary/10 text-primary"
              )}
              onDragOver={handleRootDragOver}
              onDragLeave={handleRootDragLeave}
              onDrop={handleRootDrop}
            >
              MOVE_TO_ROOT
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
