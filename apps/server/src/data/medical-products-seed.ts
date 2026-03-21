/**
 * Medical Products Seed Data
 * Real diagnostic test products for Botón Médico (Amunet brand)
 * Based on Mexican market pricing and COFEPRIS regulatory requirements
 */

export interface ProductPresentation {
    units: number;
    price_mxn: number;
    sku: string;
}

export interface ProductClinicalInfo {
    sensitivity: number;        // percentage
    specificity: number;        // percentage
    sample_type: string;
    result_time_minutes: number;
    storage_temp: string;
    regulatory_registration: string;
}

export interface MedicalProduct {
    id?: number;
    name: string;
    sku: string;
    category: string;
    presentations: ProductPresentation[];
    clinical_info: ProductClinicalInfo;
    indications: string[];
    procedure_steps: string[];
    interpretation: string;
    complementary_products: string[];  // SKUs
    target_profiles: string[];         // laboratorio, farmacia, consultorio, hospital, clinica
    keywords: string[];
}

export const MEDICAL_PRODUCTS_SEED: MedicalProduct[] = [
    {
        id: 1,
        name: 'Prueba Rápida HbA1c (Hemoglobina Glicosilada)',
        sku: 'HBAC-001',
        category: 'metabolica',
        presentations: [
            { units: 20, price_mxn: 1668, sku: 'HBAC-020' },
            { units: 5, price_mxn: 418, sku: 'HBAC-005' },
            { units: 1, price_mxn: 95, sku: 'HBAC-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 96.5,
            specificity: 98.2,
            sample_type: 'sangre capilar o venosa',
            result_time_minutes: 5,
            storage_temp: '2-8°C',
            regulatory_registration: '0171R2024 SSA',
        },
        indications: [
            'Detección y monitoreo de diabetes mellitus tipo 2',
            'Evaluación de control glucémico en pacientes diabéticos',
            'Screening de pre-diabetes',
            'Seguimiento clínico en consulta externa',
            'Laboratorios clínicos y puntos de atención rápida',
        ],
        procedure_steps: [
            'Obtener muestra de sangre capilar (pinchazo en dedo) o 2-3 μL de sangre venosa',
            'Aplicar muestra en el cartucho de prueba',
            'Insertar cartucho en el analizador portátil',
            'Esperar 5 minutos para resultado',
            'Leer resultado en pantalla (% HbA1c)',
        ],
        interpretation: `
Resultados:
- <5.7%: Normal, no diabetes
- 5.7% - 6.4%: Pre-diabetes, seguimiento recomendado
- ≥6.5%: Compatible con diabetes mellitus, confirmar con segunda prueba

Nota: Los resultados deben interpretarse en contexto clínico del paciente.
        `,
        complementary_products: ['GLUC-001', 'VIT-D-001'],
        target_profiles: ['laboratorio', 'farmacia', 'consultorio', 'hospital', 'clinica'],
        keywords: ['diabetes', 'hba1c', 'hemoglobina glicosilada', 'control glucémico', 'screening diabetes'],
    },
    {
        id: 2,
        name: 'Prueba Rápida de Embarazo (hCG)',
        sku: 'EMBA-001',
        category: 'prenatal',
        presentations: [
            { units: 20, price_mxn: 540, sku: 'EMBA-020' },
            { units: 5, price_mxn: 180, sku: 'EMBA-005' },
            { units: 1, price_mxn: 45, sku: 'EMBA-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 99.0,
            specificity: 99.5,
            sample_type: 'orina o sangre (suero)',
            result_time_minutes: 3,
            storage_temp: '2-30°C',
            regulatory_registration: '0169R2023 SSA',
        },
        indications: [
            'Detección temprana de embarazo',
            'Confirmación presuntiva de gestación',
            'Screening en consulta prenatal',
            'Investigación de amenorrea',
        ],
        procedure_steps: [
            'Recolectar orina matutina o sangre venosa',
            'Aplicar muestra en dispositivo de prueba',
            'Esperar 3 minutos',
            'Leer resultado (línea única = negativo, dos líneas = positivo)',
        ],
        interpretation: `
Negativo: Una línea en zona Control (C)
Positivo: Línea en Control (C) + línea en Test (T)
Inválido: Ausencia de línea en Control

Sensibilidad máxima a partir de primer día de retraso menstrual.
        `,
        complementary_products: ['HIV-001', 'SIFI-001', 'HEPAT-B-001'],
        target_profiles: ['farmacia', 'consultorio', 'clinica', 'laboratorio'],
        keywords: ['embarazo', 'hcg', 'pregnancy test', 'prueba de embarazo', 'gestación'],
    },
    {
        id: 3,
        name: 'Prueba Rápida Antidoping 5 Parámetros en Orina',
        sku: 'ANTI-U-001',
        category: 'toxicologia',
        presentations: [
            { units: 20, price_mxn: 820, sku: 'ANTI-U-020' },
            { units: 5, price_mxn: 250, sku: 'ANTI-U-005' },
            { units: 1, price_mxn: 65, sku: 'ANTI-U-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 98.0,
            specificity: 97.8,
            sample_type: 'orina',
            result_time_minutes: 5,
            storage_temp: '2-30°C',
            regulatory_registration: '0168R2024 SSA',
        },
        indications: [
            'Screening de drogas de abuso en personal',
            'Control en laborales de alto riesgo',
            'Evaluación clínica de sospecha de intoxicación',
            'Monitoreo de pacientes en tratamiento de adicción',
        ],
        procedure_steps: [
            'Obtener muestra de orina en contenedor estéril',
            'Sumergir el dispositivo en orina hasta la línea marcada',
            'Esperar 5 minutos para lectura de resultados',
            'Interpretar bandas de color para cada parámetro',
        ],
        interpretation: `
Detecta 5 parámetros:
1. THC (Marihuana): >50 ng/mL
2. COC (Cocaína): >300 ng/mL
3. OPI (Opiáceos): >300 ng/mL
4. AMP (Anfetaminas): >1000 ng/mL
5. BZO (Benzodiazepinas): >300 ng/mL

Línea visible = Resultado NEGATIVO
Ausencia de línea = Resultado POSITIVO
        `,
        complementary_products: ['ANTI-S-001'],
        target_profiles: ['laboratorio', 'consultorio', 'hospital', 'clinica'],
        keywords: ['antidoping', 'drogas', 'screening drogas', 'control antidoping', 'orina'],
    },
    {
        id: 4,
        name: 'Prueba Rápida Antidoping 5 Parámetros en Sangre',
        sku: 'ANTI-S-001',
        category: 'toxicologia',
        presentations: [
            { units: 20, price_mxn: 1200, sku: 'ANTI-S-020' },
            { units: 5, price_mxn: 350, sku: 'ANTI-S-005' },
            { units: 1, price_mxn: 90, sku: 'ANTI-S-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 97.5,
            specificity: 98.2,
            sample_type: 'sangre venosa o capilar',
            result_time_minutes: 5,
            storage_temp: '2-30°C',
            regulatory_registration: '0172R2024 SSA',
        },
        indications: [
            'Evaluación clínica inmediata de intoxicación',
            'Screening en urgencias',
            'Control en accidentes laborales',
            'Investigación en terapia intensiva',
        ],
        procedure_steps: [
            'Obtener 5 μL de sangre venosa o capilar en tubo con gel',
            'Aplicar muestra en dispositivo de prueba',
            'Esperar 5 minutos para lectura',
            'Interpretar bandas de color',
        ],
        interpretation: `
Detecta 5 parámetros en sangre (umbrales más sensibles que orina):
1. THC: Presencia detectable
2. COC: Presencia detectable
3. OPI: Presencia detectable
4. AMP: Presencia detectable
5. BZO: Presencia detectable

Línea visible = NEGATIVO
Ausencia de línea = POSITIVO
        `,
        complementary_products: ['ANTI-U-001'],
        target_profiles: ['hospital', 'clinica', 'urgencias', 'laboratorio'],
        keywords: ['antidoping sangre', 'drogas sangre', 'screening urgencia', 'intoxicación'],
    },
    {
        id: 5,
        name: 'Prueba Rápida de Influenza A/B',
        sku: 'INFL-001',
        category: 'respiratoria',
        presentations: [
            { units: 20, price_mxn: 780, sku: 'INFL-020' },
            { units: 5, price_mxn: 220, sku: 'INFL-005' },
            { units: 1, price_mxn: 60, sku: 'INFL-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 92.5,
            specificity: 98.0,
            sample_type: 'hisopo nasofaríngeo',
            result_time_minutes: 15,
            storage_temp: '2-30°C',
            regulatory_registration: '0165R2024 SSA',
        },
        indications: [
            'Diagnóstico diferencial en síntomas gripales',
            'Screening en centros de salud',
            'Confirmación rápida de influenza estacional',
            'Control en brotes institucionales',
        ],
        procedure_steps: [
            'Tomar hisopo nasofaríngeo rotando lentamente',
            'Introducir en tubo de transporte con medio de conservación',
            'Colocar hisopo en dispositivo de prueba',
            'Esperar 15 minutos para lectura',
            'Interpretar bandas: A, B, o ambas',
        ],
        interpretation: `
Resultados posibles:
- Influenza A: Banda A + Control
- Influenza B: Banda B + Control
- Influenza A/B: Bandas A + B + Control
- Negativo: Solo banda Control
- Inválido: Ausencia de banda Control
        `,
        complementary_products: ['COVID-001', 'RSV-001', 'RESP-PANEL-001'],
        target_profiles: ['farmacia', 'consultorio', 'hospital', 'clinica', 'laboratorio'],
        keywords: ['influenza', 'gripe', 'flu test', 'prueba gripe', 'síntomas respiratorios'],
    },
    {
        id: 6,
        name: 'Prueba Rápida COVID-19 Antígeno',
        sku: 'COVID-001',
        category: 'respiratoria',
        presentations: [
            { units: 20, price_mxn: 920, sku: 'COVID-020' },
            { units: 5, price_mxn: 280, sku: 'COVID-005' },
            { units: 1, price_mxn: 75, sku: 'COVID-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 94.2,
            specificity: 99.1,
            sample_type: 'hisopo nasofaríngeo o saliva',
            result_time_minutes: 15,
            storage_temp: '2-30°C',
            regulatory_registration: '0166R2024 SSA',
        },
        indications: [
            'Diagnóstico rápido de COVID-19',
            'Screening en entrada de instituciones',
            'Confirmación en síntomas compatibles',
            'Control epidemiológico',
        ],
        procedure_steps: [
            'Realizar hisopo nasofaríngeo o recolectar muestra de saliva',
            'Introducir en tubo de extracción',
            'Aplicar muestra en dispositivo',
            'Esperar 15 minutos para resultado',
        ],
        interpretation: `
Una línea en C: Resultado NEGATIVO
Línea en C + línea en T: Resultado POSITIVO
Solo línea en T: INVÁLIDO (repetir prueba)
Sin línea en C: INVÁLIDO (dispositivo defectuoso)
        `,
        complementary_products: ['INFL-001', 'RSV-001', 'RESP-PANEL-001'],
        target_profiles: ['farmacia', 'consultorio', 'hospital', 'clinica', 'laboratorio'],
        keywords: ['covid', 'covid-19', 'coronavirus', 'sars-cov-2', 'prueba covid'],
    },
    {
        id: 7,
        name: 'Prueba Rápida VIH 1&2 (3ra Generación)',
        sku: 'HIV-001',
        category: 'infecciosa',
        presentations: [
            { units: 20, price_mxn: 1560, sku: 'HIV-020' },
            { units: 5, price_mxn: 420, sku: 'HIV-005' },
            { units: 1, price_mxn: 110, sku: 'HIV-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 99.3,
            specificity: 99.8,
            sample_type: 'sangre capilar o venosa, suero',
            result_time_minutes: 20,
            storage_temp: '2-30°C',
            regulatory_registration: '0170R2024 SSA',
        },
        indications: [
            'Detección de VIH-1 y VIH-2',
            'Screening en bancos de sangre',
            'Confirmación presuntiva de infección por VIH',
            'Evaluación clínica de pacientes con riesgo',
        ],
        procedure_steps: [
            'Obtener muestra de sangre capilar o 5-10 μL venosa',
            'Aplicar en dispositivo de prueba',
            'Agregar buffer de dilución',
            'Esperar 20 minutos para lectura',
        ],
        interpretation: `
Negativo: Una línea en C (Control)
Positivo VIH-1/VIH-2: Línea en C + línea en T
Positivo VIH-1: Línea en C + en la zona específica de VIH-1
Positivo VIH-2: Línea en C + en la zona específica de VIH-2

IMPORTANTE: Resultado positivo debe confirmarse con Western Blot o método molecular.
        `,
        complementary_products: ['SIFI-001', 'HEPAT-B-001', 'EMBA-001'],
        target_profiles: ['laboratorio', 'hospital', 'clinica'],
        keywords: ['vih', 'hiv test', 'sida', 'screening vih', 'prueba vih'],
    },
    {
        id: 8,
        name: 'Prueba Rápida de Sífilis (VDRL/RPR)',
        sku: 'SIFI-001',
        category: 'infecciosa',
        presentations: [
            { units: 20, price_mxn: 1020, sku: 'SIFI-020' },
            { units: 5, price_mxn: 310, sku: 'SIFI-005' },
            { units: 1, price_mxn: 85, sku: 'SIFI-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 98.0,
            specificity: 97.5,
            sample_type: 'sangre venosa o capilar',
            result_time_minutes: 10,
            storage_temp: '2-30°C',
            regulatory_registration: '0173R2024 SSA',
        },
        indications: [
            'Screening de sífilis',
            'Confirmación presuntiva de treponematosis',
            'Evaluación prenatal',
            'Control en bancos de sangre',
        ],
        procedure_steps: [
            'Recolectar 5-10 μL de sangre venosa o capilar',
            'Transferir a tubo de reacción con reactivo',
            'Mezclar bien',
            'Colocar en lector rápido',
            'Leer resultado (reactivo o no reactivo)',
        ],
        interpretation: `
No reactivo: Ausencia de sífilis
Débilmente reactivo: Sífilis temprana o tardía tratada, repetir en 2 semanas
Reactivo: Sífilis probable, confirmar con FTA-ABS o TP-PA

NOTA: Falsos positivos posibles en: lupus, embarazo, artritis reumatoide
        `,
        complementary_products: ['HIV-001', 'HEPAT-B-001', 'EMBA-001'],
        target_profiles: ['laboratorio', 'hospital', 'clinica', 'consultorio'],
        keywords: ['sífilis', 'treponema pallidum', 'vdrl', 'rpr', 'ets'],
    },
    {
        id: 9,
        name: 'Prueba Rápida Hepatitis B (HBsAg)',
        sku: 'HEPAT-B-001',
        category: 'infecciosa',
        presentations: [
            { units: 20, price_mxn: 1140, sku: 'HEPAT-B-020' },
            { units: 5, price_mxn: 340, sku: 'HEPAT-B-005' },
            { units: 1, price_mxn: 95, sku: 'HEPAT-B-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 99.1,
            specificity: 99.4,
            sample_type: 'sangre venosa o capilar',
            result_time_minutes: 10,
            storage_temp: '2-30°C',
            regulatory_registration: '0174R2024 SSA',
        },
        indications: [
            'Detección de antígeno de superficie de Hepatitis B',
            'Screening de infección por VHB',
            'Evaluación prenatal',
            'Control en bancos de sangre',
        ],
        procedure_steps: [
            'Obtener 5-10 μL de sangre venosa o capilar',
            'Aplicar muestra en dispositivo',
            'Agregar buffer',
            'Esperar 10 minutos',
            'Interpretar resultado',
        ],
        interpretation: `
Negativo: Una línea en C
Positivo: Línea en C + línea en T (indica infección activa por VHB)

IMPORTANTE: Positivos deben confirmarse con anti-HBc y anti-HBs.
Se recomienda inmunización en negativos.
        `,
        complementary_products: ['HIV-001', 'SIFI-001', 'EMBA-001'],
        target_profiles: ['laboratorio', 'hospital', 'clinica'],
        keywords: ['hepatitis b', 'hbsag', 'vhb', 'hepatitis', 'ets'],
    },
    {
        id: 10,
        name: 'Prueba Rápida de Vitamina D',
        sku: 'VIT-D-001',
        category: 'metabolica',
        presentations: [
            { units: 20, price_mxn: 1181, sku: 'VIT-D-020' },
            { units: 5, price_mxn: 320, sku: 'VIT-D-005' },
            { units: 1, price_mxn: 80, sku: 'VIT-D-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 97.2,
            specificity: 96.8,
            sample_type: 'sangre capilar o venosa',
            result_time_minutes: 5,
            storage_temp: '2-30°C',
            regulatory_registration: '0175R2024 SSA',
        },
        indications: [
            'Evaluación de estado de vitamina D',
            'Screening en osteoporosis',
            'Seguimiento en pacientes con malabsorción',
            'Evaluación en raquitismo',
        ],
        procedure_steps: [
            'Recolectar 5 μL de sangre capilar o venosa',
            'Aplicar en cartucho de prueba',
            'Insertar en analizador',
            'Esperar 5 minutos para resultado (en ng/mL)',
        ],
        interpretation: `
Niveles de 25-hydroxyvitamina D:
- <20 ng/mL: Deficiencia (riesgo de raquitismo, osteoporosis)
- 20-30 ng/mL: Insuficiencia
- 30-100 ng/mL: Suficiencia (óptimo: 40-60)
- >100 ng/mL: Exceso (riesgo de toxicidad)

Recomendación: Exposición solar + suplementación oral si es necesario
        `,
        complementary_products: ['HBAC-001', 'CALC-001'],
        target_profiles: ['laboratorio', 'consultorio', 'clinica'],
        keywords: ['vitamina d', 'calcifediol', 'osteoporosis', 'raquitismo', 'metabolismo óseo'],
    },
    {
        id: 11,
        name: 'Prueba Rápida RSV (Virus Sincitial Respiratorio)',
        sku: 'RSV-001',
        category: 'respiratoria',
        presentations: [
            { units: 20, price_mxn: 890, sku: 'RSV-020' },
            { units: 5, price_mxn: 280, sku: 'RSV-005' },
            { units: 1, price_mxn: 75, sku: 'RSV-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 93.8,
            specificity: 98.5,
            sample_type: 'hisopo nasofaríngeo',
            result_time_minutes: 15,
            storage_temp: '2-30°C',
            regulatory_registration: '0176R2024 SSA',
        },
        indications: [
            'Diagnóstico de infección por RSV',
            'Evaluación en lactantes con bronquiolitis',
            'Screening en otoño-invierno',
            'Control en instituciones pediátricas',
        ],
        procedure_steps: [
            'Tomar hisopo nasofaríngeo en lactantes/niños',
            'Colocar en tubo de transporte',
            'Transferir a dispositivo de prueba',
            'Esperar 15 minutos',
            'Interpretar resultado (presencia/ausencia de banda)',
        ],
        interpretation: `
Negativo: Línea en C solamente
Positivo: Línea en C + línea en T (indica infección activa por RSV)

IMPORTANTE en lactantes: RSV causa bronquiolitis severa.
Diagnóstico temprano permite manejo preventivo.
        `,
        complementary_products: ['INFL-001', 'COVID-001', 'RESP-PANEL-001'],
        target_profiles: ['hospital', 'clinica', 'consultorio', 'laboratorio'],
        keywords: ['rsv', 'virus sincitial respiratorio', 'bronquiolitis', 'lactante'],
    },
    {
        id: 12,
        name: 'Prueba Rápida Panel Respiratorio (Influenza A/B + COVID + RSV)',
        sku: 'RESP-PANEL-001',
        category: 'respiratoria',
        presentations: [
            { units: 20, price_mxn: 2050, sku: 'RESP-PANEL-020' },
            { units: 5, price_mxn: 600, sku: 'RESP-PANEL-005' },
            { units: 1, price_mxn: 160, sku: 'RESP-PANEL-001-UNIT' },
        ],
        clinical_info: {
            sensitivity: 93.5,
            specificity: 98.0,
            sample_type: 'hisopo nasofaríngeo',
            result_time_minutes: 20,
            storage_temp: '2-30°C',
            regulatory_registration: '0177R2024 SSA',
        },
        indications: [
            'Diagnóstico diferencial completo en IRA',
            'Screening de infecciones respiratorias virales',
            'Control en brotes institucionales',
            'Evaluación en otoño-invierno',
        ],
        procedure_steps: [
            'Tomar hisopo nasofaríngeo profundo',
            'Colocar en tubo de extracción',
            'Procesar en analizador combinado',
            'Esperar 20 minutos para panel completo',
        ],
        interpretation: `
El dispositivo muestra presencia/ausencia simultánea de:
- Influenza A
- Influenza B
- COVID-19 (SARS-CoV-2)
- RSV (Virus Sincitial Respiratorio)

Permite diagnóstico rápido y diferencial en un resultado.
Reduce necesidad de pruebas múltiples.
        `,
        complementary_products: [],
        target_profiles: ['hospital', 'clinica', 'urgencias', 'laboratorio'],
        keywords: ['panel respiratorio', 'triple panel', 'diagnóstico diferencial', 'ira'],
    },
];

/**
 * Seed function to insert all products into the database
 */
export async function seedMedicalProducts(db: any) {
    for (const product of MEDICAL_PRODUCTS_SEED) {
        const result = await db.query(
            `INSERT INTO medical_products (name, sku, category, clinical_info, indications, procedure_steps, interpretation, complementary_products, target_profiles, keywords)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (sku) DO UPDATE
               SET name = EXCLUDED.name, category = EXCLUDED.category
             RETURNING id`,
            [
                product.name,
                product.sku,
                product.category,
                JSON.stringify(product.clinical_info),
                JSON.stringify(product.indications),
                JSON.stringify(product.procedure_steps),
                product.interpretation,
                JSON.stringify(product.complementary_products),
                JSON.stringify(product.target_profiles),
                JSON.stringify(product.keywords),
            ]
        );

        const productId = result.rows[0].id;

        // Insert presentations
        for (const presentation of product.presentations) {
            await db.query(
                `INSERT INTO product_presentations (medical_product_id, units, price_mxn, sku)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (sku) DO UPDATE
                   SET price_mxn = EXCLUDED.price_mxn`,
                [productId, presentation.units, presentation.price_mxn, presentation.sku]
            );
        }
    }

    console.log(`✓ Seeded ${MEDICAL_PRODUCTS_SEED.length} medical products with presentations`);
}
