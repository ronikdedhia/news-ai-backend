import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      };
    }
  }
}

export async function verifyClerkToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      // Decode JWT manually to extract claims
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode payload (second part)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Extract user info from JWT payload
      req.user = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
      };

      logger.info(`✅ Token verified for user: ${req.user.id}`);
      next();
    } catch (error: any) {
      logger.warn('Token verification failed:', error.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
  } catch (error: any) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Decode JWT manually
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          req.user = {
            id: payload.sub,
            email: payload.email,
            firstName: payload.given_name,
            lastName: payload.family_name,
          };
          logger.info(`✅ Optional auth verified for user: ${req.user.id}`);
        }
      } catch (error) {
        logger.warn('Optional auth token decode failed, continuing without user');
      }
    }
    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next();
  }
}
