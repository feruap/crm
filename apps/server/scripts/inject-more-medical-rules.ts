import { db } from '../src/db';
import { generateEmbedding } from '../src/ai.service';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ZERO_VECTOR = `[${new Array(1536).fill(0).join(',')}]`;

const RULES = [
    {
        q: '¿Qué tienen para Pediatría?',
        a: 'Para Pediatría, recomendamos nuestras Pruebas Rápidas de Estreptococo A, Influenza A/B y Rotavirus/Adenovirus. Para tamizaje neonatal, contamos con pruebas de TSH. Correlación: Crucial para el diagnóstico diferencial de enfermedades respiratorias y digestivas agudas en niños.',
        meta: { type: 'medical_rule', specialty: 'Pediatrics', priority: 7 }
    },
    {
        q: '¿Cómo funciona el Vale de Cortesía o muestras?',
        a: 'El programa de Cortesías de Amunet está diseñado para que profesionales de la salud validen nuestras pruebas. Limitamos a 1 muestra por clínica/laboratorio sujeto a aprobación. Para solicitarla, necesito que me proporciones tu Cédula Profesional y el nombre de tu institución.',
        meta: { type: 'business_rule', topic: 'cortesias', action: 'request_info' }
    },
    {
        q: '¿Qué recomiendan para Ginecología y Obstetricia?',
        a: 'Ofrecemos Pruebas de Embarazo (HCG) de alta sensibilidad, marcadores tumorales (CA-125) y PCR Rápida para VPH y Clamidia. Correlación: Permite el monitoreo preventivo y diagnóstico rápido de infecciones de transmisión sexual en consultorio.',
        meta: { type: 'medical_rule', specialty: 'Gynecology', priority: 8 }
    },
    {
        q: '¿Qué es un Laboratorio Portable?',
        a: 'Es nuestro ecosistema de diagnóstico en el punto de atención (POCT). Incluye termocicladores RT-LAMP compactos y kits de PCR rápida que no requieren infraestructura compleja. Permite realizar diagnósticos de grado molecular en zonas remotas o consultorios privados.',
        meta: { type: 'product_concept', topic: 'portable_lab' }
    }
];

async function injectMoreRules() {
    try {
        const settings = await db.query(`SELECT provider, api_key_encrypted FROM ai_settings WHERE is_default = TRUE LIMIT 1`);
        if (settings.rows.length === 0) throw new Error('AI not configured');
        const { provider, api_key_encrypted } = settings.rows[0];

        for (const r of RULES) {
            let embeddingLiteral = ZERO_VECTOR;
            try {
                const embedding = await generateEmbedding(r.q, provider as any, api_key_encrypted);
                embeddingLiteral = `[${embedding.join(',')}]`;
            } catch (err) { }

            await db.query(
                `INSERT INTO knowledge_base (question, answer, embedding, metadata, confidence_score)
                 VALUES ($1, $2, $3::vector, $4, $5)`,
                [r.q, r.a, embeddingLiteral, JSON.stringify(r.meta), 1.0]
            );
        }
        console.log('Reglas adicionales inyectadas.');
    } catch (err: any) {
        console.error(err.message);
    } finally { process.exit(0); }
}

injectMoreRules();
