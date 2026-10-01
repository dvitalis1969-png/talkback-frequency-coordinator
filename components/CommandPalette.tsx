import React, { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { 
  Search, 
  Plus, 
  Download, 
  Settings, 
  FileText, 
  Zap, 
  Radio, 
  Map, 
  Layout,
  User,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onAction: (action: string) => void;
  tabs: { id: string; label: string; category: string }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, setIsOpen, onAction, tabs }) => {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Use e.key.toLowerCase() AND e.code for maximum compatibility
      if ((e.key?.toLowerCase() === 'k' || e.code === 'KeyK') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [setIsOpen]);

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList className="max-h-[400px] overflow-y-auto custom-scrollbar">
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem 
            value="Home App Launcher"
            onSelect={() => {
              onAction('nav:home');
              setIsOpen(false);
            }}
            className="group"
          >
            <Layout className="w-4 h-4 text-indigo-500 group-data-[selected=true]:text-white" />
            <span className="text-sm font-medium">App Launcher (Home)</span>
            <span className="ml-auto text-[10px] text-slate-500 group-data-[selected=true]:text-indigo-200 uppercase font-black tracking-widest">System</span>
          </CommandItem>
          {tabs.map((tab, idx) => (
            <CommandItem 
              key={`${tab.id}-${tab.category}-${idx}`} 
              value={`${tab.label} ${tab.category} ${tab.id}`}
              onSelect={() => {
                onAction(`nav:${tab.id}`);
                setIsOpen(false);
              }}
              className="group"
            >
              <Layout className="w-4 h-4 text-slate-500 group-data-[selected=true]:text-white" />
              <span className="text-sm font-medium">{tab.label}</span>
              <span className="ml-auto text-[10px] text-slate-500 group-data-[selected=true]:text-indigo-200 uppercase font-black tracking-widest">{tab.category}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="bg-white/5" />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { onAction('action:add-freq'); setIsOpen(false); }} className="group">
            <Plus className="w-4 h-4 text-emerald-500 group-data-[selected=true]:text-white" />
            <span className="text-sm font-medium">Add Frequency</span>
          </CommandItem>
          <CommandItem onSelect={() => { onAction('action:export-pdf'); setIsOpen(false); }} className="group">
            <FileText className="w-4 h-4 text-blue-500 group-data-[selected=true]:text-white" />
            <span className="text-sm font-medium">Export PDF Report</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-white/5" />

        <CommandGroup heading="System">
          <CommandItem onSelect={() => { onAction('system:toggle-sunlight'); setIsOpen(false); }} className="group">
            <Sun className="w-4 h-4 text-yellow-500 group-data-[selected=true]:text-white" />
            <span className="text-sm font-medium">Toggle Sunlight Mode</span>
          </CommandItem>
          <CommandItem onSelect={() => { onAction('system:logout'); setIsOpen(false); }} className="group">
            <LogOut className="w-4 h-4 text-rose-500 group-data-[selected=true]:text-white" />
            <span className="text-sm font-medium">Logout</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
