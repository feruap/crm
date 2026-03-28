/**
 * PDF Indexer Service
 */

import { db } from '../db';
import { generateEmbedding } from '../ai.service';

const SECTION_PATTERNS = [
    { pattern: /(?:indicacion|uso\s+previsto|intended\s+use|proposito)/i, type: 'indicaciones' },
    { pattern: /(?:procedimiento|instrucciones|metodo|preparacion\s+de\s+muestra|how\s+to)/i, type: 'procedimiento' },
    { pattern: /(?:interpretaci[oó]n|lectura\s+de\s+resultado|result|positivo|negativo)/i, type: 'interpretacion' },
    { pattern: /(?:especificaci[oó]n|sensibilidad|especificidad|rendimiento|performance)/i, type: 'especificaciones' },
    { pattern: /(?:almacen|conservaci[oó]n|storage|temperatura|estabilidad)/i, type: 'almacenamiento' },
    { pattern: /(?:precauci[oó]n|advertencia|limitaci[oó]n|warning|caution)/i, type: 'precauciones' },
    { pattern: /(?:contenido|componente|kit\s+contiene|materials?\s+provided)/i, type: 'contenido_kit' },
];

function detectChunkType(text: string): string {
    for (const { pattern, type } of SECTION_PATTERNS) {
        if (pattern.test(text)) return type;
    }
    return 'general';
}

interface TextChunk { content: string; chunk_type: string; }

function splitByParagraphs(text: string, maxSize: number): string[] {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 30);
    const result: string[] = [];
    let current = '';
    for (const para of paragraphs) {
        if (current.length + para.length > maxSize && current.length > 0) {
            result.push(current.trim());
            current = para;
        } else {
            current += (current ? '\n\n' : '') + para;
        }
    }
    if (current.trim().length > 30) result.push(current.trim());
    return result;
}

export function chunkText(text: string, maxChunkSize = 1000): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sectionSplitPattern = /(?=\n\s*(?:\d+[\.\)]\s+|[A-Z][A-Z\s]{3,}(?:\n|:)|#{1,3}\s+))/;
    const sections = text.split(sectionSplitPattern).filter(s => s.trim().length > 50);
    if (sections.length > 1) {
        for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length <= maxChunkSize) {
                chunks.push({ content: trimmed, chunk_type: detectChunkType(trimmed) });
            } else {
                const sectionType = detectChunkType(trimmed);
                for (const para of splitByParagraphs(trimmed, maxChunkSize)) {
                    chunks.push({ content: para, chunk_type: sectionType });
                }
            }
        }
    } else {
        for (const para of splitByParagraphs(text, maxChunkSize)) {
            chunks.push({ content: para, chunk_type: detectChunkType(para) });
        }
    }
    return chunks;
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(pdfBuffer);
        return data.text;
    } catch {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
            const doc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
            let text = '';
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map((item: any) => item.str).join(' ') + '\n\n';
            }
            return text;
        } catch {
            throw new Error('PDF extraction failed: install pdf-parse or pdfjs-dist');
        }
    }
}

export async function indexPDFForProduct(
    medicalProductId: number,
    pdfBuffer: Buffer,
    filename: string,
    provider: any,
    apiKey: string
): Promise<{ chunks_created: number; errors: string[] }> {
    const errors: string[] = [];
    let rawText: string;
    try {
        rawText = await extractTextFromPDF(pdfBuffer);
    } catch (err) {
        return { chunks_created: 0, errors: [String(err)] };
    }
    if (rawText.trim().length < 100) {
        return { chunks_created: 0, errors: ['PDF text too short or empty (possibly scanned image PDF)'] };
    }
    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
        return { chunks_created: 0, errors: ['No meaningful chunks could be extracted'] };
    }
    await db.query(
        `DELETE FROM medical_knowledge_chunks WHERE medical_product_id = $1 AND source_filename = $2`,
        [medicalProductId, filename]
    );
    let created = 0;
    for (const chunk of chunks) {
        try {
            const embedding = await generateEmbedding(chunk.content, provider, apiKey);
            const vectorLiteral = `[${embedding.join(',')}]`;
            await db.query(
                `INSERT INTO medical_knowledge_chunks (medical_product_id, chunk_type, content, source_filename, embedding)
                 VALUES ($1, $2, $3, $4, $5::vector)`,
                [medicalProductId, chunk.chunk_type, chunk.content, filename, vectorLiteral]
            );
            created++;
        } catch (err) {
            errors.push(`Chunk "${chunk.chunk_type}": ${String(err)}`);
        }
    }
    await db.query(
        `UPDATE medical_products SET technical_sheet_url = $1, updated_at = NOW() WHERE id = $2`,
        [filename, medicalProductId]
    );
    return { chunks_created: created, errors };
}

export async function generateProductEmbedding(productId: number, provider: any, apiKey: string): Promise<void> {
    const product = await db.query(
        `SELECT name, diagnostic_category, clinical_indications, sample_type, methodology, interpretation_guide
         FROM medical_products WHERE id = $1`,
        [productId]
    );
    if (product.rows.length === 0) return;
    const p = product.rows[0];
    const textForEmbedding = [
        `Prueba: ${p.name}`,
        `Categoría: ${p.diagnostic_category}`,
        `Indicaciones: ${(p.clinical_indications || []).join(', ')}`,
        `Muestra: ${p.sample_type || ''}`,
        `Metodología: ${p.methodology || ''}`,
        p.interpretation_guide ? `Interpretación: ${p.interpretation_guide}` : '',
    ].filter(Boolean).join('. ');
    const embedding = await generateEmbedding(textForEmbedding, provider, apiKey);
    const vectorLiteral = `[${embedding.join(',')}]`;
    await db.query(
        `UPDATE medical_products SET embedding = $1::vector, updated_at = NOW() WHERE id = $2`,
        [vectorLiteral, productId]
    );
}
