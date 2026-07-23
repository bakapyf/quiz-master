export default async function handler(req: any, res: any) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url param" });

  try {
    const headers: Record<string, string> = {};
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }

    const fetchRes = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === "PUT" ? req.body : undefined,
    });

    res.status(fetchRes.status);

    const contentType = fetchRes.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);

    if (fetchRes.status === 207) {
      const text = await fetchRes.text();
      res.setHeader("content-type", "application/xml");
      return res.send(text);
    }

    const body = await fetchRes.arrayBuffer();
    return res.send(Buffer.from(body));
  } catch (e: any) {
    return res.status(502).json({ error: e.message });
  }
}
