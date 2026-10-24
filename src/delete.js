import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { lstat, readdir, rm, stat, unlink } from "node:fs/promises";

const SESSION_ID_PATTERN =
  /^(?:session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dshHome() {
  const env = process.env.DSH_HOME;
  if (typeof env === "string" && env.trim() !== "") return resolve(env.trim());
  return join(homedir(), ".dsh");
}

function ok(value) {
  return { ok: true, value };
}

function fail(code, message, details = {}) {
  return { ok: false, error: { code, message, details } };
}

async function locateSession(sessionId) {
  const root = join(dshHome(), "sessions");
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name, sessionId);

    const resolved = resolve(candidate);
    if (!resolved.startsWith(root + sep)) continue;
    try {
      const info = await stat(resolved);
      if (!info.isDirectory()) continue;

      const real = await lstat(resolved);
      if (real.isSymbolicLink()) return { dir: resolved, project: entry.name, linked: true };
      return { dir: resolved, project: entry.name, linked: false };
    } catch {

    }
  }
  return null;
}

async function dropProjectionCache(sessionId, logger) {
  const file = join(dshHome(), "storages", "session_projcache", "sessions", `${sessionId}.json`);
  const resolved = resolve(file);
  const root = resolve(join(dshHome(), "storages", "session_projcache", "sessions"));
  if (!resolved.startsWith(root + sep)) return false;
  try {
    await unlink(resolved);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      logger?.warn?.(`dsh-delete: 清理投影缓存失败 (${error?.code ?? "?"}): ${String(error)}`);
    }
    return false;
  }
}

async function forgetInWorkspace(registry, sessionId, logger) {
  if (registry === null || registry === undefined) return;
  for (const method of ["unpinSession", "unarchiveSession"]) {
    try {
      await registry[method]?.(sessionId);
    } catch (error) {
      logger?.warn?.(`dsh-delete: ${method} 失败: ${String(error)}`);
    }
  }
}

export function createHandler({
  logger = null,
  workspaceRegistry = null,
  notifyRemoved = null,
} = {}) {

  let deleting = false;

  return async function handler(endpoint, payload, _signal) {
    if (endpoint !== "delete") {
      return fail("rpc/not-found", `unknown endpoint ${JSON.stringify(endpoint)}`, {
        endpoint,
      });
    }

    const sessionId =
      payload !== null && typeof payload === "object" ? payload.sessionId : undefined;

    if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
      return fail("dsh-delete/invalid-session-id", "sessionId 必须是标准 UUID", {
        sessionId: typeof sessionId === "string" ? sessionId : null,
      });
    }

    if (deleting) {
      return fail("dsh-delete/busy", "已有删除在进行中，请稍后重试", { sessionId });
    }

    const located = await locateSession(sessionId);
    if (located === null) {
      return fail("dsh-delete/not-found", "找不到该会话的磁盘目录", { sessionId });
    }
    if (located.linked) {

      logger?.warn?.(`dsh-delete: 拒绝删除符号链接/junction: ${located.dir}`);
      return fail("dsh-delete/not-a-directory", "该会话目录是符号链接，出于安全考虑拒绝删除", {
        sessionId,
      });
    }

    deleting = true;
    try {
      await rm(located.dir, { recursive: true, force: false, maxRetries: 2 });
    } catch (error) {
      const code = error?.code ?? "UNKNOWN";
      logger?.warn?.(`dsh-delete: 删除会话 ${sessionId} 失败 (${code}): ${String(error)}`);
      return fail(
        "dsh-delete/delete-failed",
        `删除失败（${code}）。如果该对话正在运行，请先切到别的对话再试。`,
        { sessionId, code },
      );
    } finally {
      deleting = false;
    }

    const cacheDropped = await dropProjectionCache(sessionId, logger);
    await forgetInWorkspace(workspaceRegistry, sessionId, logger);

    try {
      notifyRemoved?.(sessionId);
    } catch (error) {
      logger?.warn?.(`dsh-delete: 广播 api-session/removed 失败: ${String(error)}`);
    }

    logger?.info?.(`dsh-delete: 已删除会话 ${sessionId} (${located.dir})`);

    return ok({ deleted: true, sessionId, project: located.project, cacheDropped });
  };
}
