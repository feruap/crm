/**
 * Clinical Decision Rules Seed Data
 * Maps symptoms/conditions to recommended diagnostic test products
 */

export interface ClinicalRule {
    name: string;
    description: string;
    trigger_keywords: string[];
    recommended_product_ids: number[];        // IDs from medical_products table
    recommendation_reason: string;
    client_profile_filter: string[];          // empty = all, or ['laboratorio', 'farmacia', etc]
    complementary_product_ids: number[];      // cross-sell suggestions
    priority: number;                         // higher = evaluated first
}

export const CLINICAL_RULES_SEED: ClinicalRule[] = [
    {
        name: 'Screening Prenatal Completo',
        description: 'Detección de complicaciones en embarazo: VIH, sífilis, hepatitis B',
        trigger_keywords: [
            'embarazo',
            'prenatal',
            'gestación',
            'embarazada',
            'pregnancy',
            'screening embarazo',
            'control prenatal',
            'embarazo primer trimestre',
        ],
        recommended_product_ids: [2, 7, 8, 9],  // Embarazo + VIH + Sífilis + Hepatitis B
        recommendation_reason:
            'Para un control prenatal seguro, recomendamos screening de enfermedades infecciosas transmisibles: prueba de embarazo, VIH, sífilis y hepatitis B. El protocolo de COFEPRIS requiere estas pruebas.',
        client_profile_filter: ['laboratorio', 'consultorio', 'hospital', 'clinica'],
        complementary_product_ids: [1],  // HbA1c para screening de diabetes gestacional
        priority: 95,
    },
    {
        name: 'Síntomas Respiratorios - Panel Completo',
        description: 'Diagnóstico diferencial de infecciones respiratorias virales',
        trigger_keywords: [
            'síntomas respiratorios',
            'tos',
            'gripe',
            'resfriado',
            'fiebre',
            'congestión',
            'dificultad respirar',
            'respiratory symptoms',
            'influenza',
            'covid',
            'síntomas covid',
        ],
        recommended_product_ids: [12],  // Panel Respiratorio (Influenza A/B + COVID + RSV)
        recommendation_reason:
            'Con síntomas respiratorios, el panel rápido permite diagnóstico diferencial inmediato de influenza A/B, COVID-19 y RSV. Evita pruebas múltiples y acelera manejo clínico.',
        client_profile_filter: [],  // Todos
        complementary_product_ids: [5, 6, 11],  // Influenza, COVID, RSV individuales
        priority: 90,
    },
    {
        name: 'Control de Diabetes',
        description: 'Monitoreo de control glucémico en diabéticos',
        trigger_keywords: [
            'diabetes',
            'hba1c',
            'hemoglobina glicosilada',
            'control glucémico',
            'glucosa',
            'diabético',
            'control diabetes',
            'seguimiento diabetes',
        ],
        recommended_product_ids: [1],  // HbA1c
        recommendation_reason:
            'La HbA1c es el estándar de oro para evaluar control glucémico en los últimos 3 meses. Recomendamos evaluación cada 3 meses en diabéticos.',
        client_profile_filter: ['laboratorio', 'consultorio', 'hospital', 'clinica'],
        complementary_product_ids: [10],  // Vitamina D (metabolismo óseo en diabéticos)
        priority: 88,
    },
    {
        name: 'Screening Antidoping Laboral',
        description: 'Control de drogas en personal laboral',
        trigger_keywords: [
            'antidoping',
            'screening drogas',
            'drug test',
            'control antidoping',
            'drogas de abuso',
            'personal',
            'laboral',
            'candidato',
        ],
        recommended_product_ids: [3],  // Antidoping orina (más económico para screening)
        recommendation_reason:
            'Para screening laboral, la prueba en orina es estándar, económica y no invasiva. Los 5 parámetros cubren drogas de abuso más comunes.',
        client_profile_filter: [],  // Todos
        complementary_product_ids: [4],  // Antidoping sangre para confirmación si es positivo
        priority: 80,
    },
    {
        name: 'Antidoping Clínico / Urgencias',
        description: 'Evaluación inmediata de intoxicación en cuidados clínicos',
        trigger_keywords: [
            'intoxicación',
            'overdose',
            'sobredosis',
            'urgencia drogas',
            'evaluación aguda',
            'urgencias',
            'cuidados intensivos',
            'sospecha intoxicación',
        ],
        recommended_product_ids: [4],  // Antidoping sangre (resultado más inmediato)
        recommendation_reason:
            'En urgencias, la prueba en sangre detecta drogas activas en circulación y permite manejo inmediato. Tiempo de resultado: 5 minutos.',
        client_profile_filter: ['hospital', 'clinica', 'urgencias'],
        complementary_product_ids: [3],  // Antidoping orina para confirmación
        priority: 85,
    },
    {
        name: 'Screening de ETS / ITS',
        description: 'Detección de enfermedades transmisibles sexualmente',
        trigger_keywords: [
            'ets',
            'its',
            'enfermedades transmisibles',
            'vih',
            'sífilis',
            'hepatitis',
            'screening ets',
            'std test',
            'sti screening',
        ],
        recommended_product_ids: [7, 8, 9],  // VIH + Sífilis + Hepatitis B
        recommendation_reason:
            'El screening de ETS incluye VIH, sífilis y hepatitis B. Protocolo estándar de salud pública para relaciones sexuales sin protección.',
        client_profile_filter: ['laboratorio', 'consultorio', 'hospital', 'clinica'],
        complementary_product_ids: [],
        priority: 85,
    },
    {
        name: 'Influenza y Complicaciones',
        description: 'Diagnóstico de influenza en temporada de gripe',
        trigger_keywords: [
            'influenza',
            'gripe',
            'flu',
            'virus gripe',
            'síntomas gripe',
            'tos fiebre',
            'malestar general',
        ],
        recommended_product_ids: [5],  // Influenza A/B
        recommendation_reason:
            'Permite identificar influenza A o B, diferenciando de COVID-19 o RSV. Importante para manejo antivirales tempranos.',
        client_profile_filter: [],
        complementary_product_ids: [6, 11],  // COVID, RSV
        priority: 75,
    },
    {
        name: 'Infección Respiratoria en Lactantes',
        description: 'Diagnóstico de bronquiolitis por RSV en menores de 2 años',
        trigger_keywords: [
            'bronquiolitis',
            'rsv',
            'lactante',
            'bebé',
            'niño pequeño',
            'bronquiolitis viral',
            'virus sincitial',
        ],
        recommended_product_ids: [11, 12],  // RSV + Panel Respiratorio
        recommendation_reason:
            'El RSV es la causa más común de bronquiolitis en lactantes. Diagnóstico rápido permite aislamiento y cuidados preventivos.',
        client_profile_filter: ['hospital', 'clinica'],
        complementary_product_ids: [],
        priority: 82,
    },
    {
        name: 'Deficiencia de Vitamina D',
        description: 'Evaluación de osteoporosis, raquitismo y metabolismo óseo',
        trigger_keywords: [
            'vitamina d',
            'calcio',
            'osteoporosis',
            'raquitismo',
            'metabolismo óseo',
            'fragilidad ósea',
            'hormonal',
        ],
        recommended_product_ids: [10],  // Vitamina D
        recommendation_reason:
            'Evaluación del estatus de vitamina D (25-hidroxivitamina D) es esencial en osteoporosis, raquitismo y sospecha de deficiencia.',
        client_profile_filter: ['laboratorio', 'consultorio', 'clinica'],
        complementary_product_ids: [1],  // HbA1c (comorbilidad frecuente)
        priority: 70,
    },
    {
        name: 'COVID-19 en Contexto',
        description: 'Diagnóstico rápido de SARS-CoV-2',
        trigger_keywords: [
            'covid',
            'covid-19',
            'coronavirus',
            'sars-cov-2',
            'antígeno covid',
            'prueba covid',
        ],
        recommended_product_ids: [6],  // COVID Antígeno
        recommendation_reason:
            'Diagnóstico rápido en 15 minutos. Alta especificidad (99%) permite aislamiento inmediato si es positivo.',
        client_profile_filter: [],
        complementary_product_ids: [5, 12],  // Influenza, Panel Respiratorio
        priority: 80,
    },
    {
        name: 'Investigación de Fiebre Prolongada / Hepatitis',
        description: 'Screening de infecciones con compromiso hepático',
        trigger_keywords: [
            'hepatitis',
            'ictericia',
            'coloración amarilla',
            'hígado',
            'liver',
            'fiebre prolongada',
            'marcadores hepatitis',
        ],
        recommended_product_ids: [9],  // Hepatitis B
        recommendation_reason:
            'El HBsAg permite descartar hepatitis B en fiebre prolongada. Hepatitis B es transmisible y requiere aislamiento.',
        client_profile_filter: ['laboratorio', 'hospital', 'clinica'],
        complementary_product_ids: [7, 8],  // VIH, Sífilis (co-infecciones frecuentes)
        priority: 75,
    },
];

/**
 * Seed function to insert all clinical rules into the database
 */
export async function seedClinicalRules(db: any) {
    for (const rule of CLINICAL_RULES_SEED) {
        await db.query(
            `INSERT INTO clinical_decision_rules
             (name, description, trigger_keywords, recommended_product_ids, recommendation_reason, client_profile_filter, complementary_product_ids, priority, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
             ON CONFLICT (name) DO UPDATE
               SET description = EXCLUDED.description,
                   trigger_keywords = EXCLUDED.trigger_keywords,
                   recommended_product_ids = EXCLUDED.recommended_product_ids`,
            [
                rule.name,
                rule.description,
                JSON.stringify(rule.trigger_keywords),
                JSON.stringify(rule.recommended_product_ids),
                rule.recommendation_reason,
                JSON.stringify(rule.client_profile_filter),
                JSON.stringify(rule.complementary_product_ids),
                rule.priority,
            ]
        );
    }

    console.log(`✓ Seeded ${CLINICAL_RULES_SEED.length} clinical decision rules`);
}
