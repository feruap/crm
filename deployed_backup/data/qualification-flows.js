"use strict";
/**
 * Qualification Flow Templates
 * Defines the sequence of questions for lead qualification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUALIFICATION_FLOWS = void 0;
exports.getFirstQualificationStep = getFirstQualificationStep;
exports.getQualificationStepById = getQualificationStepById;
exports.calculateQualificationScore = calculateQualificationScore;
exports.shouldRouteToSalesAgent = shouldRouteToSalesAgent;
exports.getRoutingRecommendation = getRoutingRecommendation;
exports.QUALIFICATION_FLOWS = {
    // Main qualification flow for new leads from campaigns
    campaign_lead: {
        steps: [
            {
                id: 'is_professional',
                question: '¿Es usted profesional de la salud? (Médico, laboratorista, farmacéutico, etc.) - Si/No',
                expected_patterns: {
                    keywords: ['sí', 'si', 'yes', 'médico', 'doctor', 'farmacéutico', 'laboratorista', 'qfb', 'enfermera'],
                },
                score_on_match: 30,
                next_step: 'professional_type',
                alternative_step: 'non_professional_type',
            },
            {
                id: 'professional_type',
                question: '¿Qué tipo de profesión médica ejerces? (Médico, Laboratorista, Farmacéutico, Enfermera, Otro)',
                expected_patterns: {
                    keywords: ['médico', 'doctor', 'laboratorista', 'qfb', 'farmacéutico', 'enfermera', 'técnico'],
                },
                score_on_match: 5,
                next_step: 'patient_volume',
            },
            {
                id: 'non_professional_type',
                question: '¿Para qué propósito necesita nuestras pruebas de diagnóstico? (personal, venta a clínicas, otro)',
                expected_patterns: {
                    keywords: ['personal', 'clínica', 'farmacia', 'laboratorio', 'venta', 'distribución'],
                },
                score_on_match: 15,
                next_step: 'patient_volume',
            },
            {
                id: 'patient_volume',
                question: '¿Qué volumen aproximado de pruebas manejaría al mes? (1-50, 51-200, 201-1000, 1000+)',
                expected_patterns: {
                    keywords: ['50', '200', '1000', 'bajo', 'medio', 'alto', 'mayoreo', 'pequeño', 'grande'],
                },
                score_on_match: 20,
                next_step: 'location',
            },
            {
                id: 'location',
                question: '¿En qué ciudad o estado se encuentra? (Para logística y soporte regional)',
                expected_patterns: {
                    keywords: ['méxico', 'cdmx', 'guadalajara', 'monterrey', 'puebla', 'veracruz', 'jalisco', 'estado'],
                },
                score_on_match: 5,
                next_step: 'complete',
            },
        ],
    },
    // Simplified flow for repeat customers
    repeat_customer: {
        steps: [
            {
                id: 'reorder_intent',
                question: '¿Está aquí para hacer un pedido nuevo o consultar disponibilidad?',
                expected_patterns: {
                    keywords: ['pedido', 'comprar', 'orden', 'disponibilidad', 'precio', 'cotización'],
                },
                score_on_match: 25,
                next_step: 'product_interest',
            },
            {
                id: 'product_interest',
                question: '¿Cuál producto específico le interesa? (Nombre o categoría)',
                expected_patterns: {
                    keywords: ['hba1c', 'embarazo', 'covid', 'influenza', 'antidoping', 'vih', 'sífilis', 'hepatitis'],
                },
                score_on_match: 10,
                next_step: 'complete',
            },
        ],
    },
    // Flow for medical inquiries
    medical_inquiry: {
        steps: [
            {
                id: 'clinical_context',
                question: '¿Cuál es el contexto clínico de tu pregunta? (paciente específico, consulta general, research)',
                expected_patterns: {
                    keywords: ['paciente', 'general', 'consulta', 'consultorio', 'investigación', 'caso clínico'],
                },
                score_on_match: 10,
                next_step: 'related_products',
            },
            {
                id: 'related_products',
                question: '¿Hay algún producto específico sobre el que te gustaría saber más?',
                expected_patterns: {
                    keywords: ['hba1c', 'embarazo', 'covid', 'influenza', 'antidoping', 'vih', 'sífilis', 'hepatitis', 'vitamina d', 'rsv'],
                },
                score_on_match: 5,
                next_step: 'complete',
            },
        ],
    },
};
/**
 * Get the first step of a qualification flow
 */
function getFirstQualificationStep(flowType) {
    const flow = exports.QUALIFICATION_FLOWS[flowType];
    if (!flow || !flow.steps)
        return null;
    return flow.steps[0];
}
/**
 * Get a specific step by ID from any flow
 */
function getQualificationStepById(flowType, stepId) {
    const flow = exports.QUALIFICATION_FLOWS[flowType];
    if (!flow || !flow.steps)
        return null;
    return flow.steps.find((s) => s.id === stepId) || null;
}
function calculateQualificationScore(answers) {
    let professional_score = 0;
    let volume_score = 0;
    let engagement_score = 0;
    // Professional score (+30 if professional)
    if (answers.is_professional === true) {
        professional_score = 30;
    }
    // Volume score (+20 for high volume)
    if (answers.patient_volume) {
        const vol = answers.patient_volume.toLowerCase();
        if (vol.includes('1000') || vol.includes('mayoreo'))
            volume_score = 20;
        else if (vol.includes('201') || vol.includes('alto'))
            volume_score = 15;
        else if (vol.includes('51') || vol.includes('medio'))
            volume_score = 10;
        else if (vol.includes('1') || vol.includes('bajo'))
            volume_score = 5;
    }
    // Engagement score (for each answer provided)
    const answeredFields = Object.values(answers).filter(v => v !== undefined && v !== null).length;
    engagement_score = Math.min(answeredFields * 5, 20); // Cap at +20
    return {
        total_score: professional_score + volume_score + engagement_score,
        professional_score,
        volume_score,
        engagement_score,
    };
}
/**
 * Determine if a lead qualifies for direct sales attention
 */
function shouldRouteToSalesAgent(score) {
    // Route to sales if:
    // - Professional + Medium/High volume (score >= 50)
    // - OR High volume alone (volume_score >= 15)
    return score.total_score >= 50 || score.volume_score >= 15;
}
/**
 * Get routing recommendation based on qualification
 */
function getRoutingRecommendation(score) {
    if (score.total_score >= 70) {
        return {
            priority: 'hot',
            recommended_agent_role: 'sales',
            next_action: 'Contacto inmediato con especialista en ventas B2B',
        };
    }
    if (score.total_score >= 50) {
        return {
            priority: 'warm',
            recommended_agent_role: 'sales',
            next_action: 'Seguimiento en 24h con cotización personalizada',
        };
    }
    return {
        priority: 'cold',
        recommended_agent_role: 'support',
        next_action: 'Nurturing con contenido educativo médico',
    };
}
