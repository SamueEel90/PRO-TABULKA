/**
 * Auth.js HTTP handler — exposes /api/auth/* endpoints:
 *   /api/auth/signin            — sign-in page redirect
 *   /api/auth/callback/google   — Google OAuth callback
 *   /api/auth/callback/dev-login — Credentials provider callback
 *   /api/auth/signout           — sign out
 *   /api/auth/session           — get current session JSON
 *   /api/auth/csrf              — CSRF token
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
