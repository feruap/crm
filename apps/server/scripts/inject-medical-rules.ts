import { db } from '../src/db';
import { generateEmbedding } from '../src/ai.service';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ZERO_VECTOR = `[${new Array(1536).fill(0).join(',')}]`;

const RULES = [
    {
        q: '¿Qué pruebas recomiendas para un posible infarto?',
        a: 'Para la detección rápida de daño miocárdico, Amunet ofrece la Prueba Rápida Cardiac Combo Plus. Detecta Troponina I, Mioglobina y CK-MB en 15 minutos. Correlación Médica: Esencial para Médicos de Urgencias y Cardiólogos. Se recomienda acompañar con un Electrocardiograma (ECG) y monitoreo de enzimas cardíacas seriadas.',
        meta: { type: 'medical_rule', specialty: 'Cardiology', disease: 'Myocardial Infarction', priority: 10 }
    },
    {
        q: '¿Cómo detectar el VPH de forma rápida?',
        a: 'Nuestra tecnología PCR Rápida RT-LAMP para VPH permite la detección de genotipos de alto riesgo sin necesidad de termociclador. Correlación Médica: Ideal para Ginecología. Permite el triaje inmediato después de un Papanicolaou. Requiere Equipos de Laboratorio Portable para su procesamiento.',
        meta: { type: 'medical_rule', specialty: 'Gynecology', disease: 'HPV', priority: 10 }
    },
    {
        q: '¿Qué pruebas tienen para detección de cáncer?',
        a: 'Amunet cuenta con una línea completa de marcadores tumorales rápidos: PSA (Próstata), CA-125 (Ovario) y AFP (Hígado/Germinales). Correlación Médica: Utilizados por Urólogos, Oncólogos y Ginecólogos para tamizaje inicial. Recuerda que un resultado positivo requiere confirmación mediante ultrasonido o biopsia.',
        meta: { type: 'medical_rule', specialty: 'Oncology', disease: 'Cancer', priority: 10 }
    },
    {
        q: '¿Qué recomiendas para diagnosticar Dengue?',
        a: 'Contamos con la Prueba Rápida Dengue NS1/IgG/IgM para detección combinada de antígeno y anticuerpos. Correlación Médica: Vital en zonas endémicas para Infectología y Epidemiología. Recomendamos complementar con una Biometría Hemática para monitorear plaquetas.',
        meta: { type: 'medical_rule', specialty: 'Infectious Diseases', disease: 'Dengue', priority: 10 }
    },
    {
        q: '¿Qué productos tienen para un Urólogo?',
        a: 'Para Urología, recomendamos nuestras Pruebas Rápidas de PSA (Antígeno Prostático Específico) y pruebas de PCR para enfermedades de transmisión sexual (ETS) como Gonorrea y Clamidia compatibles con nuestro sistema de laboratorio portable.',
        meta: { type: 'medical_rule', specialty: 'Urology', priority: 5 }
    },
    {
        q: '¿Qué productos tienen para Gastroenterología?',
        a: 'Contamos con la Prueba Rápida de H. Pylori (aliento o heces) y detección de Sangre Oculta en Heces. Para un diagnóstico más profundo, ofrecemos el kit de PCR Rápida para Salmonella y Listeria.',
        meta: { type: 'medical_rule', specialty: 'Gastroenterology', priority: 5 }
    },
    {
        q: '¿Cómo diagnosticar Insuficiencia Cardíaca?',
        a: 'La prueba rápida de NT-proBNP es nuestro estándar de oro para el diagnóstico inicial y seguimiento de la Insuficiencia Cardíaca crónica y congestiva. Correlación Médica: Recomendada por Cardiólogos e Internistas.',
        meta: { type: 'medical_rule', specialty: 'Cardiology', disease: 'Heart Failure', priority: 8 }
    }
];

async function injectRules() {
    try {
        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        console.log(`Injecting ${RULES.length} medical research rules...`);

        for (const r of RULES) {
            let embeddingLiteral = ZERO_VECTOR;
            try {
                const embedding = await generateEmbedding(r.q, provider as any, api_key_encrypted);
                embeddingLiteral = `[${embedding.join(',')}]`;
            } catch (err: any) {
                console.warn(`Failed embedding for rule: ${r.q}`, err.message);
            }

            await db.query(
                `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                 VALUES ($1, $2, $3::vector, $4, $5)`,
                [r.q, r.a, embeddingLiteral, JSON.stringify(r.meta), 1.0]
            );
            console.log(`Injected rule: ${r.q}`);
        }

        console.log('Inyección de reglas médicas completa.');
    } catch (err: any) {
        console.error('KB inject error:', err.message);
    } finally {
        process.exit(0);
    }
}

injectRules();
