import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Eye, EyeOff, Lock, Unlock, X, Plus } from 'lucide-react';
import { ModelManager } from './WhisperModelManager';
import { ParakeetModelManager } from './ParakeetModelManager';

interface AutoRecordApp {
    bundle_id: string;
    display_name: string;
}


export interface TranscriptModelProps {
    provider: 'localWhisper' | 'parakeet' | 'deepgram' | 'elevenLabs' | 'groq' | 'openai';
    model: string;
    apiKey?: string | null;
}

export interface TranscriptSettingsProps {
    transcriptModelConfig: TranscriptModelProps;
    setTranscriptModelConfig: (config: TranscriptModelProps) => void;
    onModelSelect?: () => void;
}

export function TranscriptSettings({ transcriptModelConfig, setTranscriptModelConfig, onModelSelect }: TranscriptSettingsProps) {
    const [apiKey, setApiKey] = useState<string | null>(transcriptModelConfig.apiKey || null);
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const [isApiKeyLocked, setIsApiKeyLocked] = useState<boolean>(true);
    const [isLockButtonVibrating, setIsLockButtonVibrating] = useState<boolean>(false);
    const [uiProvider, setUiProvider] = useState<TranscriptModelProps['provider']>(transcriptModelConfig.provider);
    const [autoRecordApps, setAutoRecordApps] = useState<AutoRecordApp[]>([]);
    const [savingApps, setSavingApps] = useState(false);
    const [addingApp, setAddingApp] = useState(false);

    // Sync uiProvider when backend config changes (e.g., after model selection or initial load)
    useEffect(() => {
        setUiProvider(transcriptModelConfig.provider);
    }, [transcriptModelConfig.provider]);

    useEffect(() => {
        if (transcriptModelConfig.provider === 'localWhisper' || transcriptModelConfig.provider === 'parakeet') {
            setApiKey(null);
        }
    }, [transcriptModelConfig.provider]);

    useEffect(() => {
        const loadApps = async () => {
            try {
                const prefs = await invoke<{ auto_record_apps: AutoRecordApp[] }>('get_recording_preferences');
                setAutoRecordApps(prefs.auto_record_apps ?? []);
            } catch (error) {
                console.error('Failed to load auto-transcription apps:', error);
            }
        };
        loadApps();
    }, []);

    const saveAutoRecordApps = async (apps: AutoRecordApp[]) => {
        setSavingApps(true);
        try {
            const prefs = await invoke<{ preferred_mic_device: string | null; preferred_system_device: string | null; auto_record_apps: AutoRecordApp[] }>('get_recording_preferences');
            await invoke('set_recording_preferences', { preferences: { ...prefs, auto_record_apps: apps } });
        } catch (error) {
            console.error('Failed to save auto-transcription apps:', error);
        } finally {
            setSavingApps(false);
        }
    };

    const handleAddApp = async () => {
        setAddingApp(true);
        try {
            const picked = await invoke<AutoRecordApp | null>('pick_application_for_auto_record');
            if (!picked) return;
            if (autoRecordApps.some((a) => a.bundle_id === picked.bundle_id)) return;
            const updated = [...autoRecordApps, picked];
            setAutoRecordApps(updated);
            await saveAutoRecordApps(updated);
        } catch (error) {
            console.error('Failed to pick app:', error);
        } finally {
            setAddingApp(false);
        }
    };

    const handleRemoveApp = async (bundleId: string) => {
        const updated = autoRecordApps.filter((a) => a.bundle_id !== bundleId);
        setAutoRecordApps(updated);
        await saveAutoRecordApps(updated);
    };

    const fetchApiKey = async (provider: string) => {
        try {

            const data = await invoke('api_get_transcript_api_key', { provider }) as string;

            setApiKey(data || '');
        } catch (err) {
            console.error('Error fetching API key:', err);
            setApiKey(null);
        }
    };
    const modelOptions = {
        localWhisper: [], // Model selection handled by ModelManager component
        parakeet: [], // Model selection handled by ParakeetModelManager component
        deepgram: ['nova-2-phonecall'],
        elevenLabs: ['eleven_multilingual_v2'],
        groq: ['llama-3.3-70b-versatile'],
        openai: ['gpt-4o'],
    };
    const requiresApiKey = transcriptModelConfig.provider === 'deepgram' || transcriptModelConfig.provider === 'elevenLabs' || transcriptModelConfig.provider === 'openai' || transcriptModelConfig.provider === 'groq';

    const handleInputClick = () => {
        if (isApiKeyLocked) {
            setIsLockButtonVibrating(true);
            setTimeout(() => setIsLockButtonVibrating(false), 500);
        }
    };

    const handleWhisperModelSelect = (modelName: string) => {
        // Always update config when model is selected, regardless of current provider
        // This ensures the model is set when user switches back
        setTranscriptModelConfig({
            ...transcriptModelConfig,
            provider: 'localWhisper', // Ensure provider is set correctly
            model: modelName
        });
        // Close modal after selection
        if (onModelSelect) {
            onModelSelect();
        }
    };

    const handleParakeetModelSelect = (modelName: string) => {
        // Always update config when model is selected, regardless of current provider
        // This ensures the model is set when user switches back
        setTranscriptModelConfig({
            ...transcriptModelConfig,
            provider: 'parakeet', // Ensure provider is set correctly
            model: modelName
        });
        // Close modal after selection
        if (onModelSelect) {
            onModelSelect();
        }
    };

    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-2">Auto-Transcription Apps</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Transcription starts immediately when these apps take the microphone — no countdown prompt.
                </p>

                <div className="border border-border rounded-lg overflow-hidden">
                    {autoRecordApps.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-3">
                            No apps configured. Click "Add App" to get started.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {autoRecordApps.map((app) => (
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
                                        disabled={savingApps}
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
                    disabled={addingApp || savingApps}
                >
                    <Plus className="h-4 w-4 mr-1" />
                    {addingApp ? 'Choosing…' : 'Add App…'}
                </Button>
            </div>

            <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-4">Model Settings</h3>
                <div className="space-y-4">
                    <div>
                        <div className="flex space-x-2 mx-1">
                            <Select
                                value={uiProvider}
                                onValueChange={(value) => {
                                    const provider = value as TranscriptModelProps['provider'];
                                    setUiProvider(provider);
                                    if (provider !== 'localWhisper' && provider !== 'parakeet') {
                                        fetchApiKey(provider);
                                    }
                                }}
                            >
                                <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="parakeet">⚡ Parakeet (Recommended - Real-time / Accurate)</SelectItem>
                                    <SelectItem value="localWhisper">🏠 Local Whisper (High Accuracy)</SelectItem>
                                    {/* <SelectItem value="deepgram">☁️ Deepgram (Backup)</SelectItem>
                                    <SelectItem value="elevenLabs">☁️ ElevenLabs</SelectItem>
                                    <SelectItem value="groq">☁️ Groq</SelectItem>
                                    <SelectItem value="openai">☁️ OpenAI</SelectItem> */}
                                </SelectContent>
                            </Select>

                            {uiProvider !== 'localWhisper' && uiProvider !== 'parakeet' && (
                                <Select
                                    value={transcriptModelConfig.model}
                                    onValueChange={(value) => {
                                        const model = value as TranscriptModelProps['model'];
                                        setTranscriptModelConfig({ ...transcriptModelConfig, provider: uiProvider, model });
                                    }}
                                >
                                    <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modelOptions[uiProvider].map((model) => (
                                            <SelectItem key={model} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                        </div>
                    </div>

                    {uiProvider === 'localWhisper' && (
                        <div className="mt-6">
                            <ModelManager
                                selectedModel={transcriptModelConfig.provider === 'localWhisper' ? transcriptModelConfig.model : undefined}
                                onModelSelect={handleWhisperModelSelect}
                                autoSave={true}
                            />
                        </div>
                    )}

                    {uiProvider === 'parakeet' && (
                        <div className="mt-6">
                            <ParakeetModelManager
                                selectedModel={transcriptModelConfig.provider === 'parakeet' ? transcriptModelConfig.model : undefined}
                                onModelSelect={handleParakeetModelSelect}
                                autoSave={true}
                            />
                        </div>
                    )}

                    {requiresApiKey && (
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key
                            </Label>
                            <div className="relative mx-1">
                                <Input
                                    type={showApiKey ? "text" : "password"}
                                    className={`pr-24 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isApiKeyLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    value={apiKey || ''}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={isApiKeyLocked}
                                    onClick={handleInputClick}
                                    placeholder="Enter your API key"
                                />
                                {isApiKeyLocked && (
                                    <div
                                        onClick={handleInputClick}
                                        className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md cursor-not-allowed"
                                    />
                                )}
                                <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                                        className={`transition-colors duration-200 ${isLockButtonVibrating ? 'animate-vibrate text-red-500' : ''
                                            }`}
                                        title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                                    >
                                        {isApiKeyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}








