import { cleanTemplates } from "./templates";
import { MAX_TEMPLATES, templateRecordSchema, type TemplateRecord } from "./template-types";
const DB_NAME = "prompt-giao-vien.templates.v1";
function openDb(): Promise<IDBDatabase> { return new Promise((resolve,reject) => {
  const request = indexedDB.open(DB_NAME,1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("templates")) request.result.createObjectStore("templates",{keyPath:"id"}); };
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Thư viện đang được mở ở tab khác."));
}); }
export async function loadTemplates(): Promise<TemplateRecord[]> { const db = await openDb(); try { return await new Promise((resolve,reject) => {
  const transaction = db.transaction("templates","readonly"); const request = transaction.objectStore("templates").getAll();
  request.onsuccess = () => resolve(cleanTemplates(request.result)); request.onerror = () => reject(request.error);
}); } finally { db.close(); } }
export async function saveTemplates(records: TemplateRecord[]): Promise<void> {
  if (records.length > MAX_TEMPLATES) throw new Error("Thư viện hỗ trợ tối đa " + MAX_TEMPLATES + " mẫu.");
  const safe = records.map(record => templateRecordSchema.parse(record)); const db = await openDb();
  try { await new Promise<void>((resolve,reject) => { const transaction = db.transaction("templates","readwrite"); const store = transaction.objectStore("templates"); store.clear(); safe.forEach(record => store.put(record)); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); }
  finally { db.close(); }
}
