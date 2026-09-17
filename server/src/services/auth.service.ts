import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbService } from '../database/db';

const JWT_SECRET = process.env.JWT_SECRET || 'makoran-guard-super-secret-key-2026';
const JWT_EXPIRES_IN = '24h';

export interface UserTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  fullName: string;
}

export class AuthService {
  generateToken(payload: UserTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token: string): UserTokenPayload {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  }

  async login(email: string, passwordPlain: string): Promise<{ token: string; user: any }> {
    const user = dbService.queryOne(
      'SELECT id, tenant_id, email, password_hash, full_name, role, phone, status FROM users WHERE email = ? AND status = ?',
      [email, 'ACTIVE']
    );

    if (!user) {
      throw new Error('نام کاربری یا رمز عبور نامعتبر است (Invalid credentials)');
    }

    const isValid = bcrypt.compareSync(passwordPlain, user.password_hash);
    if (!isValid) {
      throw new Error('نام کاربری یا رمز عبور نامعتبر است (Invalid credentials)');
    }

    const tokenPayload: UserTokenPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      fullName: user.full_name
    };

    const token = this.generateToken(tokenPayload);

    // Get tenant info
    const tenant = dbService.queryOne('SELECT id, name, slug, plan FROM tenants WHERE id = ?', [user.tenant_id]);

    // Log audit
    dbService.run(
      'INSERT INTO audit_logs (id, tenant_id, user_id, action, resource, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['aud-' + Date.now(), user.tenant_id, user.id, 'USER_LOGIN', 'AUTH', JSON.stringify({ email }), new Date().toISOString()]
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        tenantId: user.tenant_id,
        tenantName: tenant ? tenant.name : 'Makoran Guard'
      }
    };
  }
}

export const authService = new AuthService();
