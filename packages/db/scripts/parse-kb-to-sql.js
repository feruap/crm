#!/usr/bin/env node
/**
 * parse-kb-to-sql.js
 * Parses amunet_knowledge_base_v2.md (médicos) and amunet_knowledge_base_labs.md (laboratorios)
 * Generates SQL INSERT/UPSERT statements for medical_products table.
 *
 * Usage: node parse-kb-to-sql.js > seed-products.sql
 */

const fs = require('fs');
const path = require('path');

// Paths to KB files (relative to repo root)
const V2_PATH = path.resolve('/sessions/lucid-gifted-rubin/mnt/myalice/amunet_knowledge_base_v2.md');
const LABS_PATH = path.resolve('/sessions/lucid-gifted-rubin/mnt/myalice/amunet_knowledge_base_labs.md');

// ─────────────────────────────────────────────
// PARSER: Split markdown into product blocks
// ─────────────────────────────────────────────
function splitIntoProducts(content) {
  const lines = content.split('\n');
  const products = [];
  let current = null;

  for (const line of lines) {
    // H2 = new product (## Product Name)
    if (line.match(/^## /)) {
      const name = line.replace(/^## /, '').trim();
      // Skip non-product sections
      if (name.match(/^(Versión|SECCIÓN|TABLA|FAQs|ANEXOS|Tabla Estratégica)/i)) continue;
      if (name.match(/^Refacciones de Mesada/i)) {
        // This is a multi-product section, handle differently
        if (current) products.push(current);
        current = { name, sections: {}, lines: [] };
        continue;
      }
      if (current) products.push(current);
      current = { name, sections: {}, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) products.push(current);
  return products;
}

// ─────────────────────────────────────────────
// EXTRACTOR: Parse sections from product lines
// ─────────────────────────────────────────────
function extractSections(product) {
  const lines = product.lines;
  let currentSection = '_header';
  const sections = { _header: [] };

  for (const line of lines) {
    if (line.match(/^### /)) {
      currentSection = line.replace(/^### /, '').trim();
      sections[currentSection] = [];
    } else {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    }
  }
  return sections;
}

function getField(lines, pattern) {
  if (!lines) return null;
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function getFieldAfter(lines, prefix) {
  if (!lines) return null;
  for (const line of lines) {
    if (line.includes(prefix)) {
      // Find the FIRST colon AFTER the prefix position and take everything after it
      const prefixIdx = line.indexOf(prefix);
      const afterPrefix = line.substring(prefixIdx);
      const colonIdx = afterPrefix.indexOf(':');
      if (colonIdx !== -1) {
        return afterPrefix.substring(colonIdx + 1).trim();
      }
      // Fallback: take everything after prefix
      return afterPrefix.substring(prefix.length).replace(/^[\s:]+/, '').trim();
    }
  }
  return null;
}

function getAllText(lines) {
  if (!lines) return null;
  return lines.filter(l => l.trim()).join('\n').trim() || null;
}

// ─────────────────────────────────────────────
// Parse presentaciones from text like: "Caja con 2 pruebas ($400), Caja con 5 pruebas ($800)"
// ─────────────────────────────────────────────
function parsePresentaciones(text) {
  if (!text) return [];
  const result = [];
  // Pattern: Caja con N pruebas ($PRICE) or Caja con N ($PRICE)
  const regex = /(?:Caja\s+con\s+)?(\d+)\s*(?:pruebas?|piezas?)?\s*\(\$?([\d,\.]+)\)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    result.push({
      cantidad: parseInt(match[1]),
      precio: parseFloat(match[2].replace(',', ''))
    });
  }
  // Also try: "20 pruebas ($995)" pattern
  if (result.length === 0) {
    const regex2 = /(\d+)\s*(?:pruebas?|piezas?|unidades?)?\s*\(\$?([\d,\.]+)\)/gi;
    while ((match = regex2.exec(text)) !== null) {
      result.push({
        cantidad: parseInt(match[1]),
        precio: parseFloat(match[2].replace(',', ''))
      });
    }
  }
  return result;
}

// Parse cross-sells from lines
function parseCrossSells(lines) {
  if (!lines) return [];
  const result = [];
  let current = null;
  for (const line of lines) {
    const nameMatch = line.match(/^\s*-\s*\*\*(.+?)\*\*[:\s]*(.*)/);
    if (nameMatch) {
      if (current) result.push(current);
      current = { name: nameMatch[1].trim(), reason: nameMatch[2].trim(), url: null };
    } else if (current) {
      const urlMatch = line.match(/URL[:\s]*(https?:\/\/\S+)/i);
      if (urlMatch) {
        current.url = urlMatch[1].trim();
      } else if (line.trim() && !line.match(/^\s*-/)) {
        current.reason += ' ' + line.trim();
      }
    }
  }
  if (current) result.push(current);
  return result;
}

// Parse objeciones from lines
function parseObjeciones(lines) {
  if (!lines) return [];
  const result = [];
  let inObjeciones = false;
  for (const line of lines) {
    if (line.match(/objeciones?\s+comunes?/i) || line.match(/Objeción/i)) {
      inObjeciones = true;
    }
    if (inObjeciones) {
      // Pattern: "Objeción — "text":" or "- "question?": answer"
      const match = line.match(/(?:Objeción\s*—?\s*)?[""](.+?)[""][:\s]*(.+)/);
      if (match) {
        result.push({ pregunta: match[1].trim(), respuesta: match[2].trim() });
      }
    }
  }
  return result;
}

function parseKeywords(lines) {
  if (!lines) return [];
  // Take all non-empty, non-structural lines
  const text = lines.filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('|') && !l.match(/^\*\*FIN/)).join(' ');
  if (!text) return [];
  // Keywords are space-separated (not comma-separated in these files) — keep individual words but also try comma split
  if (text.includes(',')) {
    return text.split(/,/).map(k => k.trim().replace(/\.+$/, '')).filter(k => k.length > 1 && k.length < 80);
  }
  // Space-separated keywords — group 2-3 word phrases where possible
  return text.split(/\s{2,}/).map(k => k.trim().replace(/\.+$/, '')).filter(k => k.length > 1 && k.length < 80);
}

// ─────────────────────────────────────────────
// V2 (Médicos) Parser
// ─────────────────────────────────────────────
function parseV2Product(product) {
  const sections = extractSections(product);
  const header = sections._header || [];

  const url = getFieldAfter(header, 'URL:');
  const categoria = getFieldAfter(header, 'Categoría:') || getFieldAfter(header, 'Categoria:');
  const tipoProducto = getFieldAfter(header, 'Tipo de producto:');

  // Información Comercial
  const comercial = sections['Información Comercial'] || [];
  const precioPublico = getFieldAfter(comercial, 'Precio público');
  const presentacionesText = getFieldAfter(comercial, 'Presentaciones disponibles:') || getFieldAfter(comercial, 'Presentaciones:');
  const precioPorPrueba = getFieldAfter(comercial, 'Precio por prueba');
  const precioSugerido = getFieldAfter(comercial, 'Precio sugerido');
  const margen = getFieldAfter(comercial, 'Margen estimado');

  // Información Técnica
  const tecnica = sections['Información Técnica'] || sections['Datos Técnicos Clave'] || [];
  const analito = getFieldAfter(tecnica, 'Analito') || getFieldAfter(tecnica, 'Biomarcador');
  const muestra = getFieldAfter(tecnica, 'Tipo de muestra:') || getFieldAfter(tecnica, 'Muestra:');
  const volumen = getFieldAfter(tecnica, 'Volumen de muestra');
  const tiempo = getFieldAfter(tecnica, 'Tiempo de resultado:') || getFieldAfter(tecnica, 'Tiempo:');
  const sensibilidad = getFieldAfter(tecnica, 'Sensibilidad:');
  const especificidad = getFieldAfter(tecnica, 'Especificidad:');
  const cutoff = getFieldAfter(tecnica, 'Punto de corte') || getFieldAfter(tecnica, 'Cut-off:');
  const almacenamiento = getFieldAfter(tecnica, 'Temperatura de almacenamiento:') || getFieldAfter(tecnica, 'Almacenamiento:');
  const vidaUtil = getFieldAfter(tecnica, 'Vida útil:');
  const registro = getFieldAfter(tecnica, 'Registro sanitario:') || getFieldAfter(tecnica, 'Registro:');

  // Uso Clínico
  const usoClinico = sections['Uso Clínico'] || [];
  const clasificacion = getFieldAfter(usoClinico, 'Clasificación:');
  const proposito = getFieldAfter(usoClinico, 'Propósito clínico:');
  const especialidades = getFieldAfter(usoClinico, 'Especialidades médicas');
  // Extract escenarios: lines starting with ** inside Uso Clínico (the bold scenario names)
  const escenarioLines = [];
  let inEscenarios = false;
  for (const line of usoClinico) {
    if (line.match(/Escenarios de uso/i)) { inEscenarios = true; continue; }
    if (line.match(/^-\s*(Perfil|Frecuencia|Limitaciones|Resultado)/i)) inEscenarios = false;
    if (inEscenarios && line.trim()) escenarioLines.push(line);
  }
  const escenarios = escenarioLines.length > 0 ? escenarioLines.join('\n').trim() : null;
  const perfilPaciente = getFieldAfter(usoClinico, 'Perfil del paciente');
  const frecuencia = getFieldAfter(usoClinico, 'Frecuencia de uso');
  const limitaciones = getFieldAfter(usoClinico, 'Limitaciones');
  const resultadoPositivo = getFieldAfter(usoClinico, 'Resultado positivo');
  const resultadoNegativo = getFieldAfter(usoClinico, 'Resultado negativo');

  // Argumento de Venta
  const venta = sections['Argumento de Venta (para el bot)'] || sections['Argumento de Venta'] || [];
  const pitch = getFieldAfter(venta, 'Pitch en una oración:') || getFieldAfter(venta, 'Pitch:');
  const ventajaVsLab = getFieldAfter(venta, 'Ventaja competitiva');
  const roi = getFieldAfter(venta, 'ROI para el médico:') || getFieldAfter(venta, 'ROI:');
  const objeciones = parseObjeciones(venta);

  // Cross-sells
  const crossSellLines = sections['Cross-sells (Pruebas complementarias)'] || sections['Cross-sells'] || [];
  const crossSells = parseCrossSells(crossSellLines);

  // Up-sells
  const upSellLines = sections['Up-sells (Productos de mayor valor)'] || sections['Up-sells'] || [];
  const upSells = parseCrossSells(upSellLines);

  // Keywords
  const keywordLines = sections['Palabras clave para búsqueda'] || sections['Palabras clave'] || [];
  const keywords = parseKeywords(keywordLines);

  // Parse numeric sensitivity
  let sensNum = null;
  if (sensibilidad) {
    const m = sensibilidad.match(/([\d.]+)%/);
    if (m) sensNum = parseFloat(m[1]);
  }
  let specNum = null;
  if (especificidad) {
    const m = especificidad.match(/([\d.]+)%/);
    if (m) specNum = parseFloat(m[1]);
  }

  // Parse precio_publico number
  let precioNum = null;
  if (precioPublico) {
    const m = precioPublico.match(/\$?([\d,]+\.?\d*)/);
    if (m) precioNum = parseFloat(m[1].replace(',', ''));
  }

  // Parse precio_por_prueba
  let precioPruebaNum = null;
  if (precioPorPrueba) {
    const m = precioPorPrueba.match(/\$?([\d,]+\.?\d*)/);
    if (m) precioPruebaNum = parseFloat(m[1].replace(',', ''));
  }

  // Map category
  const catMap = {
    'cardiología': 'cardiologicas',
    'cardiologia': 'cardiologicas',
    'metabolismo': 'metabolicas',
    'metabolica': 'metabolicas',
    'alergia': 'metabolicas',
    'nefrología': 'metabolicas',
    'renal': 'metabolicas',
    'infecciosas': 'infecciosas',
    'respiratorias': 'respiratorias',
    'ets': 'ets',
    'enfermedades de transmisión sexual': 'ets',
    'prenatal': 'embarazo',
    'embarazo': 'embarazo',
    'oncología': 'oncologicas',
    'oncologicas': 'oncologicas',
    'marcadores tumorales': 'oncologicas',
    'gastrointestinal': 'gastrointestinal',
    'gastroenterología': 'gastrointestinal',
    'drogas': 'drogas',
    'toxicología': 'drogas',
    'antidoping': 'drogas',
    'equipos': 'equipos',
    'consumibles': 'consumibles',
    'biología molecular': 'molecular',
    'pcr': 'molecular'
  };

  let diagCat = 'otros';
  if (categoria) {
    const catLower = categoria.toLowerCase();
    for (const [key, val] of Object.entries(catMap)) {
      if (catLower.includes(key)) { diagCat = val; break; }
    }
  }

  // Map sample_type
  let sampleType = null;
  if (muestra) {
    const ml = muestra.toLowerCase();
    if (ml.includes('orina')) sampleType = 'orina';
    else if (ml.includes('heces')) sampleType = 'heces';
    else if (ml.includes('saliva')) sampleType = 'saliva';
    else if (ml.includes('hisop') && ml.includes('nasal')) sampleType = 'hisopo_nasal';
    else if (ml.includes('hisop') && ml.includes('faring')) sampleType = 'hisopo_orofaringeo';
    else if (ml.includes('sangre') || ml.includes('suero') || ml.includes('plasma') || ml.includes('capilar')) sampleType = 'sangre_total';
    else if (ml.includes('esputo')) sampleType = 'esputo';
    else sampleType = muestra.substring(0, 50);
  }

  // Parse especialidades into array
  let especialidadesArr = [];
  if (especialidades) {
    especialidadesArr = especialidades.split(/[,;.]+/).map(s => s.trim()).filter(s => s.length > 1);
  }

  return {
    name: product.name,
    url_tienda: url,
    diagnostic_category: diagCat,
    tipo_producto: tipoProducto,
    precio_publico: precioNum,
    presentaciones: parsePresentaciones(presentacionesText),
    precio_por_prueba: precioPruebaNum,
    precio_sugerido_paciente: precioSugerido,
    margen_estimado: margen,
    analito,
    sample_type: sampleType,
    volumen_muestra: volumen,
    result_time: tiempo,
    sensitivity: sensNum,
    specificity: specNum,
    punto_corte: cutoff,
    storage_conditions: almacenamiento,
    shelf_life: vidaUtil,
    registro_sanitario: registro,
    clasificacion_clinica: clasificacion,
    proposito_clinico: proposito,
    especialidades: especialidadesArr,
    escenarios_uso: escenarios,
    perfil_paciente: perfilPaciente,
    frecuencia_uso: frecuencia,
    limitaciones,
    resultado_positivo: resultadoPositivo,
    resultado_negativo: resultadoNegativo,
    pitch_medico: pitch,
    ventaja_vs_lab: ventajaVsLab,
    roi_medico: roi,
    objeciones_medico: objeciones,
    cross_sells: crossSells,
    up_sells: upSells,
    palabras_clave: keywords,
    target_audience: ['medico'],
    _source: 'v2'
  };
}

// ─────────────────────────────────────────────
// Labs Parser
// ─────────────────────────────────────────────
function parseLabsProduct(product) {
  const sections = extractSections(product);
  const header = sections._header || [];

  const url = getFieldAfter(header, 'URL:');
  const categoria = getFieldAfter(header, 'Categoría:') || getFieldAfter(header, 'Categoria:');

  // Información Comercial
  const comercial = sections['Información Comercial'] || [];
  const precioPublico = getFieldAfter(comercial, 'Precio público') || getFieldAfter(comercial, 'Precio:');
  const presentacionesText = getFieldAfter(comercial, 'Presentaciones:') || getFieldAfter(comercial, 'Presentaciones disponibles:');
  const costoUnitario = getFieldAfter(comercial, 'Costo unitario:');
  const precioSugerido = getFieldAfter(comercial, 'Precio sugerido');
  const margen = getFieldAfter(comercial, 'Margen estimado:');

  // Datos Técnicos Clave
  const tecnica = sections['Datos Técnicos Clave'] || sections['Información Técnica'] || [];
  const analito = getFieldAfter(tecnica, 'Analito:');
  const muestra = getFieldAfter(tecnica, 'Muestra:');
  const tiempo = getFieldAfter(tecnica, 'Tiempo:');
  const sensibilidad = getFieldAfter(tecnica, 'Sensibilidad:');
  const especificidad = getFieldAfter(tecnica, 'Especificidad:');
  const cutoff = getFieldAfter(tecnica, 'Cut-off:');
  const registro = getFieldAfter(tecnica, 'Registro:');

  // ¿Por qué agregarlo?
  const porqueLines = sections['¿Por qué agregarlo a tu menú?'] || sections['¿Por qué agregarlo a tu laboratorio?'] || sections['¿Por qué agregarlo?'] || [];
  const porque = getAllText(porqueLines);

  // Pitch de Venta
  const ventaLines = sections['Pitch de Venta (para el bot)'] || sections['Pitch de Venta'] || [];
  // Extract lab pitch: line containing "Para laboratorios" — take text after the colon/bold marker
  let pitchLab = null;
  for (const line of ventaLines) {
    if (line.match(/para\s+laboratorios/i)) {
      pitchLab = line.replace(/.*\*\*Para\s+laboratorios:\*\*\s*/i, '')
                      .replace(/.*Para\s+laboratorios:\s*/i, '')
                      .replace(/^[-\s*]+/, '').trim();
      break;
    }
  }
  // Also try general pitch if no lab-specific one
  if (!pitchLab) {
    pitchLab = getFieldAfter(ventaLines, 'Para laboratorios');
  }
  const objeciones = parseObjeciones(ventaLines);

  // Cross-sells
  const crossSellLines = sections['Cross-sells'] || [];
  const crossSells = parseCrossSells(crossSellLines);

  // Keywords
  const keywordLines = sections['Palabras clave'] || [];
  const keywords = parseKeywords(keywordLines);

  // Parse numbers
  let precioNum = null;
  if (precioPublico) {
    const m = precioPublico.match(/\$?([\d,]+\.?\d*)/);
    if (m) precioNum = parseFloat(m[1].replace(',', ''));
  }

  let costoUnitarioNum = null;
  if (costoUnitario) {
    const m = costoUnitario.match(/\$?([\d,]+\.?\d*)/);
    if (m) costoUnitarioNum = parseFloat(m[1].replace(',', ''));
  }

  let sensNum = null;
  if (sensibilidad) {
    const m = sensibilidad.match(/([\d.]+)%/);
    if (m) sensNum = parseFloat(m[1]);
  }
  let specNum = null;
  if (especificidad) {
    const m = especificidad.match(/([\d.]+)%/);
    if (m) specNum = parseFloat(m[1]);
  }

  // Map sample_type
  let sampleType = null;
  if (muestra) {
    const ml = muestra.toLowerCase();
    if (ml.includes('orina')) sampleType = 'orina';
    else if (ml.includes('heces')) sampleType = 'heces';
    else if (ml.includes('saliva')) sampleType = 'saliva';
    else if (ml.includes('nasofaríng') || ml.includes('nasofaring') || ml.includes('nasal')) sampleType = 'hisopo_nasal';
    else if (ml.includes('faring')) sampleType = 'hisopo_orofaringeo';
    else if (ml.includes('sangre') || ml.includes('suero') || ml.includes('plasma')) sampleType = 'sangre_total';
    else if (ml.includes('esputo')) sampleType = 'esputo';
    else sampleType = muestra.substring(0, 50);
  }

  return {
    name: product.name,
    url_tienda: url,
    precio_publico: precioNum,
    presentaciones: parsePresentaciones(presentacionesText),
    precio_por_prueba: costoUnitarioNum,
    precio_sugerido_paciente: precioSugerido,
    margen_estimado: margen,
    analito,
    sample_type: sampleType,
    result_time: tiempo,
    sensitivity: sensNum,
    specificity: specNum,
    punto_corte: cutoff,
    registro_sanitario: registro,
    pitch_laboratorio: pitchLab,
    porque_agregarlo_lab: porque,
    objeciones_laboratorio: objeciones,
    cross_sells: crossSells,
    palabras_clave: keywords,
    target_audience: ['laboratorio'],
    _source: 'labs'
  };
}

// ─────────────────────────────────────────────
// MERGE: Combine v2 and labs data for same product
// ─────────────────────────────────────────────
function normalizeProductName(name) {
  return name.toLowerCase()
    .replace(/prueba\s+rápida\s+de?\s*/gi, '')
    .replace(/prueba\s+rápida\s*/gi, '')
    .replace(/combo\s+de\s+pruebas\s+rápidas?\s+de?\s*/gi, 'combo ')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[^\w\sáéíóúñü]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeProducts(v2Products, labsProducts) {
  const merged = new Map(); // url_tienda → product

  // Add all v2 products first
  for (const p of v2Products) {
    const key = p.url_tienda || normalizeProductName(p.name);
    merged.set(key, { ...p });
  }

  // Merge labs products
  for (const lp of labsProducts) {
    const key = lp.url_tienda || normalizeProductName(lp.name);

    if (merged.has(key)) {
      // Merge: add labs-specific fields to existing v2 product
      const existing = merged.get(key);
      existing.pitch_laboratorio = lp.pitch_laboratorio;
      existing.porque_agregarlo_lab = lp.porque_agregarlo_lab;
      existing.objeciones_laboratorio = lp.objeciones_laboratorio || [];
      existing.target_audience = ['medico', 'laboratorio'];

      // Merge keywords
      const allKw = new Set([...(existing.palabras_clave || []), ...(lp.palabras_clave || [])]);
      existing.palabras_clave = [...allKw];

      // Merge cross-sells (deduplicate by URL)
      const existingUrls = new Set((existing.cross_sells || []).map(c => c.url));
      for (const cs of (lp.cross_sells || [])) {
        if (!existingUrls.has(cs.url)) {
          existing.cross_sells.push(cs);
        }
      }

      // Use labs presentaciones if v2 doesn't have them
      if ((!existing.presentaciones || existing.presentaciones.length === 0) && lp.presentaciones.length > 0) {
        existing.presentaciones = lp.presentaciones;
      }
      // Use labs precio if v2 doesn't have one
      if (!existing.precio_publico && lp.precio_publico) {
        existing.precio_publico = lp.precio_publico;
      }
      if (!existing.precio_por_prueba && lp.precio_por_prueba) {
        existing.precio_por_prueba = lp.precio_por_prueba;
      }
      if (!existing.sensitivity && lp.sensitivity) existing.sensitivity = lp.sensitivity;
      if (!existing.specificity && lp.specificity) existing.specificity = lp.specificity;
      if (!existing.sample_type && lp.sample_type) existing.sample_type = lp.sample_type;
      if (!existing.result_time && lp.result_time) existing.result_time = lp.result_time;

    } else {
      // Labs-only product
      lp.target_audience = ['laboratorio'];
      merged.set(key, lp);
    }
  }

  return [...merged.values()];
}

// ─────────────────────────────────────────────
// SQL Generator
// ─────────────────────────────────────────────
function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // Escape single quotes
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function escArr(arr) {
  if (!arr || arr.length === 0) return "'{}'";
  return "ARRAY[" + arr.map(a => esc(a)).join(', ') + "]";
}

function escJson(obj) {
  if (!obj || (Array.isArray(obj) && obj.length === 0)) return "'[]'::jsonb";
  return esc(JSON.stringify(obj)) + '::jsonb';
}

function generateSQL(products) {
  const lines = [];
  lines.push('-- Auto-generated from knowledge base files');
  lines.push('-- Date: 2026-03-22');
  lines.push('-- Products: ' + products.length);
  lines.push('');

  for (const p of products) {
    // Map diagnostic_category from KB category
    let diagCat = p.diagnostic_category || 'otros';

    lines.push(`-- Product: ${p.name}`);
    lines.push(`INSERT INTO medical_products (`);
    lines.push(`  name, diagnostic_category, url_tienda, tipo_producto, marca,`);
    lines.push(`  precio_publico, precio_por_prueba, precio_sugerido_paciente, margen_estimado, presentaciones,`);
    lines.push(`  analito, sample_type, volumen_muestra, result_time, sensitivity, specificity,`);
    lines.push(`  punto_corte, storage_conditions, shelf_life, registro_sanitario,`);
    lines.push(`  clasificacion_clinica, proposito_clinico, especialidades, escenarios_uso,`);
    lines.push(`  perfil_paciente, frecuencia_uso, limitaciones, resultado_positivo, resultado_negativo,`);
    lines.push(`  pitch_medico, pitch_laboratorio, ventaja_vs_lab, roi_medico, porque_agregarlo_lab,`);
    lines.push(`  objeciones_medico, objeciones_laboratorio,`);
    lines.push(`  cross_sells, up_sells, palabras_clave, target_audience,`);
    lines.push(`  is_active, created_at, updated_at`);
    lines.push(`) VALUES (`);
    lines.push(`  ${esc(p.name)}, ${esc(diagCat)}, ${esc(p.url_tienda)}, ${esc(p.tipo_producto)}, 'Amunet',`);
    lines.push(`  ${p.precio_publico || 'NULL'}, ${p.precio_por_prueba || 'NULL'}, ${esc(p.precio_sugerido_paciente)}, ${esc(p.margen_estimado)}, ${escJson(p.presentaciones)},`);
    lines.push(`  ${esc(p.analito)}, ${esc(p.sample_type)}, ${esc(p.volumen_muestra)}, ${esc(p.result_time)}, ${p.sensitivity || 'NULL'}, ${p.specificity || 'NULL'},`);
    lines.push(`  ${esc(p.punto_corte)}, ${esc(p.storage_conditions)}, ${esc(p.shelf_life)}, ${esc(p.registro_sanitario)},`);
    lines.push(`  ${esc(p.clasificacion_clinica)}, ${esc(p.proposito_clinico)}, ${escArr(p.especialidades)}, ${esc(p.escenarios_uso)},`);
    lines.push(`  ${esc(p.perfil_paciente)}, ${esc(p.frecuencia_uso)}, ${esc(p.limitaciones)}, ${esc(p.resultado_positivo)}, ${esc(p.resultado_negativo)},`);
    lines.push(`  ${esc(p.pitch_medico)}, ${esc(p.pitch_laboratorio)}, ${esc(p.ventaja_vs_lab)}, ${esc(p.roi_medico)}, ${esc(p.porque_agregarlo_lab)},`);
    lines.push(`  ${escJson(p.objeciones_medico)}, ${escJson(p.objeciones_laboratorio)},`);
    lines.push(`  ${escJson(p.cross_sells)}, ${escJson(p.up_sells || [])}, ${escArr(p.palabras_clave)}, ${escArr(p.target_audience)},`);
    lines.push(`  TRUE, NOW(), NOW()`);
    lines.push(`)`);
    lines.push(`ON CONFLICT (url_tienda) DO UPDATE SET`);
    lines.push(`  name = EXCLUDED.name,`);
    lines.push(`  diagnostic_category = EXCLUDED.diagnostic_category,`);
    lines.push(`  tipo_producto = COALESCE(EXCLUDED.tipo_producto, medical_products.tipo_producto),`);
    lines.push(`  precio_publico = COALESCE(EXCLUDED.precio_publico, medical_products.precio_publico),`);
    lines.push(`  precio_por_prueba = COALESCE(EXCLUDED.precio_por_prueba, medical_products.precio_por_prueba),`);
    lines.push(`  precio_sugerido_paciente = COALESCE(EXCLUDED.precio_sugerido_paciente, medical_products.precio_sugerido_paciente),`);
    lines.push(`  margen_estimado = COALESCE(EXCLUDED.margen_estimado, medical_products.margen_estimado),`);
    lines.push(`  presentaciones = EXCLUDED.presentaciones,`);
    lines.push(`  analito = COALESCE(EXCLUDED.analito, medical_products.analito),`);
    lines.push(`  sample_type = COALESCE(EXCLUDED.sample_type, medical_products.sample_type),`);
    lines.push(`  volumen_muestra = COALESCE(EXCLUDED.volumen_muestra, medical_products.volumen_muestra),`);
    lines.push(`  result_time = COALESCE(EXCLUDED.result_time, medical_products.result_time),`);
    lines.push(`  sensitivity = COALESCE(EXCLUDED.sensitivity, medical_products.sensitivity),`);
    lines.push(`  specificity = COALESCE(EXCLUDED.specificity, medical_products.specificity),`);
    lines.push(`  punto_corte = COALESCE(EXCLUDED.punto_corte, medical_products.punto_corte),`);
    lines.push(`  storage_conditions = COALESCE(EXCLUDED.storage_conditions, medical_products.storage_conditions),`);
    lines.push(`  shelf_life = COALESCE(EXCLUDED.shelf_life, medical_products.shelf_life),`);
    lines.push(`  registro_sanitario = COALESCE(EXCLUDED.registro_sanitario, medical_products.registro_sanitario),`);
    lines.push(`  clasificacion_clinica = COALESCE(EXCLUDED.clasificacion_clinica, medical_products.clasificacion_clinica),`);
    lines.push(`  proposito_clinico = COALESCE(EXCLUDED.proposito_clinico, medical_products.proposito_clinico),`);
    lines.push(`  especialidades = EXCLUDED.especialidades,`);
    lines.push(`  escenarios_uso = COALESCE(EXCLUDED.escenarios_uso, medical_products.escenarios_uso),`);
    lines.push(`  perfil_paciente = COALESCE(EXCLUDED.perfil_paciente, medical_products.perfil_paciente),`);
    lines.push(`  frecuencia_uso = COALESCE(EXCLUDED.frecuencia_uso, medical_products.frecuencia_uso),`);
    lines.push(`  limitaciones = COALESCE(EXCLUDED.limitaciones, medical_products.limitaciones),`);
    lines.push(`  resultado_positivo = COALESCE(EXCLUDED.resultado_positivo, medical_products.resultado_positivo),`);
    lines.push(`  resultado_negativo = COALESCE(EXCLUDED.resultado_negativo, medical_products.resultado_negativo),`);
    lines.push(`  pitch_medico = COALESCE(EXCLUDED.pitch_medico, medical_products.pitch_medico),`);
    lines.push(`  pitch_laboratorio = COALESCE(EXCLUDED.pitch_laboratorio, medical_products.pitch_laboratorio),`);
    lines.push(`  ventaja_vs_lab = COALESCE(EXCLUDED.ventaja_vs_lab, medical_products.ventaja_vs_lab),`);
    lines.push(`  roi_medico = COALESCE(EXCLUDED.roi_medico, medical_products.roi_medico),`);
    lines.push(`  porque_agregarlo_lab = COALESCE(EXCLUDED.porque_agregarlo_lab, medical_products.porque_agregarlo_lab),`);
    lines.push(`  objeciones_medico = EXCLUDED.objeciones_medico,`);
    lines.push(`  objeciones_laboratorio = EXCLUDED.objeciones_laboratorio,`);
    lines.push(`  cross_sells = EXCLUDED.cross_sells,`);
    lines.push(`  up_sells = EXCLUDED.up_sells,`);
    lines.push(`  palabras_clave = EXCLUDED.palabras_clave,`);
    lines.push(`  target_audience = EXCLUDED.target_audience,`);
    lines.push(`  updated_at = NOW();`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
function main() {
  console.error(`Reading KB files...`);
  console.error(`V2: ${V2_PATH}`);
  console.error(`Labs: ${LABS_PATH}`);

  const v2Content = fs.readFileSync(V2_PATH, 'utf-8');
  const labsContent = fs.readFileSync(LABS_PATH, 'utf-8');

  console.error(`Parsing V2 (médicos)...`);
  const v2Blocks = splitIntoProducts(v2Content);
  const v2Products = v2Blocks.map(parseV2Product);
  console.error(`  Found ${v2Products.length} products in V2`);

  console.error(`Parsing Labs (laboratorios)...`);
  const labsBlocks = splitIntoProducts(labsContent);
  const labsProducts = labsBlocks.map(parseLabsProduct);
  console.error(`  Found ${labsProducts.length} products in Labs`);

  console.error(`Merging...`);
  const merged = mergeProducts(v2Products, labsProducts);
  console.error(`  Total unique products: ${merged.length}`);

  // Log audience distribution
  const both = merged.filter(p => p.target_audience.includes('medico') && p.target_audience.includes('laboratorio'));
  const medicoOnly = merged.filter(p => p.target_audience.includes('medico') && !p.target_audience.includes('laboratorio'));
  const labOnly = merged.filter(p => !p.target_audience.includes('medico') && p.target_audience.includes('laboratorio'));
  console.error(`  Both audiences: ${both.length}`);
  console.error(`  Médico only: ${medicoOnly.length}`);
  console.error(`  Laboratorio only: ${labOnly.length}`);

  // First we need the UNIQUE constraint for upsert
  let sql = '-- First ensure url_tienda has a unique constraint for ON CONFLICT\n';
  sql += 'CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_products_url_unique ON medical_products(url_tienda) WHERE url_tienda IS NOT NULL;\n\n';
  sql += generateSQL(merged);

  console.log(sql);
}

main();
