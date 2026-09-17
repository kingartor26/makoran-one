import { Request, Response, NextFunction } from 'express';
import { authService, UserTokenPayload } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: UserTokenPayload;
  tenantId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'دسترسی غیرمجاز: توکن احراز هویت ارسال نشده است (Unauthorized)' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است (Invalid or expired token)' });
  }
}

export function roleGuard(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'سطح دسترسی شما برای این عملیات مجاز نمی‌باشد (Forbidden)' });
      return;
    }
    next();
  };
}
