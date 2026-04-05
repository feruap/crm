import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Lucide from 'lucide-react';
import { apiFetch } from '../hooks/useAuth';
import { getSocket } from '../hooks/useSocket';

const {
    ShoppingBag, Search, X, ExternalLink, Image: ImageIcon, Plus, Minus, Send,
    ChevronRight, ChevronLeft, Loader2, ShoppingCart, Tag, TrendingUp, Layers, AlertCircle, Check,
    MapPin, ShieldAlert, ShieldCheck, Clock, CheckCircle2, XCircle, ArrowUpCircle,
} = Lucide as any;

interface CustomerProfile {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    shipping?: {
        first_name: string; last_name: string;
        address_1: string; address_2: string;
        city: string; state: string; postcode: string; country: string;
        email: string; phone: string;
    };
    wc_customer_id?: string | null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface WcProduct {
    id: number; name: string; price: string; regular_price: string; sale_price: string;
    sku: string; stock: string; image: string | null; permalink: string;
    type: string; variations: number[]; categories: { id: number; name: string }[];
    total_sales: number;
}

interface WcVariation {
    id: number; price: string; regular_price: string; sale_price: string;
    sku: string; stock_status: string; attributes: { name: string; option: string }[];
    image: string | null;
}

interface WcCategory { id: number; name: string; slug: string; count: number; image: string | null; }

interface CartItem {
    product: WcProduct;
    quantity: number;
    variation?: WcVariation;
    customPrice?: string;
}

interface SalesKingRules {
    available: boolean;
    reason?: string;
    agent_id?: string;
    display_name?: string;
    pricing?: {
        effective_max_discount: number; // percentage, e.g. 15 = 15%
        agent_max_discount: number | null;
        can_increase_price: boolean;
        can_decrease_price: boolean;
        discount_from_commission: boolean;
    };
    settings?: {
        can_edit_prices_increase: number;
        can_edit_prices_discount: number;
    };
}

interface DiscountRequestState {
    requestId: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedPrice?: number;
    supervisorName?: string;
    note?: string;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function VariationModal({ product, onSelect, onCancel }: {
    product: WcProduct; onSelect: (v: WcVariation) => void; onCancel: () => void;
}) {
    const [variations, setVariations] = useState<WcVariation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch(`/api/products/${product.id}/variations`)
            .then(r => r.json())
            .then(data => setVariations(data.variations ?? []))
            .catch(() => setVariations([]))
            .finally(() => setLoading(false));
    }, [product.id]);

    return (
        <div className="absolute inset-0 bg-white z-20 flex flex-col">
            <div className="px-4 py-3 border-b flex items-center gap-2 bg-indigo-50">
                <button onClick={onCancel} className="p-1 hover:bg-indigo-100 rounded-lg">
                    <ChevronLeft className="w-4 h-4 text-indigo-600" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-indigo-800 truncate">{product.name}</p>
                    <p className="text-xs text-indigo-500">Selecciona una variación</p>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>
                ) : variations.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center p-6">Sin variaciones disponibles</p>
                ) : variations.map(v => {
                    const label = v.attributes.map(a => a.option).join(' / ');
                    const outOfStock = v.stock_status === 'outofstock';
                    return (
                        <button key={v.id} onClick={() => !outOfStock && onSelect(v)} disabled={outOfStock}
                            className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all
                                ${outOfStock ? 'opacity-40 cursor-not-allowed border-slate-200' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
                        >
                            <div className="w-10 h-10 rounded-lg border bg-slate-50 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-4 h-4 text-slate-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{label || `#${v.id}`}</p>
                                <p className="text-xs text-slate-400">{v.sku || ''}{outOfStock ? ' · Agotado' : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                                {v.sale_price && v.sale_price !== v.regular_price ? (
                                    <><span className="text-xs line-through text-slate-400">${v.regular_price}</span>
                                    <span className="text-sm font-bold text-red-600 ml-1">${v.sale_price}</span></>
                                ) : (
                                    <span className="text-sm font-bold text-slate-800">${v.price}</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main CatalogPanel ────────────────────────────────────────────────────────

export default function CatalogPanel({
    conversationId, onSendCartLink, onClose
}: {
    conversationId: string;
    onSendCartLink: (text: string) => void;
    onClose: () => void;
}) {
    // Catalog state
    const [products, setProducts] = useState<WcProduct[]>([]);
    const [categories, setCategories] = useState<WcCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [view, setView] = useState<'catalog' | 'cart'>('catalog');
    const [pendingVariableProduct, setPendingVariableProduct] = useState<WcProduct | null>(null);
    const [mode, setMode] = useState<'popular' | 'search' | 'category'>('popular');

    // Customer profile
    const [customer, setCustomer] = useState<CustomerProfile | null>(null);
    const [customerLoading, setCustomerLoading] = useState(true);

    // SalesKing rules (cached in component state for session)
    const [skRules, setSkRules] = useState<SalesKingRules | null>(null);
    const skRulesFetched = useRef(false);

    // Discount escalation state: cartKey → request state
    const [discountRequests, setDiscountRequests] = useState<Record<string, DiscountRequestState>>({});
    const [escalating, setEscalating] = useState<string | null>(null); // cartKey currently being escalated

    // ── Fetch SalesKing rules once ──────────────────────────────────────────
    useEffect(() => {
        if (skRulesFetched.current) return;
        skRulesFetched.current = true;
        apiFetch('/api/salesking/agent-rules')
            .then(r => r.json())
            .then((data: SalesKingRules) => setSkRules(data))
            .catch(() => setSkRules({ available: false, reason: 'Error al cargar reglas' }));
    }, []);

    // ── Socket listeners for discount approvals/rejections ──────────────────
    useEffect(() => {
        const socket = getSocket();

        const handleApproved = (data: {
            request_id: string; product_id: number; product_name: string;
            approved_price: number; original_price: number;
            supervisor_name: string; note: string | null;
        }) => {
            setDiscountRequests(prev => {
                const updated = { ...prev };
                for (const key of Object.keys(prev)) {
                    if (prev[key].requestId === data.request_id) {
                        updated[key] = {
                            ...prev[key],
                            status: 'approved',
                            approvedPrice: data.approved_price,
                            supervisorName: data.supervisor_name,
                            note: data.note ?? undefined,
                        };
                        // Auto-apply approved price to cart
                        setCart(c => c.map(i =>
                            (i.variation ? `v-${i.variation.id}` : `p-${i.product.id}`) === key
                                ? { ...i, customPrice: String(data.approved_price) }
                                : i
                        ));
                    }
                }
                return updated;
            });
        };

        const handleRejected = (data: {
            request_id: string; product_id: number; product_name: string;
            original_price: number; requested_price: number;
            supervisor_name: string; note: string | null;
        }) => {
            setDiscountRequests(prev => {
                const updated = { ...prev };
                for (const key of Object.keys(prev)) {
                    if (prev[key].requestId === data.request_id) {
                        updated[key] = {
                            ...prev[key],
                            status: 'rejected',
                            supervisorName: data.supervisor_name,
                            note: data.note ?? undefined,
                        };
                    }
                }
                return updated;
            });
        };

        socket.on('discount_approved', handleApproved);
        socket.on('discount_rejected', handleRejected);

        return () => {
            socket.off('discount_approved', handleApproved);
            socket.off('discount_rejected', handleRejected);
        };
    }, []);

    // ── Customer profile ────────────────────────────────────────────────────
    const fetchCustomer = useCallback(() => {
        setCustomerLoading(true);
        apiFetch(`/api/conversations/${conversationId}/customer`)
            .then(r => r.json())
            .then((cust: CustomerProfile) => setCustomer(cust))
            .catch(() => {})
            .finally(() => setCustomerLoading(false));
    }, [conversationId]);

    useEffect(() => { fetchCustomer(); }, [fetchCustomer]);
    useEffect(() => { if (view === 'cart') fetchCustomer(); }, [view]);

    // Shipping validation
    const s = customer?.shipping;
    const hasName = !!(s?.first_name?.trim());
    const hasAddress = !!(s?.address_1?.trim());
    const hasCity = !!(s?.city?.trim());
    const hasState = !!(s?.state?.trim());
    const hasPostcode = !!(s?.postcode?.trim());
    const hasContact = !!(s?.phone?.trim()) || !!(s?.email?.trim());
    const shippingValid = hasName && hasAddress && hasCity && hasState && hasPostcode && hasContact;
    const missingFields: string[] = [];
    if (!hasName) missingFields.push('Nombre');
    if (!hasAddress) missingFields.push('Dirección');
    if (!hasCity) missingFields.push('Ciudad');
    if (!hasState) missingFields.push('Estado');
    if (!hasPostcode) missingFields.push('C.P.');
    if (!hasContact) missingFields.push('Teléfono o Email');

    // ── Products ────────────────────────────────────────────────────────────
    useEffect(() => {
        apiFetch('/api/products/categories?parent=0')
            .then(r => r.json())
            .then(data => setCategories(data.categories ?? []))
            .catch(() => {});
    }, []);

    const loadProducts = useCallback(async (opts: { search?: string; category?: number; orderby?: string; per_page?: number }) => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set('per_page', String(opts.per_page ?? 12));
            if (opts.search) params.set('search', opts.search);
            if (opts.category) params.set('category', String(opts.category));
            if (opts.orderby) params.set('orderby', opts.orderby);

            const res = await apiFetch(`/api/products?${params}`);
            const data = await res.json();
            setProducts(data.products ?? []);
            if (data.warning) setError('Demo: WooCommerce no configurado');
        } catch { setProducts([]); setError('Error al cargar productos'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadProducts({ orderby: 'popularity', per_page: 10 }); }, []);

    useEffect(() => {
        if (!search.trim()) return;
        setMode('search');
        setSelectedCategory(null);
        const t = setTimeout(() => loadProducts({ search: search.trim(), per_page: 20 }), 350);
        return () => clearTimeout(t);
    }, [search]);

    const showPopular = () => {
        setSearch(''); setSelectedCategory(null); setMode('popular');
        loadProducts({ orderby: 'popularity', per_page: 10 });
    };

    const showCategory = (catId: number) => {
        setSearch(''); setSelectedCategory(catId); setMode('category');
        loadProducts({ category: catId, per_page: 20 });
    };

    // ── Cart operations ──────────────────────────────────────────────────────
    const addToCart = (product: WcProduct, variation?: WcVariation) => {
        if (product.type === 'variable' && !variation) {
            setPendingVariableProduct(product);
            return;
        }
        setCart(prev => {
            const key = variation ? `v-${variation.id}` : `p-${product.id}`;
            const existing = prev.find(i => (i.variation ? `v-${i.variation.id}` : `p-${i.product.id}`) === key);
            if (existing) return prev.map(i => ((i.variation ? `v-${i.variation.id}` : `p-${i.product.id}`) === key) ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { product, quantity: 1, variation }];
        });
    };

    const cartKey = (item: CartItem) => item.variation ? `v-${item.variation.id}` : `p-${item.product.id}`;

    const updateQty = (key: string, qty: number) => {
        if (qty < 1) { setCart(prev => prev.filter(i => cartKey(i) !== key)); return; }
        setCart(prev => prev.map(i => cartKey(i) === key ? { ...i, quantity: qty } : i));
    };

    const updatePrice = (key: string, price: string) => {
        setCart(prev => prev.map(i => cartKey(i) === key ? { ...i, customPrice: price } : i));
        // Clear a rejected request so the agent can re-escalate with new price
        setDiscountRequests(prev => {
            if (prev[key]?.status === 'rejected') {
                const updated = { ...prev };
                delete updated[key];
                return updated;
            }
            return prev;
        });
    };

    const removeItem = (key: string) => {
        setCart(prev => prev.filter(i => cartKey(i) !== key));
        setDiscountRequests(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
        });
    };

    const changeVariation = (key: string) => {
        const item = cart.find(i => cartKey(i) === key);
        if (item) setPendingVariableProduct(item.product);
    };

    // ── SalesKing discount helpers ───────────────────────────────────────────
    const maxDiscountPct: number | null =
        skRules?.available && skRules.pricing != null
            ? skRules.pricing.effective_max_discount
            : null;

    const getMinAllowedPrice = (origPrice: string): number | null => {
        if (maxDiscountPct === null) return null;
        return parseFloat(origPrice) * (1 - maxDiscountPct / 100);
    };

    const isPriceExceedingLimit = (item: CartItem): boolean => {
        if (!skRules?.available || maxDiscountPct === null) return false;
        const origPrice = item.variation?.price || item.product.price || '0';
        const effectivePrice = item.customPrice || origPrice;
        if (effectivePrice === origPrice) return false; // no change
        const min = getMinAllowedPrice(origPrice);
        if (min === null) return false;
        return parseFloat(effectivePrice) < min;
    };

    // ── Escalation ───────────────────────────────────────────────────────────
    const handleEscalate = async (item: CartItem) => {
        const key = cartKey(item);
        const origPrice = item.variation?.price || item.product.price || '0';
        const requestedPrice = item.customPrice!;

        setEscalating(key);
        setError(null);
        try {
            const res = await apiFetch('/api/salesking/discount-request', {
                method: 'POST',
                body: JSON.stringify({
                    conversation_id: conversationId,
                    product_id: item.variation?.id || item.product.id,
                    product_name: item.product.name,
                    original_price: parseFloat(origPrice),
                    requested_price: parseFloat(requestedPrice),
                }),
            });
            const data = await res.json();
            setDiscountRequests(prev => ({
                ...prev,
                [key]: { requestId: data.id, status: 'pending' },
            }));
        } catch (err: any) {
            setError(err.message || 'Error al enviar solicitud');
        } finally {
            setEscalating(null);
        }
    };

    const cartTotal = cart.reduce((sum, i) => {
        const p = i.customPrice || i.variation?.price || i.product.price || '0';
        return sum + parseFloat(p) * i.quantity;
    }, 0);

    const generateCheckoutLink = async () => {
        if (cart.length === 0 || !shippingValid || !customer) return;

        // Block if any cart item has an unresolved discount violation
        const hasBlockedItem = cart.some(item => {
            const key = cartKey(item);
            const req = discountRequests[key];
            return isPriceExceedingLimit(item) && (!req || req.status === 'rejected');
        });
        if (hasBlockedItem) {
            setError('Uno o más precios exceden tu límite de descuento. Escala la aprobación o ajusta los precios.');
            return;
        }

        setCreatingOrder(true);
        setError(null);
        try {
            const nameParts = customer.shipping?.first_name
                ? [customer.shipping.first_name, customer.shipping.last_name || '']
                : (customer.name || '').trim().split(/\s+/);
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const res = await apiFetch(`/api/conversations/${conversationId}/cart-link`, {
                method: 'POST',
                body: JSON.stringify({
                    items: cart.map(i => {
                        const origPrice = i.variation?.price || i.product.price;
                        return {
                            product_id: i.product.id,
                            variation_id: i.variation?.id || undefined,
                            quantity: i.quantity,
                            name: i.product.name,
                            price: origPrice,
                            variation_label: i.variation ? i.variation.attributes.map(a => a.option).join(' / ') : undefined,
                            custom_price: i.customPrice && i.customPrice !== origPrice ? i.customPrice : undefined,
                            original_price: i.customPrice && i.customPrice !== origPrice ? origPrice : undefined,
                        };
                    }),
                    billing: {
                        first_name: firstName,
                        last_name: lastName,
                        email: customer.shipping?.email || customer.email || undefined,
                        phone: customer.shipping?.phone || customer.phone || undefined,
                        address_1: customer.shipping?.address_1 || customer.address || undefined,
                        address_2: customer.shipping?.address_2 || undefined,
                        city: customer.shipping?.city || undefined,
                        state: customer.shipping?.state || undefined,
                        postcode: customer.shipping?.postcode || undefined,
                        country: customer.shipping?.country || 'MX',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al crear pedido');
            if (data.payment_url) {
                onSendCartLink(`¡Hola! He preparado tu pedido. Puedes revisar los detalles y completar tu pago aquí:\n\n${data.payment_url}`);
                setCart([]);
                setDiscountRequests({});
            }
        } catch (err: any) {
            setError(err.message || 'Error al generar link');
        } finally {
            setCreatingOrder(false);
        }
    };

    const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name;

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="fixed bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 flex flex-col"
            style={{ width: 'min(560px, calc(100vw - 900px))', height: '70vh', maxHeight: '720px', minHeight: '480px', bottom: '80px', left: 'calc(528px + (100vw - 528px - 320px) / 2)', transform: 'translateX(-50%)' }}>

            {/* Variation selector overlay */}
            {pendingVariableProduct && (
                <VariationModal
                    product={pendingVariableProduct}
                    onSelect={(v) => { addToCart(pendingVariableProduct, v); setPendingVariableProduct(null); }}
                    onCancel={() => setPendingVariableProduct(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50/80 shrink-0">
                <div className="flex gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                    <button onClick={() => setView('catalog')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'catalog' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                        <ShoppingBag className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Catálogo
                    </button>
                    <button onClick={() => setView('cart')}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${view === 'cart' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600 hover:text-slate-900'}`}>
                        <ShoppingCart className="w-3.5 h-3.5 -mt-0.5" />Carrito
                        {cart.length > 0 && (
                            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">{cart.length}</span>
                        )}
                    </button>
                </div>

                {/* SalesKing discount limit badge */}
                {skRules?.available && maxDiscountPct !== null && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <ShieldCheck className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="text-[10px] text-indigo-700 font-semibold">Límite: {maxDiscountPct}% dto.</span>
                    </div>
                )}

                <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {error && (
                <div className="mx-3 mt-2 px-3 py-1.5 text-xs flex items-center gap-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-lg shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>{error}</span>
                </div>
            )}

            {/* ═══════════ CATALOG VIEW ═══════════ */}
            {view === 'catalog' && (
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Search bar */}
                    <div className="px-3 pt-3 pb-2 shrink-0">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por nombre o SKU..."
                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg text-sm outline-none transition-all" />
                            {search && (
                                <button onClick={showPopular} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded">
                                    <X className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category chips */}
                    <div className="px-3 pb-2 shrink-0">
                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                            <button onClick={showPopular}
                                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                                    ${mode === 'popular' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                <TrendingUp className="w-3 h-3" />Top ventas
                            </button>
                            {categories.map(cat => (
                                <button key={cat.id} onClick={() => showCategory(cat.id)}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                                        ${selectedCategory === cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                    <Tag className="w-3 h-3" />{cat.name}
                                    <span className="text-[10px] opacity-70">({cat.count})</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section title */}
                    <div className="px-3 pb-1 shrink-0">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                            {mode === 'popular' && 'Más vendidos'}
                            {mode === 'search' && `Resultados para "${search}"`}
                            {mode === 'category' && selectedCategoryName}
                            {!loading && ` · ${products.length} productos`}
                        </p>
                    </div>

                    {/* Product grid */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3">
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                                <p className="text-sm">No se encontraron productos</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {products.map(p => {
                                    const inCart = cart.some(i => i.product.id === p.id);
                                    const isVariable = p.type === 'variable';
                                    return (
                                        <div key={p.id} className={`group relative flex flex-col bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md
                                            ${inCart ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-1 px-2.5 pt-2">
                                                {isVariable && (
                                                    <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                        <Layers className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />Variable
                                                    </span>
                                                )}
                                                {inCart && (
                                                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                                        <Check className="w-2.5 h-2.5" /> En carrito
                                                    </span>
                                                )}
                                                {p.sale_price && p.sale_price !== p.regular_price && (
                                                    <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                        OFERTA
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-2.5 flex-1 flex flex-col">
                                                <h4 className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2 flex-1">{p.name}</h4>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <div>
                                                        {isVariable ? (
                                                            <span className="text-xs font-bold text-slate-700">Desde ${p.price}</span>
                                                        ) : p.sale_price && p.sale_price !== p.regular_price ? (
                                                            <><span className="text-[10px] line-through text-slate-400">${p.regular_price}</span>
                                                            <span className="text-xs font-bold text-red-600 ml-1">${p.sale_price}</span></>
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-700">${p.price}</span>
                                                        )}
                                                        {p.sku && <span className="text-[9px] text-slate-400 ml-1.5">{p.sku}</span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {p.permalink && p.permalink !== '#' && (
                                                            <a href={p.permalink} target="_blank" rel="noreferrer"
                                                                className="p-1 text-slate-300 hover:text-indigo-600 transition-colors" title="Ver en tienda">
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                        <button onClick={() => addToCart(p)}
                                                            className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all border border-indigo-200"
                                                            title={isVariable ? 'Seleccionar variación' : 'Agregar al carrito'}>
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Floating cart indicator */}
                    {cart.length > 0 && view === 'catalog' && (
                        <div className="shrink-0 px-3 pb-3">
                            <button onClick={() => setView('cart')}
                                className="w-full flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors shadow-lg">
                                <span className="flex items-center gap-2 text-sm font-medium">
                                    <ShoppingCart className="w-4 h-4" />
                                    Ver carrito ({cart.length} {cart.length === 1 ? 'producto' : 'productos'})
                                    {!shippingValid && <AlertCircle className="w-3.5 h-3.5 text-amber-300" />}
                                </span>
                                <span className="text-sm font-bold">${cartTotal.toFixed(2)}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ CART VIEW ═══════════ */}
            {view === 'cart' && (
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {cart.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                                <p className="text-sm font-medium text-slate-500">El carrito está vacío</p>
                                <p className="text-xs text-slate-400 mt-1">Agrega productos desde el catálogo</p>
                                <button onClick={() => setView('catalog')}
                                    className="mt-4 text-xs font-semibold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors">
                                    Ver Catálogo
                                </button>
                            </div>
                        ) : cart.map(item => {
                            const key = cartKey(item);
                            const origPrice = item.variation?.price || item.product.price || '0';
                            const effectivePrice = item.customPrice || origPrice;
                            const varLabel = item.variation ? item.variation.attributes.map(a => a.option).join(' / ') : null;
                            const isVariable = item.product.type === 'variable';
                            const exceedsLimit = isPriceExceedingLimit(item);
                            const minAllowed = getMinAllowedPrice(origPrice);
                            const discReq = discountRequests[key];

                            return (
                                <div key={key} className={`relative flex gap-3 p-3 border rounded-xl group transition-all
                                    ${exceedsLimit && !discReq ? 'bg-red-50 border-red-200' :
                                      discReq?.status === 'pending' ? 'bg-amber-50 border-amber-200' :
                                      discReq?.status === 'approved' ? 'bg-green-50 border-green-200' :
                                      discReq?.status === 'rejected' ? 'bg-red-50 border-red-200' :
                                      'bg-slate-50 border-slate-200'}`}>
                                    <button onClick={() => removeItem(key)}
                                        className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10">
                                        <X className="w-3 h-3" />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-semibold text-slate-800 truncate">{item.product.name}</h4>
                                        {varLabel ? (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="text-[10px] text-purple-600 font-medium bg-purple-50 px-1.5 py-0.5 rounded">{varLabel}</span>
                                                {isVariable && (
                                                    <button onClick={() => changeVariation(key)}
                                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 underline">
                                                        cambiar
                                                    </button>
                                                )}
                                            </div>
                                        ) : isVariable ? (
                                            <button onClick={() => changeVariation(key)}
                                                className="text-[10px] text-amber-600 font-medium mt-0.5">
                                                ⚠ Sin variación — seleccionar
                                            </button>
                                        ) : null}

                                        <div className="flex items-center gap-2 mt-2">
                                            {/* Quantity */}
                                            <div className="flex items-center bg-white border border-slate-200 rounded-lg">
                                                <button onClick={() => updateQty(key, item.quantity - 1)}
                                                    className="px-2 py-1 text-slate-500 hover:text-slate-800">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="text-xs font-semibold w-5 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQty(key, item.quantity + 1)}
                                                    className="px-2 py-1 text-slate-500 hover:text-slate-800">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>

                                            {/* Price input */}
                                            <div className="flex items-center gap-1 flex-1">
                                                <span className="text-[10px] text-slate-400">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={effectivePrice}
                                                    onChange={e => updatePrice(key, e.target.value)}
                                                    disabled={discReq?.status === 'pending'}
                                                    className={`w-full text-right border focus:ring-1 rounded-lg py-1 pl-2 pr-2 text-sm font-bold outline-none transition-all
                                                        ${discReq?.status === 'pending'
                                                            ? 'bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed'
                                                            : exceedsLimit
                                                            ? 'bg-white border-red-400 focus:border-red-500 focus:ring-red-200 text-red-600'
                                                            : 'bg-white border-indigo-200 focus:border-indigo-500 focus:ring-indigo-200 text-indigo-700'}`}
                                                />
                                            </div>

                                            {/* Subtotal */}
                                            <span className="text-xs font-bold text-slate-800 w-16 text-right shrink-0">
                                                ${(parseFloat(effectivePrice) * item.quantity).toFixed(2)}
                                            </span>
                                        </div>

                                        {/* Discount info line */}
                                        {item.customPrice && item.customPrice !== origPrice && !exceedsLimit && !discReq && (
                                            <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                                                <ShieldCheck className="w-3 h-3" />
                                                ${origPrice} → ${item.customPrice} ({((1 - parseFloat(item.customPrice) / parseFloat(origPrice)) * 100).toFixed(1)}% dto.) — dentro de tu límite
                                            </p>
                                        )}

                                        {/* Exceeds limit — escalation needed */}
                                        {exceedsLimit && !discReq && (
                                            <div className="mt-1.5 space-y-1">
                                                <p className="text-[10px] text-red-600 flex items-center gap-1">
                                                    <ShieldAlert className="w-3 h-3" />
                                                    Excede tu límite ({maxDiscountPct}% dto. máx — mín ${minAllowed?.toFixed(2)})
                                                </p>
                                                <button
                                                    onClick={() => handleEscalate(item)}
                                                    disabled={escalating === key}
                                                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold rounded-lg transition-colors disabled:opacity-60">
                                                    {escalating === key
                                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</>
                                                        : <><ArrowUpCircle className="w-3 h-3" /> Escalar a supervisor</>}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pending escalation */}
                                        {discReq?.status === 'pending' && (
                                            <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Esperando aprobación del supervisor...
                                            </p>
                                        )}

                                        {/* Approved */}
                                        {discReq?.status === 'approved' && (
                                            <div className="mt-1 space-y-0.5">
                                                <p className="text-[10px] text-green-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Aprobado por {discReq.supervisorName} — ${discReq.approvedPrice?.toFixed(2)}
                                                </p>
                                                {discReq.note && (
                                                    <p className="text-[10px] text-green-600 italic">"{discReq.note}"</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Rejected */}
                                        {discReq?.status === 'rejected' && (
                                            <div className="mt-1 space-y-0.5">
                                                <p className="text-[10px] text-red-700 flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    Rechazado por {discReq.supervisorName}
                                                </p>
                                                {discReq.note && (
                                                    <p className="text-[10px] text-red-600 italic">"{discReq.note}"</p>
                                                )}
                                                <p className="text-[10px] text-slate-500">Ajusta el precio para re-escalar.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Cart footer */}
                    {cart.length > 0 && (
                        <div className="border-t bg-slate-50 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            {/* Shipping validation */}
                            {!shippingValid && (
                                <div className="mx-3 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-amber-800">Datos de envío incompletos</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {missingFields.map(f => (
                                                    <span key={f} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-medium">
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-amber-600 mt-1.5">
                                                Completa los datos en el panel del cliente (derecha) →
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {shippingValid && (
                                <div className="mx-3 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                                    <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    <p className="text-xs text-green-700 font-medium">Datos de envío completos</p>
                                </div>
                            )}

                            {/* Pending escalations warning */}
                            {cart.some(item => {
                                const req = discountRequests[cartKey(item)];
                                return isPriceExceedingLimit(item) && req?.status === 'pending';
                            }) && (
                                <div className="mx-3 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <p className="text-xs text-amber-700">Hay precios pendientes de aprobación. El link se generará cuando se aprueben.</p>
                                </div>
                            )}

                            {/* Total + Generate button */}
                            <div className="px-4 pb-4 pt-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-600 font-medium">Total del pedido</span>
                                    <span className="text-xl font-bold text-slate-900">${cartTotal.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={generateCheckoutLink}
                                    disabled={creatingOrder || !shippingValid || cart.some(item => {
                                        const req = discountRequests[cartKey(item)];
                                        return isPriceExceedingLimit(item) && req?.status === 'pending';
                                    })}
                                    className={`w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-colors shadow-sm
                                        ${shippingValid && !creatingOrder && !cart.some(item => discountRequests[cartKey(item)]?.status === 'pending' && isPriceExceedingLimit(item))
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                                    {creatingOrder ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Generando link...</>
                                    ) : (
                                        <><Send className="w-4 h-4" />Generar link de pago</>
                                    )}
                                </button>
                                <p className="text-center text-[10px] text-slate-400 mt-1.5">
                                    {shippingValid ? 'Se enviará el link al chat' : 'Completa el perfil del cliente para continuar'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
