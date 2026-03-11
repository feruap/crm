"use client";
import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';
const {
    Code2, Layout, Palette, MessageSquare, Save, Copy, Check,
    Smartphone, Laptop, MoveVertical, Plus, Trash2, Loader2,
    Instagram, Facebook, History
} = Lucide as any;

import { apiFetch } from '../../hooks/useAuth';

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.011 20.914c-1.554 0-3.047-.406-4.352-1.175l-4.529 1.487 1.514-4.412a8.878 8.878 0 01-1.28-4.636c0-4.909 3.991-8.9 8.9-8.9s8.9 3.991 8.9 8.9-3.991 8.902-8.9 8.902V20.914zM12.011 4.542c-3.955 0-7.165 3.21-7.165 7.165 0 1.54.494 3.033 1.424 4.281L5.341 18.2l3.35-.889a7.125 7.125 0 003.32.825c3.955 0 7.165-3.21 7.165-7.165s-3.21-7.172-7.165-7.172z" />
    </svg>
);

interface WidgetChannel {
    provider: 'whatsapp' | 'facebook' | 'instagram' | 'custom';
    label: string;
    url?: string;
}

export default function WidgetBuilderPage() {
    const [config, setConfig] = useState({
        name: 'Mi Widget Principal',
        bg_color: '#3b82f6',
        text_color: '#ffffff',
        welcome_text: '¿Cómo podemos ayudarte hoy?',
        position: 'right',
        is_active: true,
        channels: [] as WidgetChannel[]
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [embedCode, setEmbedCode] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiFetch('/api/widget-config');
                const data = await res.json();
                if (data.id) setConfig(data);

                const codeRes = await apiFetch('/api/widget-config/embed-code');
                const codeData = await codeRes.json();
                setEmbedCode(codeData.code);
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
            // Refresh code
            const codeRes = await apiFetch('/api/widget-config/embed-code');
            const codeData = await codeRes.json();
            setEmbedCode(codeData.code);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const addChannel = (provider: any) => {
        setConfig({
            ...config,
            channels: [...config.channels, { provider, label: provider === 'whatsapp' ? 'WhatsApp' : 'Chat', url: '' }]
        });
    };

    const removeChannel = (index: number) => {
        const newChannels = [...config.channels];
        newChannels.splice(index, 1);
        setConfig({ ...config, channels: newChannels });
    };

    const copyCode = () => {
        navigator.clipboard.writeText(embedCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                        <div className="flex items-center gap-3 mb-2">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            <h2 className="font-black text-lg text-slate-800">1. Canales de Contacto</h2>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <button onClick={() => addChannel('whatsapp')} className="flex items-center justify-center gap-2 p-4 border-2 border-slate-100 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all text-slate-600 hover:text-green-700 font-bold text-xs uppercase tracking-wider">
                                <WhatsAppIcon /> WhatsApp
                            </button>
                            <button onClick={() => addChannel('instagram')} className="flex items-center justify-center gap-2 p-4 border-2 border-slate-100 rounded-2xl hover:border-pink-500 hover:bg-pink-50 transition-all text-slate-600 hover:text-pink-700 font-bold text-xs uppercase tracking-wider">
                                <Instagram className="w-5 h-5" /> Instagram
                            </button>
                            <button onClick={() => addChannel('facebook')} className="flex items-center justify-center gap-2 p-4 border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-slate-600 hover:text-blue-700 font-bold text-xs uppercase tracking-wider">
                                <Facebook className="w-5 h-5" /> Messenger
                            </button>
                            <button onClick={() => addChannel('webchat')} className="flex items-center justify-center gap-2 p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700 font-bold text-xs uppercase tracking-wider">
                                <MessageSquare className="w-5 h-5" /> Web Chat
                            </button>
                        </div>

                        <div className="space-y-3">
                            {config.channels.map((chan, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/50 group">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                                        {chan.provider === 'whatsapp' ? <WhatsAppIcon /> : chan.provider === 'instagram' ? <Instagram /> : chan.provider === 'facebook' ? <Facebook /> : <MessageSquare />}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            value={chan.label}
                                            onChange={e => {
                                                const newChannels = [...config.channels];
                                                newChannels[idx].label = e.target.value;
                                                setConfig({ ...config, channels: newChannels });
                                            }}
                                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 p-0 block w-full"
                                            placeholder="Etiqueta del botón"
                                        />
                                        <input
                                            value={chan.url || ''}
                                            onChange={e => {
                                                const newChannels = [...config.channels];
                                                newChannels[idx].url = e.target.value;
                                                setConfig({ ...config, channels: newChannels });
                                            }}
                                            className="bg-transparent border-none focus:ring-0 text-[10px] text-slate-400 p-0 block w-full mt-0.5"
                                            placeholder="URL o Número (ej: 52123...)"
                                        />
                                    </div>
                                    <button onClick={() => removeChannel(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
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
                                {config.channels.map((chan, idx) => (
                                    <div key={idx} className="bg-white shadow-lg rounded-full px-4 py-2.5 flex items-center gap-3 border border-slate-100 animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                                        <span className="text-[10px] font-black text-slate-800 whitespace-nowrap">{chan.label}</span>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${chan.provider === 'whatsapp' ? 'bg-green-500' : chan.provider === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600' : chan.provider === 'facebook' ? 'bg-blue-600' : 'bg-indigo-500'} text-white`}>
                                            {chan.provider === 'whatsapp' ? <WhatsAppIcon /> : chan.provider === 'instagram' ? <Instagram className="w-4 h-4" /> : chan.provider === 'facebook' ? <Facebook className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                        </div>
                                    </div>
                                ))}
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
