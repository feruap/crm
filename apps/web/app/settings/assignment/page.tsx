"use client";
import React from 'react';

export default function AssignmentRulesPage() {
    return (
        <div className="p-6">
            <h3 className="text-xl font-bold mb-4">Reglas de Asignación</h3>
            <p className="text-slate-500">
                Configura cómo se asignan las conversaciones a los agentes.
                Próximamente: round-robin, carga balanceada, por especialidad.
            </p>
        </div>
    );
}
