import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceSelection, SelectedDevices } from '@/components/DeviceSelection';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface AutoRecordApp {
  bundle_id: string;
  display_name: string;
}

export interface RecordingPreferences {
  preferred_mic_device: string | null;
  preferred_system_device: string | null;
  auto_record_apps: AutoRecordApp[];
}

interface RecordingSettingsProps {
  onSave?: (preferences: RecordingPreferences) => void;
}

export function RecordingSettings({ onSave }: RecordingSettingsProps) {
  const [preferences, setPreferences] = useState<RecordingPreferences>({
    preferred_mic_device: null,
    preferred_system_device: null,
    auto_record_apps: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingApp, setAddingApp] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await invoke<RecordingPreferences>('get_recording_preferences');
        setPreferences({
          ...prefs,
          auto_record_apps: prefs.auto_record_apps ?? [],
        });
      } catch (error) {
        console.error('Failed to load recording preferences:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleDeviceChange = async (devices: SelectedDevices) => {
    const newPreferences = {
      ...preferences,
      preferred_mic_device: devices.micDevice,
      preferred_system_device: devices.systemDevice,
    };
    setPreferences(newPreferences);
    await savePreferences(newPreferences);

  };

  const savePreferences = async (prefs: RecordingPreferences) => {
    setSaving(true);
    try {
      await invoke('set_recording_preferences', { preferences: prefs });
      onSave?.(prefs);
    } catch (error) {
      console.error('Failed to save recording preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddApp = async () => {
    setAddingApp(true);
    try {
      const picked = await invoke<AutoRecordApp | null>('pick_application_for_auto_record');
      if (!picked) return;

      const alreadyAdded = preferences.auto_record_apps.some(
        (a) => a.bundle_id === picked.bundle_id
      );
      if (alreadyAdded) {
        return;
      }

      const updated: RecordingPreferences = {
        ...preferences,
        auto_record_apps: [...preferences.auto_record_apps, picked],
      };
      setPreferences(updated);
      await savePreferences(updated);
    } catch (error) {
      console.error('Failed to pick app:', error);
    } finally {
      setAddingApp(false);
    }
  };

  const handleRemoveApp = async (bundleId: string) => {
    const updated: RecordingPreferences = {
      ...preferences,
      auto_record_apps: preferences.auto_record_apps.filter((a) => a.bundle_id !== bundleId),
    };
    setPreferences(updated);
    await savePreferences(updated);
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
        <div className="h-8 bg-muted rounded mb-4"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="pt-6">
        <h4 className="text-base font-medium text-foreground mb-4">Default Audio Devices</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Set your preferred microphone and system audio devices for listening. These will be automatically selected when starting new sessions.
        </p>

        <div className="border border-border rounded-lg p-4 bg-muted/50">
          <DeviceSelection
            selectedDevices={{
              micDevice: preferences.preferred_mic_device,
              systemDevice: preferences.preferred_system_device,
            }}
            onDeviceChange={handleDeviceChange}
            disabled={saving}
          />
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="text-base font-medium text-foreground mb-2">Auto-Record Apps</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Recording starts immediately when these apps take the microphone — no countdown prompt.
        </p>

        <div className="border border-border rounded-lg overflow-hidden">
          {preferences.auto_record_apps.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-3">
              No apps configured. Click "Add App" to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {preferences.auto_record_apps.map((app) => (
                <li
                  key={app.bundle_id}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <div>
                    <span className="text-sm font-medium">{app.display_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{app.bundle_id}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveApp(app.bundle_id)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleAddApp}
          disabled={addingApp || saving}
        >
          <Plus className="h-4 w-4 mr-1" />
          {addingApp ? 'Choosing…' : 'Add App…'}
        </Button>
      </div>
    </div>
  );
}
