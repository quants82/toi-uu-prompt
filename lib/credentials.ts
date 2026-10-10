import type { Provider } from "./config";

export const KEY_STORAGE_PREFIX = "prompt-giao-vien.api-key.v1.";
export function readSavedKey(storage: Pick<Storage, "getItem">, provider: Provider): string {
  const value = storage.getItem(KEY_STORAGE_PREFIX + provider) || "";
  return value.length <= 512 && !/[\r\n]/.test(value) ? value.trim() : "";
}
export function storeSavedKey(storage: Pick<Storage, "setItem" | "removeItem">, provider: Provider, key: string): void {
  const value = key.trim();
  if (value.length > 512 || /[\r\n]/.test(value)) throw new Error("Invalid key");
  if (value) storage.setItem(KEY_STORAGE_PREFIX + provider, value);
  else storage.removeItem(KEY_STORAGE_PREFIX + provider);
}
