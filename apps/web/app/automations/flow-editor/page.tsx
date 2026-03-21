'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import * as Lucide from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-crm.botonmedico.com';
const {
    Save, ArrowLeft, Loader2, Play, Trash2, Plus, GripVertical,
    MessageSquare, ListOrdered, GitBranch, Users, Bot, Zap,
    Clock, ChevronDown, X
} = Lucide as any;

// ── Types ────────────────────────────────────────────────────────────────────

interface FlowNode {
    id: string;
    type: 'trigger' | 'send_message' | 'menu_buttons' | 'conditional' | 'transfer_to_group' | 'ai_response' | 'wait_response';
    x: number;
    y: number;
    data: any;
}

interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string; // for menu button branches
}

interface AgentGroup {
    id: string;
    name: string;
    strategy: string;
    members: { id: string; name: string }[];
}

interface Channel {
    id: string;
    name: string;
    provider: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_TYPES = [
    { type: 'send_message', label: 'Enviar Mensaje', icon: MessageSquare, color: '#3b82f6', desc: 'Envía un mensaje de texto al cliente' },
    { type: 'menu_buttons', label: 'Menú / Botones', icon: ListOrdered, color: '#8b5cf6', desc: 'Muestra opciones con botones interactivos' },
    { type: 'conditional', label: 'Condición', icon: GitBranch, color: '#f59e0b', desc: 'Evalúa una condición y bifurca el flujo' },
    { type: 'transfer_to_group', label: 'Transferir a Agentes', icon: Users, color: '#10b981', desc: 'Asigna la conversación a un grupo de agentes' },
    { type: 'ai_response', label: 'Respuesta IA', icon: Bot, color: '#6366f1', desc: 'Genera respuesta con RAG + LLM' },
    { type: 'wait_response', label: 'Esperar Respuesta', icon: Clock, color: '#64748b', desc: 'Pausa hasta que el cliente responda' },
];

const NODE_W = 280;
const NODE_MIN_H = 80;

function genId() {
    return 'n_' + Math.random().toString(36).slice(2, 10);
}

// ── SVG Edge Drawing ─────────────────────────────────────────────────────────

function EdgeSVG({ edge, nodes }: { edge: FlowEdge; nodes: FlowNode[] }) {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return null;

    const x1 = src.x + NODE_W / 2;
    const y1 = src.y + 100; // bottom of source
    const x2 = tgt.x + NODE_W / 2;
    const y2 = tgt.y; // top of target

    const midY = (y1 + y2) / 2;

    return (
        <path
            d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
        />
    );
}

// ── Main FlowEditor Component ────────────────────────────────────────────────

export default function FlowEditorPage() {
    const { authFetch } = useAuth();
    const [flowId, setFlowId] = useState<string | null>(null);
    const [flowName, setFlowName] = useState('Nuevo Flujo Visual');
    const [isActive, setIsActive] = useState(true);
    const [nodes, setNodes] = useState<FlowNode[]>([
        { id: 'trigger_1', type: 'trigger', x: 300, y: 50, data: { trigger_type: 'first_message', channel_id: null, trigger_config: {} } }
    ]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [groups, setGroups] = useState<AgentGroup[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    // Drag state
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Connection state
    const [connecting, setConnecting] = useState<string | null>(null); // source node id

    const canvasRef = useRef<HTMLDivElement>(null);

    // ── Load flow if ?id= in URL ─────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        Promise.all([
            authFetch(`${API_URL}/api/agent-groups`).then(r => r.json()),
            authFetch(`${API_URL}/api/channels`).then(r => r.json()),
        ]).then(([g, c]) => {
            setGroups(g || []);
            setChannels(c || []);
        });

        if (id) {
            setFlowId(id);
            setLoading(true);
            authFetch(`${API_URL}/api/flows/${id}`)
                .then(r => r.json())
                .then(flow => {
                    setFlowName(flow.name);
                    setIsActive(flow.is_active);
                    if (flow.nodes && flow.nodes.length > 0) {
                        setNodes(flow.nodes);
                        setEdges(flow.edges || []);
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [authFetch]);

    // ── Drag handling ────────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragging(nodeId);
        setDragOffset({
            x: e.clientX - rect.left - node.x,
            y: e.clientY - rect.top - node.y
        });
    }, [nodes]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragging) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const newX = Math.max(0, e.clientX - rect.left - dragOffset.x);
        const newY = Math.max(0, e.clientY - rect.top - dragOffset.y);
        setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: newX, y: newY } : n));
    }, [dragging, dragOffset]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    // ── Add node from palette ────────────────────────────────────────────────
    const addNode = (type: string) => {
        const defaults: Record<string, any> = {
            send_message: { message: '' },
            menu_buttons: { message: '', buttons: [{ id: genId(), text: 'Opción 1' }, { id: genId(), text: 'Opción 2' }] },
            conditional: { condition: '' },
            transfer_to_group: { group_id: '' },
            ai_response: { custom_prompt: '' },
            wait_response: { timeout_seconds: 300 },
        };
        const newNode: FlowNode = {
            id: genId(),
            type: type as any,
            x: 300 + Math.random() * 100,
            y: 200 + nodes.length * 140,
            data: defaults[type] || {},
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNode(newNode.id);
    };

    // ── Delete node ──────────────────────────────────────────────────────────
    const deleteNode = (nodeId: string) => {
        if (nodeId.startsWith('trigger')) return; // can't delete trigger
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
        if (selectedNode === nodeId) setSelectedNode(null);
    };

    // ── Connect nodes ────────────────────────────────────────────────────────
    const startConnection = (sourceId: string, handle?: string) => {
        setConnecting(sourceId);
    };

    const completeConnection = (targetId: string) => {
        if (!connecting || connecting === targetId) {
            setConnecting(null);
            return;
        }
        // Don't create duplicate edges
        const exists = edges.find(e => e.source === connecting && e.target === targetId);
        if (!exists) {
            setEdges(prev => [...prev, { id: genId(), source: connecting, target: targetId }]);
        }
        setConnecting(null);
    };

    // ── Delete edge ──────────────────────────────────────────────────────────
    const deleteEdge = (edgeId: string) => {
        setEdges(prev => prev.filter(e => e.id !== edgeId));
    };

    // ── Update node data ─────────────────────────────────────────────────────
    const updateNodeData = (nodeId: string, data: any) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    };

    // ── Save flow ────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const triggerNode = nodes.find(n => n.type === 'trigger');
            const payload = {
                name: flowName,
                is_active: isActive,
                flow_type: 'visual',
                trigger_type: triggerNode?.data?.trigger_type || 'first_message',
                trigger_config: triggerNode?.data?.trigger_config || {},
                channel_providers: triggerNode?.data?.channel_id
                    ? [channels.find(c => c.id === triggerNode.data.channel_id)?.provider].filter(Boolean)
                    : null,
                nodes: nodes,
                edges: edges,
                steps: [], // Visual flows use nodes/edges
            };

            if (flowId) {
                await authFetch(`${API_URL}/api/flows/${flowId}`, { method: 'PATCH', body: JSON.stringify(payload) });
            } else {
                const res = await authFetch(`${API_URL}/api/flows`, { method: 'POST', body: JSON.stringify(payload) });
                const created = await res.json();
                setFlowId(created.id);
                window.history.replaceState({}, '', `?id=${created.id}`);
            }
            alert('Flujo guardado correctamente');
        } catch (e: any) {
            alert('Error al guardar: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const selected = nodes.find(n => n.id === selectedNode);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-slate-100">
            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-4 shrink-0 shadow-sm z-20">
                <a href="/automations" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </a>
                <div className="h-6 w-px bg-slate-200" />
                <input
                    value={flowName}
                    onChange={e => setFlowName(e.target.value)}
                    className="text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 w-64"
                    placeholder="Nombre del flujo..."
                />
                <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                    <span className={isActive ? 'text-green-600 font-bold' : 'text-slate-400'}>
                        {isActive ? 'Activo' : 'Inactivo'}
                    </span>
                </label>
                <div className="flex-1" />
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* ── Node Palette (left) ─────────────────────────────── */}
                <div className="w-56 bg-white border-r border-slate-200 p-4 overflow-y-auto shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Agregar Nodo</p>
                    <div className="space-y-2">
                        {NODE_TYPES.map(nt => {
                            const Icon = nt.icon;
                            return (
                                <button
                                    key={nt.type}
                                    onClick={() => addNode(nt.type)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: nt.color + '20' }}>
                                        <Icon className="w-4 h-4" style={{ color: nt.color }} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{nt.label}</p>
                                        <p className="text-[10px] text-slate-400 leading-tight">{nt.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {connecting && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-bold text-blue-700">Modo Conexión</p>
                            <p className="text-[10px] text-blue-600">Haz click en el nodo destino</p>
                            <button onClick={() => setConnecting(null)} className="text-[10px] text-blue-500 underline mt-1">Cancelar</button>
                        </div>
                    )}
                </div>

                {/* ── Canvas ──────────────────────────────────────────── */}
                <div
                    ref={canvasRef}
                    className="flex-1 relative overflow-auto"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onClick={() => { if (!connecting) setSelectedNode(null); }}
                    style={{ cursor: dragging ? 'grabbing' : connecting ? 'crosshair' : 'default' }}
                >
                    {/* SVG layer for edges */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 2000, minHeight: 1500 }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {edges.map(edge => (
                            <EdgeSVG key={edge.id} edge={edge} nodes={nodes} />
                        ))}
                    </svg>

                    {/* Dot grid background */}
                    <div
                        className="absolute inset-0"
                        style={{
                            minWidth: 2000, minHeight: 1500,
                            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                        }}
                    />

                    {/* Nodes */}
                    {nodes.map(node => {
                        const nodeType = node.type === 'trigger'
                            ? { label: 'Trigger / Entrada', icon: Zap, color: '#ef4444' }
                            : NODE_TYPES.find(t => t.type === node.type) || { label: node.type, icon: Zap, color: '#666' };
                        const Icon = nodeType.icon;
                        const isSelected = selectedNode === node.id;

                        return (
                            <div
                                key={node.id}
                                className={`absolute rounded-xl shadow-md border-2 transition-shadow ${isSelected ? 'border-blue-500 shadow-blue-100' : 'border-slate-200'}`}
                                style={{
                                    left: node.x, top: node.y, width: NODE_W,
                                    background: 'white', zIndex: dragging === node.id ? 50 : 10,
                                    cursor: dragging === node.id ? 'grabbing' : 'grab',
                                }}
                                onClick={e => {
                                    e.stopPropagation();
                                    if (connecting) {
                                        completeConnection(node.id);
                                    } else {
                                        setSelectedNode(node.id);
                                    }
                                }}
                            >
                                {/* Header */}
                                <div
                                    className="flex items-center gap-2 px-3 py-2 rounded-t-xl"
                                    style={{ background: nodeType.color + '15' }}
                                    onMouseDown={e => handleMouseDown(e, node.id)}
                                >
                                    <GripVertical className="w-3 h-3 text-slate-400 cursor-grab" />
                                    <Icon className="w-4 h-4" style={{ color: nodeType.color }} />
                                    <span className="text-xs font-bold text-slate-700 flex-1">{nodeType.label}</span>
                                    {node.type !== 'trigger' && (
                                        <button onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                                            className="text-slate-400 hover:text-red-500 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Body preview */}
                                <div className="px-3 py-2 text-[11px] text-slate-500">
                                    <NodePreview node={node} channels={channels} groups={groups} />
                                </div>

                                {/* Connection handle (bottom) */}
                                <div className="flex justify-center pb-2">
                                    <button
                                        onClick={e => { e.stopPropagation(); startConnection(node.id); }}
                                        className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50 transition-colors"
                                        title="Conectar a otro nodo"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Properties Panel (right) ────────────────────────── */}
                {selected && (
                    <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto shrink-0">
                        <div className="p-4 border-b border-slate-100">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Propiedades del Nodo</p>
                            <p className="text-sm font-bold text-slate-800">
                                {selected.type === 'trigger' ? 'Trigger / Entrada' : NODE_TYPES.find(t => t.type === selected.type)?.label}
                            </p>
                        </div>

                        <div className="p-4">
                            <NodeProperties
                                node={selected}
                                channels={channels}
                                groups={groups}
                                onChange={(data) => updateNodeData(selected.id, data)}
                            />
                        </div>

                        {/* Connections section */}
                        <div className="p-4 border-t border-slate-100">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Conexiones</p>
                            {edges.filter(e => e.source === selected.id).map(e => {
                                const target = nodes.find(n => n.id === e.target);
                                return (
                                    <div key={e.id} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-1">
                                        <span>→ {target ? (NODE_TYPES.find(t => t.type === target.type)?.label || target.type) : 'Desconocido'}</span>
                                        <button onClick={() => deleteEdge(e.id)} className="text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                            {edges.filter(e => e.source === selected.id).length === 0 && (
                                <p className="text-[10px] text-slate-400">Sin conexiones de salida. Usa el punto inferior del nodo para conectar.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Node Preview (shown inside the node on canvas) ───────────────────────────

function NodePreview({ node, channels, groups }: { node: FlowNode; channels: Channel[]; groups: AgentGroup[] }) {
    switch (node.type) {
        case 'trigger': {
            const ch = channels.find(c => c.id === node.data.channel_id);
            const labels: Record<string, string> = {
                first_message: 'Primer mensaje',
                keyword: 'Palabra clave',
                campaign: 'Campaña',
                after_hours: 'Fuera de horario',
            };
            return (
                <span>
                    {labels[node.data.trigger_type] || node.data.trigger_type}
                    {ch ? ` · ${ch.name}` : ' · Todos los canales'}
                </span>
            );
        }
        case 'send_message':
            return <span className="line-clamp-2">{node.data.message || '(sin mensaje)'}</span>;
        case 'menu_buttons':
            return (
                <div>
                    <span className="line-clamp-1">{node.data.message || '(sin texto)'}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {(node.data.buttons || []).map((b: any) => (
                            <span key={b.id} className="bg-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded">{b.text}</span>
                        ))}
                    </div>
                </div>
            );
        case 'conditional':
            return <span>{node.data.condition || '(sin condición)'}</span>;
        case 'transfer_to_group': {
            const g = groups.find(gr => gr.id === node.data.group_id);
            return <span>{g ? g.name : '(sin grupo)'}</span>;
        }
        case 'ai_response':
            return <span>{node.data.custom_prompt ? 'Prompt personalizado' : 'RAG + IA (default)'}</span>;
        case 'wait_response':
            return <span>Esperar {node.data.timeout_seconds || 300}s</span>;
        default:
            return <span>{node.type}</span>;
    }
}

// ── Node Properties (shown in right panel) ───────────────────────────────────

function NodeProperties({
    node, channels, groups, onChange
}: {
    node: FlowNode;
    channels: Channel[];
    groups: AgentGroup[];
    onChange: (data: any) => void;
}) {
    const inputStyle = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300';
    const labelStyle = 'block text-xs font-bold text-slate-600 mb-1';

    switch (node.type) {
        case 'trigger':
            return (
                <div className="space-y-4">
                    <div>
                        <label className={labelStyle}>Tipo de Trigger</label>
                        <select
                            value={node.data.trigger_type || 'first_message'}
                            onChange={e => onChange({ trigger_type: e.target.value })}
                            className={inputStyle}
                        >
                            <option value="first_message">Primer Mensaje (sin campaña)</option>
                            <option value="keyword">Palabra Clave</option>
                            <option value="campaign">Campaña Específica</option>
                            <option value="after_hours">Fuera de Horario</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>Canal</label>
                        <select
                            value={node.data.channel_id || ''}
                            onChange={e => onChange({ channel_id: e.target.value || null })}
                            className={inputStyle}
                        >
                            <option value="">Todos los canales</option>
                            {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
                        </select>
                    </div>
                    {node.data.trigger_type === 'keyword' && (
                        <div>
                            <label className={labelStyle}>Palabras clave (separadas por coma)</label>
                            <input
                                value={(node.data.trigger_config?.keywords || []).join(', ')}
                                onChange={e => onChange({
                                    trigger_config: {
                                        ...node.data.trigger_config,
                                        keywords: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
                                        match: 'any'
                                    }
                                })}
                                className={inputStyle}
                                placeholder="hola, precio, cotización..."
                            />
                        </div>
                    )}
                </div>
            );

        case 'send_message':
            return (
                <div>
                    <label className={labelStyle}>Mensaje a enviar</label>
                    <textarea
                        value={node.data.message || ''}
                        onChange={e => onChange({ message: e.target.value })}
                        className={inputStyle}
                        rows={4}
                        placeholder="Escribe el mensaje que recibirá el cliente..."
                    />
                </div>
            );

        case 'menu_buttons':
            return (
                <div className="space-y-4">
                    <div>
                        <label className={labelStyle}>Texto del menú</label>
                        <textarea
                            value={node.data.message || ''}
                            onChange={e => onChange({ message: e.target.value })}
                            className={inputStyle}
                            rows={2}
                            placeholder="¿En qué te puedo ayudar?"
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>Botones</label>
                        <div className="space-y-2">
                            {(node.data.buttons || []).map((btn: any, idx: number) => (
                                <div key={btn.id} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                                    <input
                                        value={btn.text}
                                        onChange={e => {
                                            const updated = [...node.data.buttons];
                                            updated[idx] = { ...btn, text: e.target.value };
                                            onChange({ buttons: updated });
                                        }}
                                        className="flex-1 text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        placeholder={`Opción ${idx + 1}`}
                                    />
                                    <button
                                        onClick={() => {
                                            const updated = node.data.buttons.filter((_: any, i: number) => i !== idx);
                                            onChange({ buttons: updated });
                                        }}
                                        className="text-red-400 hover:text-red-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => onChange({ buttons: [...(node.data.buttons || []), { id: genId(), text: '' }] })}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2 font-bold"
                        >
                            <Plus className="w-3 h-3" /> Agregar botón
                        </button>
                    </div>
                </div>
            );

        case 'conditional':
            return (
                <div>
                    <label className={labelStyle}>Condición (sobre el mensaje del cliente)</label>
                    <input
                        value={node.data.condition || ''}
                        onChange={e => onChange({ condition: e.target.value })}
                        className={inputStyle}
                        placeholder='Ej: contiene "precio" o contiene "cotización"'
                    />
                    <p className="text-[10px] text-slate-400 mt-1">El flujo continúa por la primera conexión si la condición es verdadera.</p>
                </div>
            );

        case 'transfer_to_group':
            return (
                <div>
                    <label className={labelStyle}>Grupo de Agentes</label>
                    <select
                        value={node.data.group_id || ''}
                        onChange={e => onChange({ group_id: e.target.value })}
                        className={inputStyle}
                    >
                        <option value="">Seleccionar grupo...</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name} ({g.members?.length || 0} agentes · {g.strategy})
                            </option>
                        ))}
                    </select>
                    {groups.length === 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">
                            No hay grupos. Créalos en Automatización → Enrutamiento de Agentes.
                        </p>
                    )}
                </div>
            );

        case 'ai_response':
            return (
                <div>
                    <label className={labelStyle}>Prompt personalizado (opcional)</label>
                    <textarea
                        value={node.data.custom_prompt || ''}
                        onChange={e => onChange({ custom_prompt: e.target.value })}
                        className={inputStyle}
                        rows={4}
                        placeholder="Dejar vacío para usar el prompt default del RAG + IA..."
                    />
                </div>
            );

        case 'wait_response':
            return (
                <div>
                    <label className={labelStyle}>Timeout (segundos)</label>
                    <input
                        type="number"
                        value={node.data.timeout_seconds || 300}
                        onChange={e => onChange({ timeout_seconds: parseInt(e.target.value) || 300 })}
                        className={inputStyle}
                    />
                </div>
            );

        default:
            return <p className="text-xs text-slate-400">Sin propiedades configurables.</p>;
    }
}
