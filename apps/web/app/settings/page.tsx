"use client";
import React, { useState } from 'react';
import { Settings, Brain, Share2, MessageSquare, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('ai');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Settings Navigation */}
            <div className="w-64 bg-white border-r p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-8">
                    <Settings className="w-5 h-5" /> Settings
                </h2>
                <nav className="space-y-2">
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'ai' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Brain className="w-4 h-4" /> IA Config
                    </button>
                    <button
                        onClick={() => setActiveTab('social')}
                        className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'social' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <Share2 className="w-4 h-4" /> Vinculaciones
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-10 overflow-auto">
                {activeTab === 'ai' && (
                    <div className="max-w-2xl bg-white p-8 rounded-xl shadow-sm border">
                        <h3 className="text-2xl font-bold mb-6">Configuración de IA</h3>
                        <p className="text-slate-500 mb-8">Selecciona tu proveedor preferido y configura las llaves API para activar la automatización.</p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-2">Proveedor Activo</label>
                                <select className="w-full border rounded-lg p-2 bg-slate-50">
                                    <option>DeepSeek</option>
                                    <option>Z.ai (Zhipu)</option>
                                    <option>Claude (Anthropic)</option>
                                    <option>Gemini (Google)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">API Key</label>
                                <input type="password" placeholder="sk-..." className="w-full border rounded-lg p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">System Prompt (Personalidad)</label>
                                <textarea rows={4} className="w-full border rounded-lg p-2" placeholder="Eres un asistente experto en soporte al cliente..." />
                            </div>
                            <button
                                onClick={handleSave}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'social' && (
                    <div className="max-w-3xl space-y-6">
                        <h3 className="text-2xl font-bold">Vinculaciones Sociales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SocialCard
                                name="Facebook Messenger"
                                img="https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg"
                                connected={false}
                            />
                            <SocialCard
                                name="Instagram Direct"
                                img="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg"
                                connected={true}
                            />
                            <SocialCard
                                name="Meta Ads & Comments"
                                img="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg"
                                connected={false}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SocialCard({ name, img, connected }: { name: string, img: string, connected: boolean }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center justify-between">
            <div className="flex items-center gap-4">
                <img src={img} alt={name} className="w-10 h-10" />
                <div>
                    <h4 className="font-bold text-slate-800">{name}</h4>
                    <p className="text-xs text-slate-500">{connected ? 'Capturando chats y comentarios' : 'Sin vincular'}</p>
                </div>
            </div>
            <button className={`px-4 py-1.5 rounded-full text-sm font-medium ${connected ? 'bg-slate-100 text-slate-600' : 'bg-blue-600 text-white'}`}>
                {connected ? 'Configurar' : 'Conectar'}
            </button>
        </div>
    );
}
