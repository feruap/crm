import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
    agentId: string;
    email: string;
    role: 'admin' | 'supervisor' | 'agent';
}

declare global {
    namespace Express {
        interface Request {
            agent?: AuthPayload;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret') as AuthPayload;
        req.agent = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...roles: AuthPayload['role'][]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.agent || !roles.includes(req.agent.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
