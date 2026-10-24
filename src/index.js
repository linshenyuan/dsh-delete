import { createHandler } from "./delete.js";
import { mountRpcRoute } from "./route.js";

export const name = "dsh-delete";

const CHANNEL = "/dsh-delete";

export function apply(ctx, config = {}) {
  void config;

  const logger = ctx.logger ?? null;

  const notifyRemoved = (sessionId) => {
    try {
      ctx.emit("api-session/removed", sessionId);
    } catch (error) {

      logger?.warn?.(`dsh-delete: 广播 api-session/removed 失败: ${String(error)}`);
    }
  };

  ctx.inject(["connection", "webServer"], (panelCtx) => {

    const handler = createHandler({
      logger,
      workspaceRegistry: panelCtx.get("workspaceRegistry") ?? null,
      notifyRemoved,
    });

    panelCtx.effect(
      () =>
        mountRpcRoute({
          webServer: panelCtx.webServer,
          connection: panelCtx.connection,
          channel: CHANNEL,
          handler,
          logger,
        }),
      "dsh-delete: RPC 路由",
    );
    logger?.info?.(`dsh-delete: 删除端点已挂载于 ${CHANNEL}`);
  });
}
