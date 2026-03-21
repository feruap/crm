'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { Bot, Upload, FileText, Trash2, Plus, Save, RefreshCw } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';

interface KnowledgeChunk {
    id: string;
    source_file: string;
    chunk_index: number;
    content: string;
    created_at: string;
}

interface AISettings {
    provider: string;
    system_prompt: string;
    temperature: number;
    max_tokens: number;
}

export default function BotPage() {
    const { authFetch } = useAuth();
    const [tab, setTab] = useState<'knowledge' | 'settings'>('knowledge');

    // Knowledge base
    const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
    const [loadingChunks, setLoadingChunks] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // AI Settings
    const [settings, setSettings] = useState<AISettings>({
        provider: 'deepseek',
        system_prompt: '',
        temperature: 0.7,
        max_tokens: 1024,
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const fetchChunks = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set('search', searchQuery);
            params.set('limit', '50');
            const res = await authFetch(`${API}/api/medical-products?${params}`);
            if (res.ok) {
                const data = await res.json();
                setChunks(data.chunks || data || []);
            }
        } catch {
            // silent
        } finally {
            setLoadingChunks(false);
        }
    }, [authFetch, searchQuery]);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await authFetch(`${API}/api/settings/ai`);
            if (res.ok) {
                const data = await res.json();
                if (data) setSettings(data);
            }
        } catch {
            // silent — settings endpoint may not exist yet
        }
    }, [authFetch]);

    useEffect(() => {
        if (tab === 'knowledge') fetchChunks();
        if (tab === 'settings') fetchSettings();
    }, [tab, fetchChunks, fetchSettings]);

    const saveSettings = async () => {
        setSavingSettings(true);
        try {
            await authFetch(`${API}/api/settings/ai`, {
                method: 'PUT',
                body: JSON.stringify(settings),
            });
        } catch {
            // silent
        } finally {
            setSavingSettings(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Base de IA</h1>
                    <p className="text-sm text-slate-500 mt-1">Conocimiento y configuracion del bot medico</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
                {(['knowledge', 'settings'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        {t === 'knowledge' ? 'Base de Conocimiento' : 'Configuracion IA'}
                    </button>
                ))}
            </div>

            {tab === 'knowledge' && (
                <div>
                    <div className="mb-4 flex gap-3">
                        <input
                            type="text"
                            placeholder="Buscar en base de conocimiento..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={fetchChunks}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            <RefreshCw className="w-4 h-4" /> Buscar
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Bot className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-slate-800">Documentos indexados</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Los documentos se cargan desde la pagina de Productos Medicos. Cada PDF se procesa, se divide en fragmentos, y se generan embeddings para busqueda semantica.
                        </p>

                        {loadingChunks ? (
                            <div className="text-center text-slate-400 py-8 text-sm">Cargando...</div>
                        ) : Array.isArray(chunks) && chunks.length > 0 ? (
                            <div className="space-y-2">
                                {chunks.map((chunk: any, i: number) => (
                                    <div key={chunk.id || i} className="bg-slate-50 rounded-lg p-3 text-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium text-slate-700">{chunk.source_file || chunk.name || 'Documento'}</span>
                                        </div>
                                        <p className="text-slate-600 line-clamp-2">{chunk.content || chunk.description || ''}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 py-8">
                                <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Sin documentos indexados aun.</p>
                                <p className="text-xs mt-1">Sube PDFs desde la pagina de Productos Medicos.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'settings' && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor de IA</label>
                        <select
                            value={settings.provider}
                            onChange={e => setSettings(s => ({ ...s, provider: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="deepseek">DeepSeek</option>
                            <option value="claude">Claude (Anthropic)</option>
                            <option value="gemini">Gemini (Google)</option>
                            <option value="zai">Z.ai</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                        <textarea
                            value={settings.system_prompt}
                            onChange={e => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
                            rows={8}
                            placeholder="Instrucciones para el bot medico..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Temperature ({settings.temperature})</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={settings.temperature}
                                onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Preciso</span>
                                <span>Creativo</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Tokens</label>
                            <input
                                type="number"
                                value={settings.max_tokens}
                                onChange={e => setSettings(s => ({ ...s, max_tokens: parseInt(e.target.value) || 1024 }))}
                                min={256}
                                max={4096}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={saveSettings}
                        disabled={savingSettings}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {savingSettings ? 'Guardando...' : 'Guardar Configuracion'}
                    </button>
                </div>
            )}
        </div>
    );
}
