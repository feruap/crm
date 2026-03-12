"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Code2, Layout, Palette, MessageSquare, Save, Copy, Check,
    Smartphone, Laptop, MoveVertical, Plus, Trash2, Loader2,
    Instagram, Facebook, History, AlertCircle, Link2, Settings
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.011 20.914c-1.554 0-3.047-.406-4.352-1.175l-4.529 1.487 1.514-4.412a8.878 8.878 0 01-1.28-4.636c0-4.909 3.991-8.9 8.9-8.9s8.9 3.991 8.9 8.9-3.991 8.902-8.9 8.902V20.914zM12.011 4.542c-3.955 0-7.165 3.21-7.165 7.165 0 1.54.494 3.033 1.424 4.281L5.341 18.2l3.35-.889a7.125 7.125 0 003.32.825c3.955 0 7.165-3.21 7.165-7.165s-3.21-7.172-7.165-7.172z" />
    </svg>
);

// TikTok icon
const TikTokIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.17a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.6a8.24 8.24 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.03z" />
    </svg>
);

interface AvailableChannel {
    id: string;
    name: string;
    provider: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'webchat';
    subtype: string | null;
    url: string;
    ready: boolean;
}

interface SelectedChannel {
    channel_id: string;
    provider: string;
    label: string;
    url: string;
    enabled: boolean;
}

const PROVIDER_STYLE: Record<string, { color: string; hoverBorder: string; hoverBg: string; hoverText: string; bgBubble: string }> = {
    whatsapp: { color: 'bg-green-500', hoverBorder: 'hover:border-green-500', hoverBg: 'hover:bg-green-50', hoverText: 'hover:text-green-700', bgBubble: 'bg-green-500' },
    facebook: { color: 'bg-blue-600', hoverBorder: 'hover:border-blue-500', hoverBg: 'hover:bg-blue-50', hoverText: 'hover:text-blue-700', bgBubble: 'bg-blue-600' },
    instagram: { color: 'bg-pink-500', hoverBorder: 'hover:border-pink-500', hoverBg: 'hover:bg-pink-50', hoverText: 'hover:text-pink-700', bgBubble: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600' },
    tiktok: { color: 'bg-slate-900', hoverBorder: 'hover:border-slate-700', hoverBg: 'hover:bg-slate-50', hoverText: 'hover:text-slate-800', bgBubble: 'bg-slate-900' },
    webchat: { color: 'bg-indigo-500', hoverBorder: 'hover:border-indigo-500', hoverBg: 'hover:bg-indigo-50', hoverText: 'hover:text-indigo-700', bgBubble: 'bg-indigo-500' },
};

const PROVIDER_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    facebook: 'Messenger',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    webchat: 'Web Chat',
};

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
    switch (provider) {
        case 'whatsapp': return <WhatsAppIcon />;
        case 'facebook': return <Facebook className={className || "w-5 h-5"} />;
        case 'instagram': return <Instagram className={className || "w-5 h-5"} />;
        case 'tiktok': return <TikTokIcon />;
        default: return <MessageSquare className={className || "w-5 h-5"} />;
    }
}

export default function WidgetBuilderPage() {
    const [config, setConfig] = useState({
        name: 'Mi Widget Principal',
        bg_color: '#3b82f6',
        text_color: '#ffffff',
        welcome_text: '¿Cómo podemos ayudarte hoy?',
        position: 'right',
        is_active: true,
        channels: [] as SelectedChannel[]
    });
    const [availableChannels, setAvailableChannels] = useState<AvailableChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [embedCode, setEmbedCode] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [configRes, codeRes, channelsRes] = await Promise.all([
                    apiFetch('/api/widget-config'),
                    apiFetch('/api/widget-config/embed-code'),
                    apiFetch('/api/channels/widget-available'),
                ]);
                const configData = await configRes.json();
                const codeData = await codeRes.json();
                const channelsData = await channelsRes.json();

                if (configData.id) setConfig(configData);
                setEmbedCode(codeData.code || '');
                setAvailableChannels(channelsData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiFetch('/api/widget-config', {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            const codeRes = await apiFetch('/api/widget-config/embed-code');
            const codeData = await codeRes.json();
            setEmbedCode(codeData.code || '');
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const isChannelSelected = (channelId: string) => {
        return config.channels.some(c => c.channel_id === channelId);
    };

    const toggleChannel = (available: AvailableChannel) => {
        if (isChannelSelected(available.id)) {
            setConfig({
                ...config,
                channels: config.channels.filter(c => c.channel_id !== available.id)
            });
        } else {
            setConfig({
                ...config,
                channels: [...config.channels, {
                    channel_id: available.id,
                    provider: available.provider,
                    label: available.name || PROVIDER_LABELS[available.provider] || available.provider,
                    url: available.url,
                    enabled: true,
                }]
            });
        }
    };

    const updateChannelLabel = (channelId: string, label: string) => {
        setConfig({
            ...config,
            channels: config.channels.map(c =>
                c.channel_id === channelId ? { ...c, label } : c
            )
        });
    };

    const copyCode = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(embedCode);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = embedCode;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            const textArea = document.createElement('textarea');
            textArea.value = embedCode;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (e) {
                alert('No se pudo copiar. Por favor selecciona el código manualmente.');
            }
            document.body.removeChild(textArea);
        }
    };

    const selectedForPreview = config.channels.filter(c => c.enabled);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 bg-slate-50 min-h-full">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Code2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">LeadClick Widget</h1>
                        <p className="text-slate-500 text-sm mt-0.5 font-medium italic">Captura prospectos desde cualquier sitio web</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar Configuración
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Editor */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Step 1: Channels */}
                    <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <MessageSquare className="w-5 h-5 text-indigo-500" />
                                <h2 className="font-black text-lg text-slate-800">1. Canales de Contacto</h2>
                            </div>
                            <a href="/settings" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors font-bold">
                                <Settings className="w-3.5 h-3.5" />
                                Administrar canales
                            </a>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                            </div>
                        ) : availableChannels.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                                <p className="text-sm font-bold">No hay canales conectados</p>
                                <p className="text-xs mt-1">Configura tus canales en <a href="/settings" className="text-indigo-500 underline">Settings</a> primero.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-slate-400 font-medium">Selecciona los canales que deseas mostrar en tu widget:</p>
                                <div className="space-y-3">
                                    {availableChannels.map((ch) => {
                                        const selected = isChannelSelected(ch.id);
                                        const style = PROVIDER_STYLE[ch.provider] || PROVIDER_STYLE.webchat;
                                        const selectedData = config.channels.find(c => c.channel_id === ch.id);

                                        return (
                                            <div
                                                key={ch.id}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                                    selected
                                                        ? 'border-indigo-400 bg-indigo-50/50 shadow-sm'
                                                        : 'border-slate-100 bg-white hover:border-slate-200'
                                                }`}
                                                onClick={() => toggleChannel(ch)}
                                            >
                                                {/* Toggle checkbox */}
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                    selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                                                }`}>
                                                    {selected && <Check className="w-4 h-4 text-white" />}
                                                </div>

                                                {/* Provider icon */}
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${style.bgBubble}`}>
                                                    <ProviderIcon provider={ch.provider} className="w-5 h-5" />
                                                </div>

                                                {/* Name + URL */}
                                                <div className="flex-1 min-w-0">
                                                    {selected ? (
                                                        <input
                                                            value={selectedData?.label || ''}
                                                            onChange={e => {
                                                                e.stopPropagation();
                                                                updateChannelLabel(ch.id, e.target.value);
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 p-0 block w-full"
                                                            placeholder="Etiqueta del boton"
                                                        />
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-600">{ch.name}</span>
                                                    )}
                                                    {ch.url ? (
                                                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">{ch.url}</span>
                                                    ) : ch.provider === 'webchat' ? (
                                                        <span className="text-[10px] text-indigo-400 font-medium block mt-0.5">Chat embebido en tu sitio</span>
                                                    ) : !ch.ready ? (
                                                        <span className="text-[10px] text-amber-500 font-medium block mt-0.5 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3 inline" /> Falta configurar URL en Settings
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {/* Status badge */}
                                                {ch.ready ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-1 rounded-lg">Listo</span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Pendiente</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Step 2: Styling */}
                    <div className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Palette className="w-5 h-5 text-indigo-500" />
                            <h2 className="font-black text-lg text-slate-800">2. Personalización Visual</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Color de Fondo</label>
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={config.bg_color} onChange={e => setConfig({ ...config, bg_color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-none p-0 overflow-hidden" />
                                        <input value={config.bg_color} onChange={e => setConfig({ ...config, bg_color: e.target.value })} className="flex-1 border rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Color de Texto</label>
                                    <div className="flex items-center gap-3">
                                        <input type="color" value={config.text_color} onChange={e => setConfig({ ...config, text_color: e.target.value })} className="w-12 h-12 rounded-xl cursor-pointer border-none p-0 overflow-hidden" />
                                        <input value={config.text_color} onChange={e => setConfig({ ...config, text_color: e.target.value })} className="flex-1 border rounded-xl px-4 py-2 text-sm font-mono font-bold text-slate-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Mensaje de Bienvenida</label>
                                    <textarea
                                        value={config.welcome_text}
                                        onChange={e => setConfig({ ...config, welcome_text: e.target.value })}
                                        rows={2}
                                        className="w-full border rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Posición</label>
                                    <div className="flex bg-slate-50 p-1 rounded-xl">
                                        <button onClick={() => setConfig({ ...config, position: 'left' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${config.position === 'left' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Izquierda</button>
                                        <button onClick={() => setConfig({ ...config, position: 'right' })} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${config.position === 'right' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Derecha</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: Embed Code */}
                    <div className="bg-slate-900 rounded-3xl p-8 space-y-6 border-4 border-indigo-500/30">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Code2 className="w-5 h-5 text-indigo-400" />
                                <h2 className="font-black text-lg text-white">Instalación en tu Web</h2>
                            </div>
                            <button onClick={copyCode} className="flex items-center gap-2 text-indigo-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copiado' : 'Copiar Código'}
                            </button>
                        </div>
                        <div className="bg-black/50 rounded-2xl p-6 overflow-x-auto">
                            <pre className="text-indigo-300 font-mono text-xs leading-relaxed">
                                {embedCode}
                            </pre>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                            <History className="w-4 h-4" />
                            <p className="text-[10px] font-bold uppercase tracking-widest tracking-tighter">Versión del código: {(config as any).embed_code_version || 1}</p>
                        </div>
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="lg:col-span-4 sticky top-8">
                    <div className="bg-white rounded-[3rem] border-8 border-slate-800 shadow-2xl h-[650px] relative overflow-hidden flex flex-col">
                        <div className="h-6 bg-slate-800 w-32 mx-auto rounded-b-2xl mb-4"></div>

                        <div className="flex-1 p-6 space-y-4">
                            <div className="h-4 bg-slate-100 rounded-full w-3/4"></div>
                            <div className="h-4 bg-slate-100 rounded-full w-1/2"></div>
                            <div className="mt-12 space-y-3">
                                <div className="h-32 bg-slate-50 rounded-3xl border border-dashed border-slate-200"></div>
                                <div className="h-24 bg-slate-50 rounded-3xl border border-dashed border-slate-200"></div>
                            </div>
                        </div>

                        {/* The Widget Preview */}
                        <div className={`absolute bottom-8 ${config.position === 'right' ? 'right-8' : 'left-8'} flex flex-col items-end gap-3`}>
                            {/* Welcome bubble */}
                            <div className="bg-white shadow-xl rounded-2xl p-4 text-xs font-bold text-slate-700 border border-slate-100 max-w-[200px] animate-in slide-in-from-bottom-2">
                                {config.welcome_text}
                            </div>
                            {/* Channel icons */}
                            <div className="flex flex-col gap-2">
                                {selectedForPreview.map((chan, idx) => {
                                    const style = PROVIDER_STYLE[chan.provider] || PROVIDER_STYLE.webchat;
                                    return (
                                        <div key={idx} className="bg-white shadow-lg rounded-full px-4 py-2.5 flex items-center gap-3 border border-slate-100 animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                                            <span className="text-[10px] font-black text-slate-800 whitespace-nowrap">{chan.label}</span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bgBubble} text-white`}>
                                                <ProviderIcon provider={chan.provider} className="w-4 h-4" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Main Button */}
                            <div
                                className="w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                                style={{ backgroundColor: config.bg_color, color: config.text_color }}
                            >
                                <MessageSquare className="w-7 h-7" />
                            </div>
                        </div>

                        <div className="p-4 border-t bg-slate-50 flex items-center justify-center">
                            <div className="flex gap-4">
                                <Smartphone className="w-5 h-5 text-indigo-600" />
                                <Laptop className="w-5 h-5 text-slate-300" />
                            </div>
                        </div>
                    </div>
                    <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-6">Vista previa del simulador</p>
                </div>
            </div>
        </div>
    );
}
