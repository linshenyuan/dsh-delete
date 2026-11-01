import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { lstat, readdir, rm, stat, unlink } from "node:fs/promises";

const SESSION_ID_PATTERN =
  /^(?:session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 单次批量删除允许的最大会话数。
 *
 * 删除不可恢复，上限压到 5，避免手滑清空整个工作区。
 */
const MAX_BATCH = 5;

/** 解析 DSH 主目录：优先 `$DSH_HOME`，回退 `~/.dsh`。 */
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

/**
 * 在 `sessions/<项目>/<会话id>/` 里定位会话目录。
 *
 * @param {string} sessionId - 会话 id。
 * @returns {Promise<{dir: string, project: string, linked: boolean}|null>}
 */
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

/** 删掉 `storages/session_projcache/sessions/<id>.json` 这份投影缓存。 */
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

/** 从 workspace 的置顶/归档名单里摘掉这个会话（对未知 id 是 no-op）。 */
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

/**
 * 创建一个 RPC 处理器。
 *
 * 支持两个端点：
 * - `delete`：删一个会话。
 * - `deleteMany`：删 1~5 个会话，逐个执行，部分失败不中断整批。
 *
 * 两者共用一把「单飞」锁：同一时刻只允许一次删除操作，避免批量与单删并发。
 */
export function createHandler({
  logger = null,
  workspaceRegistry = null,
  notifyRemoved = null,
  getAgents = null,
} = {}) {

  let deleting = false;

  /**
   * 删除单个会话的完整流程。
   *
   * 不抛异常，所有失败都折成 `{ok:false,error}`，方便批量时逐条汇总。
   *
   * @param {string} sessionId - 已通过格式校验的会话 id。
   */
  async function deleteOne(sessionId) {
    let agent;
    try {
      agent = getAgents?.()?.get?.(sessionId);
    } catch (error) {
      logger?.warn?.(`dsh-delete: 查询会话运行状态失败: ${String(error)}`);
    }
    if (agent?.status === "running") {
      logger?.warn?.(`dsh-delete: 拒绝删除正在运行的会话 ${sessionId}`);
      return fail(
        "dsh-delete/session-running",
        "该对话正在运行，请先停止它或切到别的对话再试。",
        { sessionId },
      );
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
  }

  /**
   * 从 payload 里取出并校验会话 id 列表（去重、保序）。
   *
   * @param {unknown} raw - `payload.sessionIds`。
   * @returns {{ids: string[]}|{error: object}}
   */
  function normalizeIds(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
      return { error: fail("dsh-delete/invalid-list", "sessionIds 必须是非空数组") };
    }

    const ids = [];
    for (const value of raw) {
      if (typeof value !== "string" || !SESSION_ID_PATTERN.test(value)) {
        return {
          error: fail("dsh-delete/invalid-session-id", "sessionIds 里有非标准 UUID", {
            sessionId: typeof value === "string" ? value : null,
          }),
        };
      }
      if (!ids.includes(value)) ids.push(value);
    }

    if (ids.length > MAX_BATCH) {
      return {
        error: fail("dsh-delete/too-many", `一次最多删除 ${MAX_BATCH} 个会话`, {
          requested: ids.length,
          max: MAX_BATCH,
        }),
      };
    }

    return { ids };
  }

  return async function handler(endpoint, payload, _signal) {
    if (endpoint === "delete") {
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

      deleting = true;
      try {
        return await deleteOne(sessionId);
      } finally {
        deleting = false;
      }
    }

    if (endpoint === "deleteMany") {
      const normalized = normalizeIds(
        payload !== null && typeof payload === "object" ? payload.sessionIds : undefined,
      );
      if (normalized.error !== undefined) return normalized.error;

      const { ids } = normalized;

      if (deleting) {
        return fail("dsh-delete/busy", "已有删除在进行中，请稍后重试", { count: ids.length });
      }

      deleting = true;
      try {
        const deleted = [];
        const skipped = [];
        for (const sessionId of ids) {
          const result = await deleteOne(sessionId);
          if (result.ok === true) {
            deleted.push(result.value);
          } else {
            skipped.push({
              sessionId,
              code: result.error.code,
              message: result.error.message,
            });
          }
        }

        logger?.info?.(
          `dsh-delete: 批量删除完成，成功 ${deleted.length} 个，跳过 ${skipped.length} 个`,
        );

        return ok({ requested: ids.length, deleted, skipped });
      } finally {
        deleting = false;
      }
    }

    return fail("rpc/not-found", `unknown endpoint ${JSON.stringify(endpoint)}`, {
      endpoint,
    });
  };
}
