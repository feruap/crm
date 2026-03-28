import { db } from '../db';
export async function syncPricesFromWC() {
  console.log('WC price sync: stub — use the UI sync button instead');
  return { updated: 0 };
}

export async function syncWCPrices() {
  console.log('WC price sync: stub — use the UI sync button instead');
  return { updated: 0, synced: 0, errors: 0, changes: 0, unmatched_wc: [] as string[], unmatched_crm: [] as string[] };
}
