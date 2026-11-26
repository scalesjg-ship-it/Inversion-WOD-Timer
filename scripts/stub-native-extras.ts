export function createAudioPlayer() {
  return { volume: 1, play() {}, seekTo() {}, remove() {} };
}
export async function setAudioModeAsync() {}
export async function impactAsync() {}
export async function notificationAsync() {}
export async function selectionAsync() {}
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Warning: 'warning', Success: 'success', Error: 'error' };
export function useKeepAwake() {}
export async function activateKeepAwakeAsync() {}
export async function deactivateKeepAwake() {}
export async function deactivateKeepAwakeAsync() {}
