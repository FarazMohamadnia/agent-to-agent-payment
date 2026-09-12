import { registerUser, loginUser, hashPassword, verifyPassword } from '../../src/services/authService';
import { signAccessToken } from '../../src/middleware/auth';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import { Role } from '@prisma/client';
import { resetDatabase } from '../helpers';
import { AppError } from '../../src/utils/errors';

describe('Auth service', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('hashes passwords with bcrypt', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toEqual('Password123!');
    await expect(verifyPassword('Password123!', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('registers a user and returns a JWT', async () => {
    const result = await registerUser('p@example.com', 'Password123!', Role.PROVIDER);
    expect(result.user.email).toBe('p@example.com');
    expect(result.user.role).toBe(Role.PROVIDER);
    const payload = jwt.verify(result.token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe(result.user.id);
    expect(payload.role).toBe(Role.PROVIDER);
  });

  it('rejects duplicate email', async () => {
    await registerUser('dup@example.com', 'Password123!', Role.BUYER);
    await expect(
      registerUser('dup@example.com', 'Password123!', Role.BUYER),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('logs in with valid credentials', async () => {
    await registerUser('buyer@example.com', 'Password123!', Role.BUYER);
    const result = await loginUser('buyer@example.com', 'Password123!');
    expect(result.token).toBeTruthy();
  });

  it('rejects invalid login', async () => {
    await registerUser('buyer@example.com', 'Password123!', Role.BUYER);
    await expect(loginUser('buyer@example.com', 'wrong')).rejects.toBeInstanceOf(AppError);
  });

  it('issues and verifies JWT via signAccessToken', () => {
    const token = signAccessToken({
      id: 'user-1',
      email: 'a@b.com',
      role: Role.ADMIN,
    });
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe(Role.ADMIN);
  });
});
