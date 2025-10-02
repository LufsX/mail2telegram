import type { KVNamespace } from "@cloudflare/workers-types";
import type { EmailCache, EmailHandleStatus } from "../types";

export type AddressListStoreKey = "BLOCK_LIST" | "WHITE_LIST";

export class Dao {
  private readonly db: KVNamespace;

  constructor(db: KVNamespace) {
    this.db = db;
    this.loadArrayFromDB = this.loadArrayFromDB.bind(this);
    this.addAddress = this.addAddress.bind(this);
    this.removeAddress = this.removeAddress.bind(this);
    this.loadMailStatus = this.loadMailStatus.bind(this);
    this.loadMailCache = this.loadMailCache.bind(this);
    this.saveMailCache = this.saveMailCache.bind(this);
    this.loadMailSummary = this.loadMailSummary.bind(this);
    this.saveMailSummary = this.saveMailSummary.bind(this);
  }

  async loadArrayFromDB(key: AddressListStoreKey): Promise<string[]> {
    try {
      const raw = await this.db.get(key);
      return loadArrayFromRaw(raw);
    } catch (e) {
      console.error(e);
    }
    return [];
  }

  async addAddress(address: string, type: AddressListStoreKey): Promise<void> {
    const list = await this.loadArrayFromDB(type);
    list.unshift(address);
    await this.db.put(type, JSON.stringify(list));
  }

  async removeAddress(address: string, type: AddressListStoreKey): Promise<void> {
    const list = await this.loadArrayFromDB(type);
    const result = list.filter((item) => item !== address);
    await this.db.put(type, JSON.stringify(result));
  }

  async loadMailStatus(id: string, guardian: boolean): Promise<EmailHandleStatus> {
    const defaultStatus = {
      telegram: false,
      forward: [],
    };
    if (guardian) {
      try {
        const raw = await this.db.get(id);
        if (raw) {
          return {
            ...defaultStatus,
            ...JSON.parse(raw),
          };
        }
      } catch (e) {
        console.error(e);
      }
    }
    return defaultStatus;
  }

  async saveMailStatus(id: string, status: EmailHandleStatus, ttl?: number): Promise<void> {
    await this.db.put(id, JSON.stringify(status), { expirationTtl: ttl });
  }

  async loadMailCache(id: string): Promise<EmailCache | null> {
    try {
      const raw = await this.db.get(id);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  async saveMailCache(id: string, cache: EmailCache, ttl?: number): Promise<void> {
    await this.db.put(id, JSON.stringify(cache), { expirationTtl: ttl });
  }

  private buildMailSummaryKey(id: string, lang?: string): string {
    const normalizedLang = (lang || "default").toLowerCase();
    return `MailSummary:${normalizedLang}:${id}`;
  }

  async loadMailSummary(id: string, lang?: string): Promise<string | null> {
    try {
      return await this.db.get(this.buildMailSummaryKey(id, lang));
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  async saveMailSummary(id: string, lang: string | undefined, summary: string, ttl?: number): Promise<void> {
    const key = this.buildMailSummaryKey(id, lang);
    if (ttl && ttl > 0) {
      await this.db.put(key, summary, { expirationTtl: ttl });
    } else {
      await this.db.put(key, summary);
    }
  }

  async telegramIDToMailID(id: string): Promise<string | null> {
    return await this.db.get(`TelegramID2MailID:${id}`);
  }

  async saveTelegramIDToMailID(id: string, mailID: string, ttl?: number): Promise<void> {
    await this.db.put(`TelegramID2MailID:${id}`, mailID, { expirationTtl: ttl });
  }

  async deleteMail(id: string): Promise<void> {
    // Delete the mail cache itself
    await this.db.delete(id);

    // Delete all mail summaries
    const summaryPrefix = `MailSummary:`;
    const summaryList = await this.db.list({ prefix: summaryPrefix });
    for (const key of summaryList.keys) {
      if (key.name.endsWith(`:${id}`)) {
        await this.db.delete(key.name);
      }
    }

    // Delete all TelegramID to MailID mappings that point to this mail
    const telegramMappingPrefix = `TelegramID2MailID:`;
    const mappingList = await this.db.list({ prefix: telegramMappingPrefix });
    for (const key of mappingList.keys) {
      try {
        const mailID = await this.db.get(key.name);
        if (mailID === id) {
          await this.db.delete(key.name);
          console.log(`Deleted telegram mapping: ${key.name} -> ${id}`);
        }
      } catch (e) {
        console.error(`Failed to check mapping ${key.name}:`, e);
      }
    }
  }

  async listMails(limit: number = 50, cursor?: string): Promise<{ mails: EmailCache[]; cursor?: string }> {
    const list = await this.db.list({ prefix: "", limit, cursor });
    const mails: EmailCache[] = [];

    for (const key of list.keys) {
      // 只获取邮件缓存，排除其他类型的键
      if (key.name.includes(":") || key.name.includes("_LIST") || key.name.startsWith("TelegramID2MailID:") || key.name.startsWith("MailSummary:")) {
        continue;
      }
      try {
        const raw = await this.db.get(key.name);
        if (raw) {
          const cache = JSON.parse(raw) as EmailCache;
          if (cache.id && cache.from && cache.to) {
            mails.push(cache);
          }
        }
      } catch (e) {
        console.error(`Failed to parse mail ${key.name}:`, e);
      }
    }

    // Sort by receivedAt in descending order (newest first)
    mails.sort((a, b) => {
      const timeA = a.receivedAt || 0;
      const timeB = b.receivedAt || 0;
      return timeB - timeA;
    });

    return {
      mails,
      cursor: list.list_complete ? undefined : list.cursor,
    };
  }
}

export function loadArrayFromRaw(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  let list = [];
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) {
    return [];
  }
  return list;
}
