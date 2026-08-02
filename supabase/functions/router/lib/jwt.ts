import jwt from 'npm:jsonwebtoken';
import { config } from './config.ts';
import type { JwtClaims, Role } from './types.ts';

export function signJwt(payload: { sub: string; role: Role; email?: string | null }, expiresIn = config.jwtExpiresIn): string {
  return jwt.sign({ ...payload, sub: payload.sub }, config.jwtSecret, { expiresIn });
}

export function verifyJwt(token: string): JwtClaims {
  return jwt.verify(token, config.jwtSecret) as JwtClaims;
}
