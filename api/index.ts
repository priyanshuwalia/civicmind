import app from "../server.js";

export default function handler(req: any, res: any) {
  const pathParam = req.query?.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam;

  if (typeof path === "string" && path.length > 0) {
    const url = new URL(req.url || "/", "http://localhost");
    url.searchParams.delete("path");

    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
