import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '@/utils/response';
import {
  registerUser,
  verifyEmail,
  resendVerification,
  loginWithPassword,
  refreshAuthToken,
  logout,
  logoutAllDevices,
  sendForgotPassword,
  resetPassword,
  handleOAuthLogin,
} from '@/auth/services/auth.service';
import { SessionInfo } from '@/auth/services/auth.service';
import { OAuthProvider } from '@prisma/client';
import { config } from '@/config';
import { AuthenticationError } from '@/utils/errors';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, username, email, password } = req.body;
      const result = await registerUser({ name, username, email, password, tenantId: req.tenantId });
      apiResponse.created(res, result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      await verifyEmail(token);
      apiResponse.success(res, { message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await resendVerification(email);
      apiResponse.success(res, { message: 'Verification email resent' });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const sessionInfo: SessionInfo = {
        device: req.headers['sec-ch-ua-platform'] as string,
        browser: req.headers['user-agent'] as string,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      };
      const tokens = await loginWithPassword({ email, password, session: sessionInfo });
      apiResponse.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      const sessionInfo: SessionInfo = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      };
      const tokens = await refreshAuthToken(refreshToken, sessionInfo);
      apiResponse.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.body.sessionId || req.authSessionId;
      if (!req.authUser?.id) {
        throw new AuthenticationError('Authentication required');
      }
      await logout(sessionId as string, req.authUser.id);
      apiResponse.success(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await logoutAllDevices(req.authUser?.id as string);
      apiResponse.success(res, { message: 'All sessions revoked' });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await sendForgotPassword(email);
      apiResponse.success(res, { message: 'Password reset email sent if the email exists' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      await resetPassword(token, password);
      apiResponse.success(res, { message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const redirectUri = encodeURIComponent(config.oauth.google.redirectUri);
      const scope = encodeURIComponent('openid email profile');
      const state = encodeURIComponent(req.query.state as string || 'default');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.oauth.google.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&state=${state}`;
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  async githubAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = encodeURIComponent(req.query.state as string || 'default');
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${config.oauth.github.clientId}&redirect_uri=${encodeURIComponent(config.oauth.github.redirectUri)}&scope=user:email&state=${state}`;
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string | undefined;
      if (!code) {
        throw new AuthenticationError('OAuth code is required');
      }

      const sessionInfo: SessionInfo = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      };

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.oauth.google.clientId,
          client_secret: config.oauth.google.clientSecret,
          redirect_uri: config.oauth.google.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        throw new AuthenticationError('Unable to exchange Google OAuth code');
      }

      const tokenData = await response.json() as { access_token?: string };
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        throw new AuthenticationError('Unable to load Google profile');
      }

      const profile = await userResponse.json() as { email?: string; name?: string; picture?: string };
      const tokens = await handleOAuthLogin(OAuthProvider.GOOGLE, profile.email || code, {
        email: profile.email || '',
        name: profile.name,
        avatarUrl: profile.picture,
      }, sessionInfo);
      apiResponse.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }

  async githubCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string | undefined;
      if (!code) {
        throw new AuthenticationError('OAuth code is required');
      }

      const sessionInfo: SessionInfo = {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      };

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.oauth.github.clientId,
          client_secret: config.oauth.github.clientSecret,
          code,
          redirect_uri: config.oauth.github.redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        throw new AuthenticationError('Unable to exchange GitHub OAuth code');
      }

      const tokenData = await tokenResponse.json() as { access_token?: string };
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
      });

      if (!userResponse.ok) {
        throw new AuthenticationError('Unable to load GitHub profile');
      }

      const profile = await userResponse.json() as { email?: string; login?: string; name?: string; avatar_url?: string };
      const tokens = await handleOAuthLogin(OAuthProvider.GITHUB, profile.login || code, {
        email: profile.email || `${profile.login}@github.local`,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
      }, sessionInfo);
      apiResponse.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
