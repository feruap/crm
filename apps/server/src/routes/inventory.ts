/**
 * Inventory Routes
 *
 * GET  /api/inventory/:productId     — Stock for a single product
 * GET  /api/inventory/bulk           — Stock for multiple products (query: ids=1,2,3)
 * POST /api/inventory/clear-cache    — Clear the stock cache
 */

import { Router, Request, Response } from 'express';
import { getProductStock, getBulkProductStock, clearStockCache } from '../services/inventory';

const router = Router();

// IMPORTANT: /bulk and /clear-cache MUST be defined BEFORE /:productId
// to prevent the wildcard param from catching them.

router.get('/bulk', async (req: Request, res: Response) => {
    try {
        const idsStr = req.query.ids as string;
        if (!idsStr) {
            res.status(400).json({ error: 'ids query parameter required (comma-separated)' });
            return;
        }

        const ids = idsStr.split(',').map(Number).filter(n => n > 0);
        if (ids.length === 0) {
            res.status(400).json({ error: 'No valid product IDs provided' });
            return;
        }

        const stocks = await getBulkProductStock(ids);
        res.json(stocks);
    } catch (err) {
        console.error('[Inventory] Bulk error:', err);
        res.status(500).json({ error: 'Error fetching bulk stock' });
    }
});

router.post('/clear-cache', async (_req: Request, res: Response) => {
    clearStockCache();
    res.json({ ok: true, message: 'Stock cache cleared' });
});

router.get('/:productId', async (req: Request, res: Response) => {
    try {
        const productId = Number(req.params.productId);
        if (!productId) {
            res.status(400).json({ error: 'Invalid product ID' });
            return;
        }

        const stock = await getProductStock(productId);
        res.json(stock);
    } catch (err) {
        console.error('[Inventory] Error:', err);
        res.status(500).json({ error: 'Error fetching stock', details: String(err) });
    }
});

export default router;
