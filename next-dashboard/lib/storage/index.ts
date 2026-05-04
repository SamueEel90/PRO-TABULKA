/**
 * Storage abstraction — wraps file storage so we can switch
 * Vercel Blob → Google Cloud Storage → S3 without changing call sites.
 *
 * Currently a stub — only used for Excel uploads which are processed
 * synchronously in-memory. When we need persistent file storage
 * (e.g. archive uploaded files), implement put/get/delete here.
 */

export interface StorageProvider {
  put(key: string, data: Uint8Array | Buffer, opts?: { contentType?: string }): Promise<{ url: string }>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class NoopStorageProvider implements StorageProvider {
  async put(): Promise<{ url: string }> {
    throw new Error('Storage not configured. Implement a provider in lib/storage.');
  }
  async get(): Promise<Buffer> {
    throw new Error('Storage not configured.');
  }
  async delete(): Promise<void> {
    throw new Error('Storage not configured.');
  }
}

export const storage: StorageProvider = new NoopStorageProvider();
