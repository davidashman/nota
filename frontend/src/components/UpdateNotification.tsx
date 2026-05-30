import { UpdateInfo } from '@/services/updateService';

let globalShowDialogCallback: (() => void) | null = null;

export function setUpdateDialogCallback(callback: () => void) {
  globalShowDialogCallback = callback;
}

export function showUpdateNotification(_updateInfo: UpdateInfo, onUpdateClick?: () => void) {
  if (onUpdateClick) {
    onUpdateClick();
  } else if (globalShowDialogCallback) {
    globalShowDialogCallback();
  }
}
