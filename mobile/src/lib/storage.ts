// Web: the browser's own localStorage. (storage.native.ts is used on iOS/Android.)
export const storage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined;
