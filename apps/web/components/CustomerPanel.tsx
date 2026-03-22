"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    User, ShoppingCart, MessageSquare, Bot, Phone, MapPin,
    Mail, Package, TrendingUp, AlertCircle, ChevronRight,
    Check, Megaphone, Clock, Star, Loader2, ExternalLink,
    Calendar, FileText
} = Lucide as any;

import { apiFetch } from '../hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Order {
    id: string;
    external_order_id: string;
    total_amount: number;
    currency: string;
    status: string;
    order_date: string;
    items: { name: string; qty: number; price: number }[];
}

interface PastConversation {
    id: string;
    date: string;
    agent_name: string;
    last_message: string;
    status: string;
}

interface AISuggestion {
    type: 'offer' | 'alert' | 'reorder';
    text: string;
}

interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    customer_since: string;
    total_spent: number;
    orders: Order[];
    past_conversations: PastConversation[];
    campaign: { name: string; platform: string } | null;
    ai_suggestions: AISuggestion[];
    sentiment: 'positive' | 'neutral' | 'negative';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLATFORM_STYLE: Record<string, { label: string; bg: string; text: string }> = {
    facebook: { label: 'Facebook', bg: 'bg-blue-100', text: 'text-blue-700' },
    instagram: { label: 'Instagram', bg: 'bg-pink-100', text: 'text-pink-700' },
    tiktok: { label: 'TikTok', bg: 'bg-slate-900', text: 'text-white' },
    google: { label: 'Google', bg: 'bg-red-100', text: 'text-red-700' },
};

const SENTIMENT_STYLE: Record<string, string> = {
    positive: 'bg-green-100 text-green-700',
    neutral: 'bg-slate-100 text-slate-600',
    negative: 'bg-red-100 text-red-600',
};

const SENTIMENT_LABEL: Record<string, string> = {
    positive: '😊 Positivo',
    neutral: '😐 Neutral',
    negative: '😟 Negativo',
};

const SUGGESTION_ICON: Record<string, React.ReactNode> = {
    offer: <Star className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />,
    alert: <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />,
    reorder: <Package className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />,
};

const ORDER_STATUS_STYLE: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    processing: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
};

// ── Order Builder ─────────────────────────────────────────────────────────────

interface WcProduct {
    id: number;
    name: string;
    price: string;
    sku: string;
    stock: string;
    type?: string;              // 'simple' | 'variable' | 'grouped' | 'external'
    variations?: number[];      // variation IDs for variable products
}

interface WcVariation {
    id: number;
    price: string;
    regular_price: string;
    sale_price: string;
    sku: string;
    stock_status: string;
    attributes: { name: string; option: string }[];
    image: string | null;
}

interface CartItem {
    product: WcProduct;
    quantity: number;
    variation?: WcVariation;    // selected variation (for variable products)
    customPrice?: string;       // agent-edited price (discount)
}

interface SalesKingPricing {
    available: boolean;
    effective_max_discount: number;  // percentage 0-100
    agent_max_discount: number | null;
    can_increase_price: boolean;
    can_decrease_price: boolean;
    discount_from_commission: boolean;
    group_name?: string;
    group_max_discount?: number;
}

// ── Variation Picker Sub-Component ───────────────────────────────────────────
function VariationPicker({ product, onSelect, onCancel }: {
    product: WcProduct;
    onSelect: (variation: WcVariation) => void;
    onCancel: () => void;
}) {
    const [variations, setVariations] = useState<WcVariation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        apiFetch(`/api/products/${product.id}/variations`)
            .then(r => r.json())
            .then(data => setVariations(data.variations ?? []))
            .catch(() => setVariations([]))
            .finally(() => setLoading(false));
    }, [product.id]);

    if (loading) {
        return (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Cargando variaciones de {product.name}...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-blue-200 flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">Selecciona variación — {product.name}</p>
                <button onClick={onCancel} className="text-xs text-blue-500 hover:text-blue-700">✕</button>
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-blue-100">
                {variations.length === 0 ? (
                    <p className="text-xs text-slate-500 p-3">No se encontraron variaciones</p>
                ) : variations.map(v => {
                    const attrLabel = v.attributes.map(a => a.option).join(' / ');
                    return (
                        <button
                            key={v.id}
                            onClick={() => onSelect(v)}
                            disabled={v.stock_status === 'outofstock'}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2
                                ${v.stock_status === 'outofstock' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-100'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-700">{attrLabel || `#${v.id}`}</span>
                                {v.sku && <span className="text-slate-400 ml-1.5">({v.sku})</span>}
                                {v.stock_status === 'outofstock' && <span className="text-red-500 ml-1.5">Agotado</span>}
                            </div>
                            <div className="shrink-0 text-right">
                                {v.sale_price && v.sale_price !== v.regular_price ? (
                                    <><span className="line-through text-slate-400 mr-1">${v.regular_price}</span><span className="text-red-600 font-bold">${v.sale_price}</span></>
                                ) : (
                                    <span className="text-slate-700 font-bold">${v.price}</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Address Form Sub-Component ───────────────────────────────────────────────
function AddressForm({ billing, onChange }: {
    billing: Record<string, string>;
    onChange: (field: string, value: string) => void;
}) {
    const [expanded, setExpanded] = useState(!!billing.address_1);

    return (
        <div className="border rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-3 py-2 bg-slate-50 flex items-center justify-between text-xs"
            >
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    Dirección de envío
                    {billing.address_1 && <Check className="w-3 h-3 text-green-500" />}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {expanded && (
                <div className="p-3 space-y-2 bg-white">
                    <div className="grid grid-cols-2 gap-2">
                        <input value={billing.first_name || ''} onChange={e => onChange('first_name', e.target.value)}
                            placeholder="Nombre" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                        <input value={billing.last_name || ''} onChange={e => onChange('last_name', e.target.value)}
                            placeholder="Apellido" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    </div>
                    <input value={billing.address_1 || ''} onChange={e => onChange('address_1', e.target.value)}
                        placeholder="Dirección (calle y número)" className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <input value={billing.address_2 || ''} onChange={e => onChange('address_2', e.target.value)}
                        placeholder="Colonia / Interior (opcional)" className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <div className="grid grid-cols-2 gap-2">
                        <input value={billing.city || ''} onChange={e => onChange('city', e.target.value)}
                            placeholder="Ciudad" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                        <input value={billing.state || ''} onChange={e => onChange('state', e.target.value)}
                            placeholder="Estado" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input value={billing.postcode || ''} onChange={e => onChange('postcode', e.target.value)}
                            placeholder="C.P." className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                        <input value={billing.country || 'MX'} onChange={e => onChange('country', e.target.value)}
                            placeholder="País (MX)" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input value={billing.email || ''} onChange={e => onChange('email', e.target.value)}
                            placeholder="Email" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                        <input value={billing.phone || ''} onChange={e => onChange('phone', e.target.value)}
                            placeholder="Teléfono" className="text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    </div>
                    {!billing.address_1 && (
                        <p className="text-[10px] text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Sin dirección no se calculan costos de envío
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function OrderBuilder({ customer, conversationId }: { customer: Customer; conversationId: string }) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<WcProduct[]>([]);
    const [searching, setSearching] = useState(false);
    const [items, setItems] = useState<CartItem[]>([]);
    const [agentCode, setAgentCode] = useState<string | null>(null);
    const [wcAgentId, setWcAgentId] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [cartUrl, setCartUrl] = useState<string | null>(null);
    const [pendingVariableProduct, setPendingVariableProduct] = useState<WcProduct | null>(null);
    const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // SalesKing pricing rules — fetched in real-time from bridge plugin
    const [skPricing, setSkPricing] = useState<SalesKingPricing | null>(null);

    // Billing/shipping address state — pre-fill from customer data
    const [billing, setBilling] = useState<Record<string, string>>({
        first_name: customer.name?.split(' ')[0] || '',
        last_name: customer.name?.split(' ').slice(1).join(' ') || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address_1: customer.address || '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: 'MX',
    });

    const updateBilling = (field: string, value: string) => {
        setBilling(prev => ({ ...prev, [field]: value }));
    };

    // Load agent's SalesKing code, WP User ID, and pricing rules
    useEffect(() => {
        apiFetch('/api/auth/me')
            .then(r => r.json())
            .then(a => {
                setAgentCode(a.salesking_agent_code ?? null);
                setWcAgentId(a.wc_agent_id ?? null);
            })
            .catch(() => { });

        // Fetch SalesKing pricing rules in real-time
        apiFetch('/api/products/salesking-pricing')
            .then(r => r.json())
            .then(data => {
                if (data.available) {
                    setSkPricing({
                        available: true,
                        effective_max_discount: data.pricing?.effective_max_discount ?? 1,
                        agent_max_discount: data.pricing?.agent_max_discount ?? null,
                        can_increase_price: data.pricing?.can_increase_price ?? false,
                        can_decrease_price: data.pricing?.can_decrease_price ?? true,
                        discount_from_commission: data.pricing?.discount_from_commission ?? false,
                        group_name: data.group?.name ?? '',
                        group_max_discount: data.group?.max_discount ?? 0,
                    });
                } else {
                    setSkPricing(null);
                }
            })
            .catch(() => setSkPricing(null));
    }, []);

    // Debounced product search
    useEffect(() => {
        if (!search.trim()) { setResults([]); return; }
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const r = await apiFetch(`/api/products?search=${encodeURIComponent(search)}&per_page=12`);
                const data = await r.json();
                setResults(data.products ?? []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 350);
    }, [search]);

    const addItem = (p: WcProduct) => {
        // If it's a variable product, show variation picker instead of adding directly
        if (p.type === 'variable' && p.variations && p.variations.length > 0) {
            setPendingVariableProduct(p);
            setSearch('');
            setResults([]);
            return;
        }
        setItems(prev => {
            const existing = prev.find(i => i.product.id === p.id && !i.variation);
            if (existing) return prev.map(i => i.product.id === p.id && !i.variation ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { product: p, quantity: 1 }];
        });
        setSearch('');
        setResults([]);
    };

    const addVariation = (variation: WcVariation) => {
        if (!pendingVariableProduct) return;
        const product = pendingVariableProduct;
        setPendingVariableProduct(null);
        setItems(prev => {
            const existing = prev.find(i => i.variation?.id === variation.id);
            if (existing) return prev.map(i => i.variation?.id === variation.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { product, quantity: 1, variation }];
        });
    };

    const itemKey = (item: CartItem) => item.variation ? `v-${item.variation.id}` : `p-${item.product.id}`;

    const updateQty = (key: string, qty: number) => {
        if (qty < 1) { setItems(prev => prev.filter(i => itemKey(i) !== key)); return; }
        setItems(prev => prev.map(i => itemKey(i) === key ? { ...i, quantity: qty } : i));
    };

    // Compute min price allowed for a given original price based on SalesKing discount rules
    const getMinPrice = (originalPrice: number): number => {
        if (!skPricing || !skPricing.can_decrease_price) return originalPrice;
        const discount = skPricing.effective_max_discount; // e.g. 10 means 10%
        return originalPrice * (100 - discount) / 100;
    };

    // Update custom price for a cart item (with validation)
    const updateCustomPrice = (key: string, newPrice: string) => {
        setItems(prev => prev.map(i => {
            if (itemKey(i) !== key) return i;
            return { ...i, customPrice: newPrice };
        }));
    };

    const sendLink = async () => {
        if (items.length === 0) return;
        setSending(true);
        setCartUrl(null);
        try {
            // Get campaign_id from customer if available
            const campaignId = (customer.campaign as any)?.id || undefined;

            const r = await apiFetch(`/api/conversations/${conversationId}/cart-link`, {
                method: 'POST',
                body: JSON.stringify({
                    items: items.map(i => {
                        const originalPrice = i.variation?.price || i.product.price;
                        return {
                            product_id: i.product.id,
                            variation_id: i.variation?.id || undefined,
                            quantity: i.quantity,
                            name: i.product.name,
                            price: originalPrice,
                            variation_label: i.variation ? i.variation.attributes.map(a => a.option).join(' / ') : undefined,
                            custom_price: i.customPrice && i.customPrice !== originalPrice ? i.customPrice : undefined,
                            original_price: i.customPrice && i.customPrice !== originalPrice ? originalPrice : undefined,
                        };
                    }),
                    billing: billing.address_1 ? billing : undefined,
                    campaign_id: campaignId,
                }),
            });
            const data = await r.json();
            setCartUrl(data.payment_url || data.cart_url);
            setItems([]);
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const total = items.reduce((s, i) => {
        const price = i.customPrice || i.variation?.price || i.product.price || '0';
        return s + parseFloat(price) * i.quantity;
    }, 0);

    return (
        <div className="space-y-3">
            {/* Agent SalesKing / WP link indicator */}
            <div className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-lg ${wcAgentId ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                <Check className={`w-3 h-3 ${wcAgentId ? 'text-green-500' : 'hidden'}`} />
                <AlertCircle className={`w-3 h-3 ${wcAgentId ? 'hidden' : 'text-amber-500'}`} />
                {wcAgentId
                    ? <>SalesKing vinculado — WP User #{wcAgentId}{agentCode ? <>, afiliado: <strong>{agentCode}</strong></> : ''}</>
                    : <>Sin WordPress User ID — <a href="/settings" className="underline font-medium">configúralo en tu perfil</a> para ganar comisión</>
                }
            </div>

            {/* SalesKing pricing rules indicator */}
            {skPricing && (
                <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1.5 rounded-lg space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium">
                        <TrendingUp className="w-3 h-3 text-purple-500" />
                        Descuento máximo: {skPricing.effective_max_discount}%
                        {skPricing.group_name && <span className="text-purple-400 font-normal">({skPricing.group_name})</span>}
                    </div>
                    <div className="text-purple-500 text-[10px]">
                        {skPricing.can_decrease_price ? 'Puedes bajar precios' : 'No puedes bajar precios'}
                        {' · '}
                        {skPricing.can_increase_price ? 'Puedes subir precios' : 'No puedes subir precios'}
                        {skPricing.discount_from_commission && ' · Descuento sale de comisión'}
                    </div>
                </div>
            )}

            {/* Product search */}
            <div className="relative">
                <label className="text-xs text-slate-500 mb-1 block">Buscar producto WooCommerce</label>
                <div className="relative">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Nombre del producto..."
                        className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 absolute right-2.5 top-2" />}
                </div>
                {results.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-0.5 max-h-52 overflow-y-auto">
                        {results.map(p => (
                            <button
                                key={p.id}
                                onClick={() => addItem(p)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2 border-b last:border-0"
                            >
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium text-slate-700 truncate block">{p.name}</span>
                                    <span className="text-slate-400 text-[10px]">
                                        {p.sku && <>{p.sku} · </>}
                                        {p.type === 'variable' ? <span className="text-purple-500 font-medium">Variable</span> : p.stock === 'instock' ? 'En stock' : <span className="text-red-500">Agotado</span>}
                                    </span>
                                </div>
                                <span className="text-slate-600 font-bold shrink-0">
                                    {p.type === 'variable' ? `Desde $${p.price}` : `$${p.price}`}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Variation picker for variable products */}
            {pendingVariableProduct && (
                <VariationPicker
                    product={pendingVariableProduct}
                    onSelect={addVariation}
                    onCancel={() => setPendingVariableProduct(null)}
                />
            )}

            {/* Selected items */}
            {items.length > 0 && (
                <div className="border rounded-lg divide-y overflow-hidden">
                    {items.map(item => {
                        const key = itemKey(item);
                        const originalPrice = item.variation?.price || item.product.price || '0';
                        const effectivePrice = item.customPrice || originalPrice;
                        const varLabel = item.variation ? item.variation.attributes.map(a => a.option).join(' / ') : null;
                        const origNum = parseFloat(originalPrice);
                        const minPrice = getMinPrice(origNum);
                        const maxPrice = skPricing?.can_increase_price ? origNum * 2 : origNum;
                        const canEditPrice = skPricing && (skPricing.can_decrease_price || skPricing.can_increase_price);
                        const currentNum = parseFloat(effectivePrice);
                        const discountPct = origNum > 0 ? ((origNum - currentNum) / origNum * 100) : 0;
                        const priceInvalid = currentNum < minPrice || currentNum > maxPrice;

                        return (
                            <div key={key} className="px-3 py-2 bg-white">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{item.product.name}</p>
                                        {varLabel && <p className="text-[10px] text-purple-600">{varLabel}</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => updateQty(key, item.quantity - 1)}
                                            className="w-5 h-5 rounded bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 flex items-center justify-center">−</button>
                                        <span className="text-xs w-5 text-center font-medium">{item.quantity}</span>
                                        <button onClick={() => updateQty(key, item.quantity + 1)}
                                            className="w-5 h-5 rounded bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 flex items-center justify-center">+</button>
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 w-14 text-right shrink-0">
                                        ${(parseFloat(effectivePrice) * item.quantity).toFixed(0)}
                                    </span>
                                </div>
                                {/* Price editing row */}
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    {canEditPrice ? (
                                        <>
                                            <span className="text-[10px] text-slate-400">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min={minPrice.toFixed(2)}
                                                max={maxPrice.toFixed(2)}
                                                value={effectivePrice}
                                                onChange={e => updateCustomPrice(key, e.target.value)}
                                                onBlur={() => {
                                                    // Clamp on blur
                                                    const val = parseFloat(effectivePrice);
                                                    if (isNaN(val) || val < minPrice) updateCustomPrice(key, minPrice.toFixed(2));
                                                    else if (val > maxPrice) updateCustomPrice(key, maxPrice.toFixed(2));
                                                }}
                                                className={`w-20 text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 ${priceInvalid ? 'border-red-300 focus:ring-red-300 bg-red-50' : 'focus:ring-blue-300'}`}
                                            />
                                            <span className="text-[10px] text-slate-400">orig: ${originalPrice}</span>
                                            {discountPct > 0.5 && (
                                                <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${priceInvalid ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    -{discountPct.toFixed(1)}%
                                                </span>
                                            )}
                                            {discountPct < -0.5 && (
                                                <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-blue-100 text-blue-600">
                                                    +{Math.abs(discountPct).toFixed(1)}%
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400">${originalPrice} c/u</span>
                                    )}
                                </div>
                                {priceInvalid && canEditPrice && (
                                    <p className="text-[10px] text-red-500 mt-0.5">
                                        Precio debe estar entre ${minPrice.toFixed(2)} y ${maxPrice.toFixed(2)}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                    <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-500">Total estimado</span>
                        <span className="text-sm font-bold text-slate-800">${total.toFixed(0)}</span>
                    </div>
                </div>
            )}

            {/* Address form — shown when items in cart */}
            {items.length > 0 && (
                <AddressForm billing={billing} onChange={updateBilling} />
            )}

            {/* Send button */}
            <button
                onClick={sendLink}
                disabled={items.length === 0 || sending || items.some(i => {
                    if (!i.customPrice) return false;
                    const orig = parseFloat(i.variation?.price || i.product.price || '0');
                    const cur = parseFloat(i.customPrice);
                    return isNaN(cur) || cur < getMinPrice(orig) || cur > (skPricing?.can_increase_price ? orig * 2 : orig);
                })}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                    ${items.length > 0 && !sending
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
            >
                {sending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando link...</>
                    : <><ShoppingCart className="w-4 h-4" /> Enviar link de compra</>
                }
            </button>

            {/* Success — show generated link */}
            {cartUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-green-700 flex items-center gap-1 mb-1">
                        <Check className="w-3.5 h-3.5" /> Link enviado al chat
                    </p>
                    <p className="text-xs text-green-600 break-all">{cartUrl}</p>
                    <p className="text-xs text-green-500 mt-1">
                        El cliente completa el checkout en WooCommerce → SalesKing calcula tu comisión ✓
                    </p>
                </div>
            )}

            {/* Repeat last order shortcut */}
            {customer.orders.length > 0 && (
                <div className="border-t pt-3">
                    <p className="text-xs text-slate-500 mb-2">Repetir pedido anterior</p>
                    {customer.orders.slice(0, 2).map(o => (
                        <button
                            key={o.id}
                            className="w-full text-left text-xs bg-slate-50 border rounded-lg px-3 py-2 mb-1.5 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                            <span className="font-medium">#{o.external_order_id}</span>
                            <span className="text-slate-500"> · {Array.isArray(o.items) ? o.items.map((i: any) => i.name).join(', ') : '—'}</span>
                            <span className="text-blue-600 float-right">Repetir →</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'perfil' | 'agenda' | 'notas' | 'compras' | 'historial';

export default function CustomerPanel({ conversationId }: { conversationId: string }) {
    // conversationId is passed down to OrderBuilder so it can POST the cart-link message
    const [tab, setTab] = useState<Tab>('perfil');
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);

    const [events, setEvents] = useState<any[]>([]);
    const [knowledge, setKnowledge] = useState('');
    const [savingKnowledge, setSavingKnowledge] = useState(false);

    useEffect(() => {
        setLoading(true);
        setCustomer(null);

        const loadAll = async () => {
            try {
                // Customer profile
                const res = await apiFetch(`/api/conversations/${conversationId}/customer`);
                const cust = await res.json();
                setCustomer(cust);

                // Events
                const resEvents = await apiFetch(`/api/events?customer_id=${cust.id}`);
                setEvents(await resEvents.json());

                // Knowledge/Notes (using customer_attributes)
                const resMeta = await apiFetch(`/api/customers/${cust.id}/attributes/knowledge`);
                const meta = await resMeta.json();
                setKnowledge(meta.value || '');

            } catch (err) { console.error(err); } finally { setLoading(false); }
        };

        loadAll();
    }, [conversationId]);

    const saveKnowledge = async () => {
        if (!customer) return;
        setSavingKnowledge(true);
        try {
            await apiFetch(`/api/customers/${customer.id}/attributes/knowledge`, {
                method: 'PUT',
                body: JSON.stringify({ value: knowledge }),
            });
        } catch (err) { console.error(err); } finally { setSavingKnowledge(false); }
    };

    const toggleEvent = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'scheduled' : 'completed';
        try {
            const res = await apiFetch(`/api/events/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });
            const updated = await res.json();
            setEvents(prev => prev.map(e => e.id === id ? updated : e));
        } catch (err) { console.error(err); }
    };

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'perfil', label: 'Perfil', icon: <User className="w-3.5 h-3.5" /> },
        { key: 'agenda', label: 'Agenda', icon: <Calendar className="w-3.5 h-3.5" /> },
        { key: 'notas', label: 'Notas', icon: <Lucide.FileText className="w-3.5 h-3.5" /> as any },
        { key: 'compras', label: 'Compras', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
        { key: 'historial', label: 'Historial', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    ];

    if (loading) {
        return (
            <div className="w-80 shrink-0 border-l bg-white flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="w-80 shrink-0 border-l bg-white flex items-center justify-center h-full text-slate-400 text-sm">
                No se pudo cargar el cliente
            </div>
        );
    }

    const platform = customer.campaign ? PLATFORM_STYLE[customer.campaign.platform] : null;

    return (
        <div className="w-80 shrink-0 border-l bg-white flex flex-col h-full overflow-hidden">

            {/* Header */}
            <div className="px-4 py-4 border-b bg-slate-50">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {customer.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{customer.name}</p>
                        <p className="text-xs text-slate-500">Cliente desde {customer.customer_since}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${SENTIMENT_STYLE[customer.sentiment ?? 'neutral']}`}>
                        {SENTIMENT_LABEL[customer.sentiment ?? 'neutral']}
                    </span>
                </div>

                {/* Campaign attribution */}
                {customer.campaign ? (
                    <div className="bg-white border rounded-lg px-3 py-2 flex items-start gap-2 mb-3">
                        <Megaphone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500">Viene de campaña</p>
                            <p className="text-xs font-semibold text-slate-700 truncate">{customer.campaign.name}</p>
                            {platform && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${platform.bg} ${platform.text}`}>
                                    {platform.label}
                                </span>
                            )}
                        </div>
                    </div>
                ) : customer.phone ? (
                    // WhatsApp customer with no campaign attribution — show WC lookup indicator
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
                        <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-amber-700 font-medium">WhatsApp orgánico</p>
                            <p className="text-xs text-amber-600 truncate">Historial por teléfono {customer.phone}</p>
                        </div>
                    </div>
                ) : null}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-slate-500">Total gastado</p>
                        <p className="text-sm font-bold text-slate-800">${Number(customer.total_spent).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-slate-500">Órdenes</p>
                        <p className="text-sm font-bold text-slate-800">{customer.orders.length}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b bg-white">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors border-b-2
                            ${tab === t.key
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">

                {/* PERFIL */}
                {tab === 'perfil' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {[
                                { icon: <Phone className="w-3.5 h-3.5 text-slate-400" />, label: 'Teléfono', value: customer.phone },
                                { icon: <Mail className="w-3.5 h-3.5 text-slate-400" />, label: 'Email', value: customer.email },
                                { icon: <MapPin className="w-3.5 h-3.5 text-slate-400" />, label: 'Dirección', value: customer.address },
                            ].map(({ icon, label, value }) => (
                                <div key={label} className="flex items-start gap-2 text-sm">
                                    <span className="mt-0.5">{icon}</span>
                                    <div>
                                        <p className="text-xs text-slate-400">{label}</p>
                                        {value
                                            ? <p className="text-slate-700">{value}</p>
                                            : <p className="text-slate-300 italic text-xs">Sin datos</p>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t pt-4">
                            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Enviar Pedido</p>
                            <OrderBuilder customer={customer} conversationId={conversationId} />
                        </div>
                    </div>
                )}

                {/* COMPRAS */}
                {tab === 'compras' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                Historial WooCommerce
                                {customer.phone && !customer.campaign && (
                                    <span className="ml-1 text-amber-500 normal-case font-normal">(por teléfono)</span>
                                )}
                            </p>
                            {process.env.NEXT_PUBLIC_WC_URL && (
                                <a
                                    href={`${process.env.NEXT_PUBLIC_WC_URL}/wp-admin/edit.php?post_type=shop_order`}
                                    target="_blank" rel="noreferrer"
                                    className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline"
                                >
                                    Ver en WC <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>

                        {customer.orders.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p className="text-xs">Sin órdenes registradas</p>
                                {customer.phone && (
                                    <p className="text-xs mt-1 text-amber-500">
                                        Teléfono: {customer.phone}
                                    </p>
                                )}
                            </div>
                        ) : (
                            customer.orders.map(order => (
                                <div key={order.id} className="bg-slate-50 border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-slate-700">#{order.external_order_id}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_STYLE[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="space-y-0.5 mb-2">
                                        {Array.isArray(order.items)
                                            ? order.items.map((item: any, i: number) => (
                                                <p key={i} className="text-xs text-slate-500">
                                                    {item.qty}x {item.name} — ${item.price}
                                                </p>
                                            ))
                                            : <p className="text-xs text-slate-400 italic">Sin detalle de productos</p>
                                        }
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {order.order_date ? new Date(order.order_date).toLocaleDateString('es') : '—'}
                                        </span>
                                        <span className="text-sm font-bold text-slate-800">${Number(order.total_amount).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* AGENDA */}
                {tab === 'agenda' && (
                    <div className="space-y-3">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Próximos Eventos</p>
                        {events.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs">No hay eventos agendados</p>
                            </div>
                        ) : (
                            events.map(e => (
                                <div key={e.id} className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${e.status === 'completed' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-blue-100 shadow-sm'}`}>
                                    <button
                                        onClick={() => toggleEvent(e.id, e.status)}
                                        className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${e.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}
                                    >
                                        {e.status === 'completed' && <Check className="w-3 h-3" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold ${e.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{e.title}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Clock className="w-3 h-3" />
                                            {new Date(e.start_at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {e.notes && <p className="text-xs text-slate-400 mt-2 italic">"{e.notes}"</p>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* NOTAS (KNOWLEDGE) */}
                {tab === 'notas' && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Conocimiento sobre el cliente</p>
                            <p className="text-[10px] text-slate-400 mb-3 leading-tight italic">
                                Estas notas son procesadas por la IA para dar un servicio personalizado en futuras conversaciones.
                            </p>
                            <textarea
                                value={knowledge}
                                onChange={e => setKnowledge(e.target.value)}
                                rows={10}
                                placeholder="Escribe aquí datos clave: preferencias, talla, alergias, mejores horarios para llamar..."
                                className="w-full border rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-300 outline-none resize-none bg-slate-50 min-h-[250px]"
                            />
                        </div>
                        <button
                            disabled={savingKnowledge}
                            onClick={saveKnowledge}
                            className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                            {savingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Memoria'}
                        </button>
                    </div>
                )}

                {/* TRENDING REMOVED AS IT WAS PART OF IA TAB */}
            </div>
        </div>
    );
}
