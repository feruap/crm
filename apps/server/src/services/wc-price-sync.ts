// Stub: WooCommerce price sync for medical products
import { db } from '../db';

export async function syncPricesFromWC() {
  console.log('WC price sync: use the UI sync button in Productos Med.');
  return { updated: 0, errors: [] as string[] };
}

export async function getWCProductPrice(_wcProductId: number): Promise<number | null> {
  return null;
}
