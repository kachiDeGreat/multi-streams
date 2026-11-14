import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const host = process.env.VITE_RELAY_HOST || "16.170.180.150";
    const response = await fetch(`http://${host}/stat?t=${Date.now()}`);
    if (!response.ok) {
      return res.status(response.status).send("<rtmp></rtmp>");
    }
    const xml = await response.text();
    res.setHeader("Content-Type", "text/xml");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
    return res.status(200).send(xml);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Relay stat fetch failed" });
  }
}
