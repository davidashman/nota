"use client";
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Summary, SummaryResponse } from '@/types';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { invoke } from '@tauri-apps/api/core';
import { TranscriptPanel } from '@/components/MeetingDetails/TranscriptPanel';
import { SummaryPanel } from '@/components/MeetingDetails/SummaryPanel';
import { AnalysisPanel } from '@/components/MeetingDetails/AnalysisPanel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FolderOpen } from 'lucide-react';
import { ModelConfig } from '@/components/ModelSettingsModal';

const TABS = [
  { value: 'transcript' as const, label: 'Transcript' },
  { value: 'summary' as const, label: 'Summary' },
  { value: 'analysis' as const, label: 'Analysis' },
];

// Custom hooks
import { useMeetingData } from '@/hooks/meeting-details/useMeetingData';
import { useSummaryGeneration } from '@/hooks/meeting-details/useSummaryGeneration';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { useCopyOperations } from '@/hooks/meeting-details/useCopyOperations';
import { useMeetingOperations } from '@/hooks/meeting-details/useMeetingOperations';
import { useConfig } from '@/contexts/ConfigContext';

export default function PageContent({
  meeting,
  summaryData,
  shouldAutoGenerate = false,
  onAutoGenerateComplete,
  onMeetingUpdated,
  onRefetchTranscripts,
  // Pagination props for efficient transcript loading
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
}: {
  meeting: any;
  summaryData: Summary | null;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  onMeetingUpdated?: () => Promise<void>;
  onRefetchTranscripts?: () => Promise<void>;
  // Pagination props
  segments?: any[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
}) {
  console.log('📄 PAGE CONTENT: Initializing with data:', {
    meetingId: meeting.id,
    summaryDataKeys: summaryData ? Object.keys(summaryData) : null,
    transcriptsCount: meeting.transcripts?.length
  });

  // State
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isRecording] = useState(false);
  const [summaryResponse] = useState<SummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'analysis'>('summary');

  // Tab underline animation
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const activeIndex = TABS.findIndex(tab => tab.value === activeTab);
    const el = tabRefs.current[activeIndex];
    if (el) setUnderlineStyle({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  // Ref to store the modal open function from SummaryGeneratorButtonGroup
  const openModelSettingsRef = useRef<(() => void) | null>(null);

  // Sidebar context
  const { serverAddress } = useSidebar();

  // Get model config from ConfigContext
  const { modelConfig, setModelConfig } = useConfig();

  // Custom hooks
  const meetingData = useMeetingData({ meeting, summaryData, onMeetingUpdated });
  const templates = useTemplates();

  // Callback to register the modal open function
  const handleRegisterModalOpen = (openFn: () => void) => {
    console.log('📝 Registering modal open function in PageContent');
    openModelSettingsRef.current = openFn;
  };

  // Callback to trigger modal open (called from error handler)
  const handleOpenModelSettings = () => {
    console.log('🔔 Opening model settings from PageContent');
    if (openModelSettingsRef.current) {
      openModelSettingsRef.current();
    } else {
      console.warn('⚠️ Modal open function not yet registered');
    }
  };

  // Save model config to backend database and sync via event
  const handleSaveModelConfig = async (config?: ModelConfig) => {
    if (!config) return;
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey ?? null,
        ollamaEndpoint: config.ollamaEndpoint ?? null,
      });

      // Emit event so ConfigContext and other listeners stay in sync
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

    } catch (error) {
      console.error('Failed to save model config:', error);
    }
  };

  const summaryGeneration = useSummaryGeneration({
    meeting,
    transcripts: meetingData.transcripts,
    modelConfig: modelConfig,
    isModelConfigLoading: false, // ConfigContext loads on mount
    selectedTemplate: templates.selectedTemplate,
    onMeetingUpdated,
    updateMeetingTitle: meetingData.updateMeetingTitle,
    setAiSummary: meetingData.setAiSummary,
    onOpenModelSettings: handleOpenModelSettings,
  });

  const copyOperations = useCopyOperations({
    meeting,
    transcripts: meetingData.transcripts,
    meetingTitle: meetingData.meetingTitle,
    aiSummary: meetingData.aiSummary,
    blockNoteSummaryRef: meetingData.blockNoteSummaryRef,
  });

  const meetingOperations = useMeetingOperations({
    meeting,
  });

  // Auto-generate summary when flag is set
  useEffect(() => {
    let cancelled = false;

    const autoGenerate = async () => {
      if (shouldAutoGenerate && meetingData.transcripts.length > 0 && !cancelled) {
        console.log(`🤖 Auto-generating summary with ${modelConfig.provider}/${modelConfig.model}...`);
        await summaryGeneration.handleGenerateSummary('');

        // Notify parent that auto-generation is complete (only if not cancelled)
        if (onAutoGenerateComplete && !cancelled) {
          onAutoGenerateComplete();
        }
      }
    };

    autoGenerate();

    // Cleanup: cancel if component unmounts or meeting changes
    return () => {
      cancelled = true;
    };
  }, [shouldAutoGenerate, meeting.id]); // Re-run if meeting changes

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col h-screen bg-background"
    >
      {/* Tab bar */}
      <div data-tauri-drag-region className="flex items-center justify-between border-b border-border shrink-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'transcript' | 'summary' | 'analysis')}>
          <TabsList className="bg-transparent relative rounded-none p-0 h-auto">
            {TABS.map((tab, index) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                ref={el => { tabRefs.current[index] = el; }}
                className="flex items-center px-4 py-2 bg-transparent rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:text-blue-500 data-[state=active]:shadow-none text-muted-foreground hover:text-foreground transition-colors relative z-10 text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
            <motion.div
              className="absolute bottom-0 z-20 h-0.5 bg-blue-600"
              layoutId="content-tab-underline"
              style={{ left: underlineStyle.left, width: underlineStyle.width }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            />
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 mr-4"
          onClick={() => {
            meetingOperations.handleOpenMeetingFolder();
          }}
          title="Open Recording Folder"
        >
          <FolderOpen size={16} />
        </Button>
      </div>

      {/* Panel content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'transcript' && (
          <TranscriptPanel
            transcripts={meetingData.transcripts}
            customPrompt={customPrompt}
            onPromptChange={setCustomPrompt}
            onCopyTranscript={copyOperations.handleCopyTranscript}
            isRecording={isRecording}
            disableAutoScroll={true}
            usePagination={true}
            segments={segments}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            totalCount={totalCount}
            loadedCount={loadedCount}
            onLoadMore={onLoadMore}
            meetingId={meeting.id}
            meetingFolderPath={meeting.folder_path}
            onRefetchTranscripts={onRefetchTranscripts}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryPanel
            meeting={meeting}
            meetingTitle={meetingData.meetingTitle}
            onTitleChange={meetingData.handleTitleChange}
            isEditingTitle={meetingData.isEditingTitle}
            onStartEditTitle={() => meetingData.setIsEditingTitle(true)}
            onFinishEditTitle={() => meetingData.setIsEditingTitle(false)}
            isTitleDirty={meetingData.isTitleDirty}
            summaryRef={meetingData.blockNoteSummaryRef}
            isSaving={meetingData.isSaving}
            onSaveAll={meetingData.saveAllChanges}
            onCopySummary={copyOperations.handleCopySummary}
            aiSummary={meetingData.aiSummary}
            summaryStatus={summaryGeneration.summaryStatus}
            transcripts={meetingData.transcripts}
            modelConfig={modelConfig}
            setModelConfig={setModelConfig}
            onSaveModelConfig={handleSaveModelConfig}
            onGenerateSummary={summaryGeneration.handleGenerateSummary}
            onStopGeneration={summaryGeneration.handleStopGeneration}
            customPrompt={customPrompt}
            summaryResponse={summaryResponse}
            onSaveSummary={meetingData.handleSaveSummary}
            onSummaryChange={meetingData.handleSummaryChange}
            onDirtyChange={meetingData.setIsSummaryDirty}
            summaryError={summaryGeneration.summaryError}
            onRegenerateSummary={summaryGeneration.handleRegenerateSummary}
            availableTemplates={templates.availableTemplates}
            selectedTemplate={templates.selectedTemplate}
            onTemplateSelect={templates.handleTemplateSelection}
            isModelConfigLoading={false}
            onOpenModelSettings={handleRegisterModalOpen}
          />
        )}
        {activeTab === 'analysis' && (
          <AnalysisPanel
            meetingId={meeting.id}
            transcripts={meetingData.transcripts}
          />
        )}
      </div>
    </motion.div>
  );
}
