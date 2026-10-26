/** Which services are configured on the server (no secrets), so the app can fall back to test mode. */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      speech: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
      tutor: Boolean(process.env.ANTHROPIC_API_KEY),
      auth: Boolean(process.env.FIREBASE_PROJECT_ID) || process.env.ALLOW_UNAUTHENTICATED === '1',
      model: process.env.TUTOR_MODEL || 'claude-opus-5-5',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
