"use client"

import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Sun, Moon } from "lucide-react"
import { Switch } from "./ui/switch"
import { useTheme } from "@/contexts/ThemeContext"

const DEFAULT_NOTES_LOCATION = "~/Documents/Nota"

export function PreferenceSettings() {
  const [notesLocation, setNotesLocation] = useState<string>(DEFAULT_NOTES_LOCATION);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const handleSelectLocation = async () => {
    setIsSelectingLocation(true);
    try {
      const selected = await invoke<string | null>("select_notes_directory");
      if (selected) {
        setNotesLocation(selected);
      }
    } catch (err) {
      console.error("Failed to select notes directory:", err);
    } finally {
      setIsSelectingLocation(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Dark Mode */}
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {theme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
              <h3 className="text-lg font-semibold text-foreground">Dark Mode</h3>
            </div>
            <p className="text-sm text-muted-foreground">Switch between light and dark appearance</p>
          </div>
          <div className="ml-6">
            <Switch checked={theme === 'dark'} onCheckedChange={() => toggleTheme()} />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-1">Notes location</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Where Nota saves your notes
        </p>
        <div className="font-mono text-xs text-muted-foreground break-all mb-4">
          {notesLocation}
        </div>
        <button
          onClick={handleSelectLocation}
          disabled={isSelectingLocation}
          className="px-3 py-1.5 text-xs font-medium text-foreground bg-secondary rounded-md hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSelectingLocation ? "Selecting..." : "Select new location"}
        </button>
      </div>
    </div>
  )
}
