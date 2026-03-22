/**
 * Authentication & Authorization Middleware
 *
 * JWT-based auth with role hierarchy:
 *   director  → sees everything, manages all agents, global config
 *   gerente   → sees their team's conversations/orders, can approve discounts
 *   operador  → sees only assigned conversations, basic order view
 *
 * Usage:
 *   router.get('/protected', requireAuth, handler)
 *   router.get('/admin-only', requireAuth, requireRole('director'), handler)
 *   router.get('/managers-up', requireAuth, requireRole('gerente'), handler)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type UserRole = 'superadmin' | 'director' | 'gerente' | 'operador';

export interface AuthPayload {
    agent_id: string;
    email: string;
    role: UserRole;
    name: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            agent?: AuthPayload;
        }
    }
}

// Role hierarchy: higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = ['operador', 'gerente', 'director', 'superadmin'];

function roleLevel(role: UserRole): number {
    return ROLE_HIERARCHY.indexOf(role);
}

// Map legacy roles from DB to new hierarchy
function normalizeRole(dbRole: string): UserRole {
    const map: Record<string, UserRole> = {
        admin: 'director',
        supervisor: 'gerente',
        agent: 'operador',
        director: 'director',
        gerente: 'gerente',
        operador: 'operador',
        superadmin: 'superadmin',
    };
    return map[dbRole] || 'operador';
}

// ─────────────────────────────────────────────
// JWT Helpers
// ─────────────────────────────────────────────

function getJWTSecret(): string {
    return process.env.JWT_SECRET || 'crm-botonmedico-default-secret-change-me';
}

export function generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, getJWTSecret(), { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthPayload {
    return jwt.verify(token, getJWTSecret()) as AuthPayload;
}

// ─────────────────────────────────────────────
// Password Hashing (SHA-256 + salt)
// ─────────────────────────────────────────────

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const check = crypto.createHash('sha256').update(salt + password).digest('hex');
    return hash === check;
}

// ─────────────────────────────────────────────
// Middleware: Require Authentication
// ─────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token requerido. Incluye header: Authorization: Bearer <token>' });
        return;
    }

    const token = authHeader.substring(7);

    try {
        const payload = verifyToken(token);
        req.agent = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// ─────────────────────────────────────────────
// Middleware: Require Minimum Role
// ─────────────────────────────────────────────

/**
 * Requires the agent to have at least the specified role.
 * Role hierarchy: operador < gerente < director
 */
export function requireRole(minimumRole: UserRole) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.agent) {
            res.status(401).json({ error: 'No autenticado' });
            return;
        }

        const agentLevel = roleLevel(req.agent.role);
        const requiredLevel = roleLevel(minimumRole);

        if (agentLevel < requiredLevel) {
            res.status(403).json({
                error: 'No tienes permisos para esta acción',
                required_role: minimumRole,
                your_role: req.agent.role,
            });
            return;
        }

        next();
    };
}

// ─────────────────────────────────────────────
// Middleware: Filter by ownership (operador only sees own)
// ─────────────────────────────────────────────

/**
 * For conversation-level routes: if the agent is an operador,
 * ensures they can only access conversations assigned to them.
 * Gerentes see their team. Directors see all.
 */
export function scopeToAgent(req: Request, _res: Response, next: NextFunction): void {
    if (!req.agent) { next(); return; }

    // Superadmins and Directors see everything
    if (req.agent.role === 'superadmin' || req.agent.role === 'director') {
        next();
        return;
    }

    // Gerentes see everything for now (team filtering would need a teams table)
    if (req.agent.role === 'gerente') {
        next();
        return;
    }

    // Operadores: inject their agent_id as a filter
    // Routes should check req.query.scoped_agent_id
    req.query.scoped_agent_id = req.agent.agent_id;
    next();
}

export { normalizeRole };
