export class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function requireOptionalNativeModule(): null {
  return null;
}

export function requireNativeModule(): Record<string, unknown> {
  return {};
}

export class EventEmitter {
  addListener(): { remove: () => void } {
    return { remove() {} };
  }
  removeAllListeners(): void {}
}

export class NativeModule {}
export class SharedObject {}
export class SharedRef {}
export class UnavailabilityError extends Error {}

export const Platform = {
  OS: 'ios',
  select<T>(specifics: { ios?: T; default?: T }): T | undefined {
    return specifics.ios ?? specifics.default;
  },
};

export function requireNativeViewManager(): () => null {
  return () => null;
}
export function registerWebModule(): void {}
export async function reloadAppAsync(): Promise<void> {}
export function installOnUIRuntime(): void {}
export function uuid(): string {
  return 'preview';
}
export function createSnapshotFriendlyRef<T>(value: T): { current: T } {
  return { current: value };
}
export function useReleasingSharedObject(): null {
  return null;
}
export function useReleasingSharedObjectWithLifecycle(): null {
  return null;
}
export const PermissionStatus = { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' };
export function createPermissionHook(): () => [{ status: string }, () => Promise<void>] {
  return () => [{ status: 'undetermined' }, async () => undefined];
}
