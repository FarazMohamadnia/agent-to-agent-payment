import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { signAccessToken } from '../middleware/auth';

export async function registerUser(email: string, password: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
  const user = await prisma.user.create({
    data: { email, passwordHash, role },
  });

  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return {
    user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return {
    user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
    token,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
