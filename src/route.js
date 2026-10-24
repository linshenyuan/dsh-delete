const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;

const INVALID_REQUEST_RPC_ID = "invalid-request";

const DEFAULT_MAX_REQUEST_BODY_BYTES = 64 * 1024;

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

export function endpointFromPath(channel, pathname) {
  if (!pathname.startsWith(`${channel}/`)) return undefined;
  const endpoint = pathname.slice(channel.length + 1);
  if (
    endpoint
      .split("/")
      .some(
        (segment) =>
          segment === "" ||
          segment === "." ||
          segment === ".." ||
          !ENDPOINT_SEGMENT_PATTERN.test(segment),
      )
  ) {
    return undefined;
  }
  return endpoint;
}

function validClientRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return undefined;
  if (body.type !== "client-request") return undefined;
  if (typeof body.rpcId !== "string") return undefined;
  if (typeof body.method !== "string") return undefined;
  return { rpcId: body.rpcId, method: body.method, payload: body.payload };
}

function fullResponse(rpcId, result) {
  return Response.json({ type: "server-response", rpcId, result });
}

function errorResponse(rpcId, error) {
  return fullResponse(rpcId, { ok: false, error });
}

function invalidEnvelopeResponse(body) {
  const rawId = body !== null && typeof body === "object" ? body.rpcId : undefined;
  return errorResponse(typeof rawId === "string" ? rawId : INVALID_REQUEST_RPC_ID, {
    code: "gateway/bad-request",
    message: "invalid client-request message",
    details: { issues: [] },
  });
}

export function rpcFetchHandler(channel, handler) {
  return {
    requestBodyMode: () => "buffered",
    async fetch(request) {
      const endpoint = endpointFromPath(channel, new URL(request.url).pathname);
      if (request.method !== "POST" || endpoint === undefined) {
        return new Response("not found", { status: 404 });
      }
      if (
        request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
        "application/json"
      ) {
        return new Response("content type must be application/json", { status: 415 });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("body is not JSON", { status: 400 });
      }

      const envelope = validClientRequest(body);
      if (envelope === undefined) return invalidEnvelopeResponse(body);
      if (envelope.method !== endpoint) {
        return errorResponse(envelope.rpcId, {
          code: "gateway/bad-request",
          message: `method ${JSON.stringify(envelope.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
          details: { issues: [] },
        });
      }

      try {
        const result = await handler(endpoint, envelope.payload, request.signal);
        return fullResponse(envelope.rpcId, result);
      } catch (error) {

        return new Response(`handler failure: ${String(error)}`, { status: 500 });
      }
    },
  };
}

export async function httpBridge(req, res, fetchHandler, maxRequestBodyBytes) {
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  const declaredLength = req.headers["content-length"];
  if (declaredLength !== undefined && Number(declaredLength) > maxRequestBodyBytes) {
    res.writeHead(413, { connection: "close" });
    res.end();
    req.destroy();
    return;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > maxRequestBodyBytes) {
      res.writeHead(413, { connection: "close" });
      res.end();
      req.destroy();
      return;
    }
    chunks.push(buffer);
  }

  const url = new URL(req.url ?? "/", "http://dsh.internal");
  const request = new Request(url, {
    method: req.method ?? "GET",
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([, value]) => typeof value === "string"),
    ),
    ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
    signal: abort.signal,
  });

  const response = await fetchHandler.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body === null) {
    res.end();
    return;
  }
  for await (const chunk of response.body) {
    if (!res.write(chunk)) {
      await new Promise((resolve) => {
        const done = () => {
          res.off("drain", done);
          res.off("close", done);
          resolve();
        };
        res.once("drain", done);
        res.once("close", done);
      });
    }
    if (res.writableEnded) break;
  }
  res.end();
}

function isTrustedLoopbackRequest(req) {
  const host = req.headers?.host;
  if (typeof host !== "string") return false;
  if (!LOOPBACK_HOSTNAMES.has(host.split(":")[0])) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function mountRpcRoute({
  webServer,
  connection = undefined,
  channel,
  handler,
  logger = null,
  maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
}) {
  const fetchHandler = rpcFetchHandler(channel, handler);
  const route = {
    kind: "prefix",
    path: channel,
    handler: async (req, res) => {
      let rejection;
      if (typeof connection?.requestRejection === "function") {
        try {
          rejection = connection.requestRejection(req);
        } catch (error) {
          logger?.warn?.(`dsh-delete: 请求栅栏判定失败，按拒绝处理: ${String(error)}`);
          rejection = 403;
        }
      } else if (!isTrustedLoopbackRequest(req)) {
        rejection = 403;
      }
      if (rejection !== undefined) {
        res.writeHead(rejection, { "content-type": "text/plain; charset=utf-8" });
        res.end(rejection === 401 ? "unauthorized" : "forbidden");
        return;
      }

      try {
        await httpBridge(req, res, fetchHandler, maxRequestBodyBytes);
      } catch (error) {
        logger?.warn?.(`dsh-delete: RPC 桥接失败: ${String(error)}`);
        if (!res.writableEnded) {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end("bridge failure");
        }
      }
    },
  };

  const registered = webServer.register(route);
  return typeof registered === "function" ? registered : () => {};
}
