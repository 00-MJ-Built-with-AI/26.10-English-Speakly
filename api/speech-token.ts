import { errorResponse, HttpError, requireUser } from './_lib/auth.ts';

/**
 * Swaps the Azure Speech key (kept on the server) for a 10-minute token the browser can
 * use for pronunciation scoring, recognition and the tutor's voice.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireUser(request);
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) throw new HttpError(503, 'Azure Speech is not set up yet (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION).');
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' },
    });
    if (!res.ok) throw new HttpError(502, `Azure refused the key (${res.status}). Check the key and region.`);
    const token = await res.text();
    return Response.json({ token, region, expiresAt: Date.now() + 9 * 60_000 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err);
  }
}
