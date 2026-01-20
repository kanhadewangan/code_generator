import jwt, { type  JwtPayload } from 'jsonwebtoken';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

export function isAuthenticated(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.header('authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token as string, 
      process.env.JSON_WEB_TOKEN_SECRET as string
    ) as JwtPayload;

    // Optional: attach user to request
    req.userId = decoded.userId; // ✅ FIXED
    
    next(); 
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
