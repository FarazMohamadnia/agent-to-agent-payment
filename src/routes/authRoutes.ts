import { Router } from 'express';
import { Role } from '@prisma/client';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas';
import * as authService from '../services/authService';

const router = Router();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role: Role;
    };
    const result = await authService.registerUser(email, password, role);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.loginUser(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
