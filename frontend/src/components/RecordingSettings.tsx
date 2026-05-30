import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DeviceSelection, SelectedDevices } from '@/components/DeviceSelection';

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
      <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
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
  );
}
