import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Google's public keys for Firebase ID tokens. */
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Checks the Firebase sign-in token on a request, so only signed-in users (and only the
 * accounts in ALLOWED_EMAILS, when set) can spend the Azure and Anthropic keys.
 */
export async function requireUser(request: Request): Promise<{ uid: string; email?: string }> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    if (process.env.ALLOW_UNAUTHENTICATED === '1' && process.env.VERCEL !== '1') return { uid: 'local' };
    throw new HttpError(503, 'Server is not set up yet: FIREBASE_PROJECT_ID is missing.');
  }
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please sign in.');
  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    }));
  } catch {
    throw new HttpError(401, 'Your sign-in expired. Please sign in again.');
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && (!email || !allowed.includes(email) || payload.email_verified !== true)) {
    throw new HttpError(403, 'This Google account is not allowed to use Speakly.');
  }
  return { uid: String(payload.sub), email };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: 'Something went wrong on the server.' }, { status: 500 });
}
