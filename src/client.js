window.__ModuleLoader__.load({
	id: "dsh-delete",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		const CHANNEL = "/dsh-delete";

		const NS = "dsh-delete";

		const SHORTCUT_ID = "session.delete";

		const SHORTCUT_FALLBACK = { keys: "Ctrl + Alt + D", aria: "Control+Alt+D" };

		const NOOP_HOOK = () => undefined;

		const identitySelector = (value) => value;

		const zh = {
			deleteSession: "删除对话",
			confirmTitle: "删除这个对话？",
			confirmDesc: "「{name}」的会话记录会从磁盘上永久删除，无法恢复。",
			confirmDescUnnamed: "这个对话还没有名字，它的会话记录会从磁盘上永久删除，无法恢复。",
			confirmHint: "如果对话正在运行，请先切到别的对话再删。",
			deleting: "正在删除…",
			delete: "删除",
			cancel: "取消",
			close: "关闭",
			noSession: "没有可删除的对话",
			failed: "删除失败",
		};

		const en = {
			deleteSession: "Delete conversation",
			confirmTitle: "Delete this conversation?",
			confirmDesc: "\u201c{name}\u201d will be permanently removed from disk. This cannot be undone.",
			confirmDescUnnamed: "This conversation will be permanently removed from disk. This cannot be undone.",
			confirmHint: "If the conversation is running, switch to another one first.",
			deleting: "Deleting…",
			delete: "Delete",
			cancel: "Cancel",
			close: "Close",
			noSession: "No conversation to delete",
			failed: "Delete failed",
		};

		function format(template, params) {
			if (params === undefined || params === null) return template;
			return template.replace(/\{(\w+)\}/g, (whole, key) =>
				Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole,
			);
		}

		function makeFallbackTranslator(dict) {
			return (key, params) => format(dict[key] ?? key, params);
		}

		function makeTranslator(slotT) {
			if (typeof slotT !== "function") return makeFallbackTranslator(zh);
			return (key, params) => {
				let out;
				try {
					out = slotT(key, params);
				} catch {
					out = undefined;
				}
				if (typeof out === "string" && out !== "" && out !== key) return out;
				return format(zh[key] ?? key, params);
			};
		}

		function createSnapshotStore(initial) {
			let value = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => value,
				subscribe: (fn) => {
					listeners.add(fn);
					return () => listeners.delete(fn);
				},
				set: (next) => {
					if (Object.is(value, next)) return;
					value = next;
					for (const fn of listeners) fn();
				},
			};
		}

		const pending = createSnapshotStore(null);

		const CSS = `
.dsh-del-menu-wrap{position:relative}
.dsh-del-menu-sep{height:.5px;margin:3px 2px;background:var(--dsw-alias-border-l2)}
.dsh-del-menu-item{display:flex;align-items:center;gap:6px;width:100%;min-height:34px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-md);background:transparent;cursor:pointer;font-family:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary);text-align:left}
.dsh-del-menu-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dsh-del-menu-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);outline:none}
.dsh-del-menu-item:disabled{opacity:.4;cursor:not-allowed}
.dsh-del-menu-icon{display:inline-flex;flex:none;width:14px;height:14px;align-items:center;justify-content:center;color:inherit}
.dsh-del-menu-icon svg{width:14px;height:14px}
.dsh-del-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-del-menu-keys{flex:none;margin-inline-start:auto;color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}

.dsh-del-modal-root{pointer-events:auto;position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px}
.dsh-del-modal-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}
.dsh-del-modal{box-sizing:border-box;position:relative;z-index:1;display:flex;flex-direction:column;width:min(400px,100%);border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-elevation-prominent);overflow:hidden}
.dsh-del-modal:focus{outline:none}
.dsh-del-modal-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:22px 14px 12px 24px}
.dsh-del-modal-title{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.dsh-del-modal-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;cursor:pointer;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:15px;line-height:1}
.dsh-del-modal-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-del-modal-body{display:flex;flex-direction:column;gap:8px;padding:0 24px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-del-modal-hint{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.dsh-del-modal-error{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px;word-break:break-word}
.dsh-del-modal-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:24px}
.dsh-del-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;height:36px;padding:0 14px;border:none;border-radius:var(--dsw-radius-md);cursor:pointer;font-family:inherit;font-size:14px;line-height:22px}
.dsh-del-btn:disabled{cursor:not-allowed;opacity:.4}
.dsh-del-btn-outline{border:.5px solid var(--dsw-alias-border-l3);background:transparent;color:var(--dsw-alias-label-primary)}
.dsh-del-btn-outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-del-btn-danger{border:.5px solid var(--dsw-alias-state-error-primary);background:transparent;color:var(--dsw-alias-state-error-primary)}
.dsh-del-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
`;

		function TrashIcon() {
			return h(
				"svg",
				{ viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" },
				h("path", {
					fill: "currentColor",
					d: "M6.5 2h3a1 1 0 0 1 1 1v1h2.25a.5.5 0 0 1 0 1H12.5v8.5A1.5 1.5 0 0 1 11 15H5a1.5 1.5 0 0 1-1.5-1.5V5H2.25a.5.5 0 0 1 0-1H4.5V3a1 1 0 0 1 1-1Zm0 1v1h3V3h-3ZM4.5 5v8.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V5h-7Z",
				}),
			);
		}

		function DeleteSessionMenuItem(props) {
			const { sessionId, displayTitle, useMenuOpenState, useShortcuts, requestDelete } = props;
			const t = makeTranslator(props.t);

			const useMenu = typeof useMenuOpenState === "function" ? useMenuOpenState : NOOP_HOOK;
			const menuState = useMenu();
			const setMenuOpen =
				Array.isArray(menuState) && typeof menuState[1] === "function" ? menuState[1] : null;

			const useShortcutRow = typeof useShortcuts === "function" ? useShortcuts : NOOP_HOOK;
			const row = useShortcutRow((rows) =>
				Array.isArray(rows) ? rows.find((item) => item.id === SHORTCUT_ID) : undefined,
			);
			const keys =
				row !== undefined && row !== null && typeof row.keys === "string" && row.keys !== ""
					? row.keys
					: SHORTCUT_FALLBACK.keys;

			return h(
				"div",
				{ className: "dsh-del-menu-wrap" },
				h("div", { className: "dsh-del-menu-sep", role: "separator" }),
				h(
					"button",
					{
						type: "button",
						role: "menuitem",
						className: "dsh-del-menu-item",
						"aria-keyshortcuts": SHORTCUT_FALLBACK.aria,
						onClick: () => {
							if (setMenuOpen !== null) setMenuOpen(false);
							requestDelete(sessionId, displayTitle);
						},
					},
					h("span", { className: "dsh-del-menu-icon" }, h(TrashIcon, {})),
					h("span", { className: "dsh-del-menu-label" }, t("deleteSession")),
					h("span", { className: "dsh-del-menu-keys", "aria-hidden": "true" }, keys),
				),
			);
		}

		function DeleteConfirmDialog(props) {
			const { settleDelete, deleteSession } = props;
			const t = makeTranslator(props.t);

			const usePending =
				typeof props.usePendingDelete === "function" ? props.usePendingDelete : NOOP_HOOK;
			const request = usePending(identitySelector);

			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState(null);
			const lastId = React.useRef(null);
			const dialogRef = React.useRef(null);
			const busyRef = React.useRef(false);

			const sessionId = request === null || request === undefined ? null : request.sessionId;
			const open = typeof sessionId === "string" && sessionId !== "";

			React.useEffect(() => {
				if (sessionId !== lastId.current) {
					lastId.current = sessionId;
					busyRef.current = false;
					setBusy(false);
					setError(null);
				}
			}, [sessionId]);

			React.useEffect(() => {
				if (!open) return undefined;
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					event.stopPropagation();
					if (busyRef.current) return;
					pending.set(null);
				};
				document.addEventListener("keydown", onKeyDown, true);
				const node = dialogRef.current;
				if (node !== null && typeof node.focus === "function") node.focus();
				return () => document.removeEventListener("keydown", onKeyDown, true);
			}, [open]);

			if (!open) return null;

			const title = typeof request.title === "string" ? request.title.trim() : "";
			const close = () => {
				if (busyRef.current) return;
				if (typeof settleDelete === "function") settleDelete();
				else pending.set(null);
			};
			const confirm = () => {
				if (busyRef.current) return;
				busyRef.current = true;
				setBusy(true);
				setError(null);
				Promise.resolve()
					.then(() => deleteSession(sessionId))
					.then(
						() => {
							busyRef.current = false;
							setBusy(false);
							if (typeof settleDelete === "function") settleDelete();
							else pending.set(null);

						},
						(reason) => {
							busyRef.current = false;
							setBusy(false);
							setError(reason instanceof Error ? reason.message : String(reason));
						},
					);
			};

			return h(
				"div",
				{ className: "dsh-del-modal-root", role: "presentation" },
				h("div", { className: "dsh-del-modal-mask", "aria-hidden": "true", onClick: close }),
				h(
					"div",
					{
						ref: dialogRef,
						className: "dsh-del-modal",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": t("confirmTitle"),
						tabIndex: -1,
					},
					h(
						"div",
						{ className: "dsh-del-modal-header" },
						h("h2", { className: "dsh-del-modal-title" }, t("confirmTitle")),
						h(
							"button",
							{
								type: "button",
								className: "dsh-del-modal-close",
								"aria-label": t("close"),
								onClick: close,
							},
							"\u00d7",
						),
					),
					h(
						"div",
						{ className: "dsh-del-modal-body" },
						h(
							"div",
							null,
							title === "" ? t("confirmDescUnnamed") : t("confirmDesc", { name: title }),
						),
						h("div", { className: "dsh-del-modal-hint" }, t("confirmHint")),
						error === null
							? null
							: h("div", { className: "dsh-del-modal-error", role: "alert" }, t("failed") + "：" + error),
					),
					h(
						"div",
						{ className: "dsh-del-modal-footer" },
						h(
							"button",
							{
								type: "button",
								className: "dsh-del-btn dsh-del-btn-outline",
								disabled: busy,
								onClick: close,
							},
							t("cancel"),
						),
						h(
							"button",
							{
								type: "button",
								className: "dsh-del-btn dsh-del-btn-danger",
								disabled: busy,
								onClick: confirm,
							},
							busy ? t("deleting") : t("delete"),
						),
					),
				),
			);
		}

		const inject = ["slots", "locale", "shortcuts"];

		function apply(ctx) {
			const fail = (step, error) => {
				console.error("[dsh-delete] " + step + " 失败:", error);
			};

			try {
				ctx.effect(() => {
					const style = document.createElement("style");
					style.setAttribute("data-dsh-delete", "");
					style.textContent = CSS;
					document.head.appendChild(style);
					return () => style.remove();
				}, "dsh-delete: styles");
			} catch (error) {
				fail("注入样式", error);
			}

			let t = makeFallbackTranslator(zh);
			try {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-delete: dictionaries");
				t = makeTranslator(ctx.locale.bind(NS));
			} catch (error) {
				fail("注册词典", error);
				t = makeFallbackTranslator(zh);
			}

			const call = async (endpoint, payload) => {
				const connection = ctx.get("connection");
				if (connection === undefined || connection === null) {
					throw new Error(t("failed"));
				}
				const result = await connection.rpc.call(CHANNEL, endpoint, payload);
				if (result !== null && result !== undefined && result.ok === true) return result.value;
				throw new Error(result?.error?.message ?? t("failed"));
			};

			const requestDelete = (sessionId, title) => {
				if (typeof sessionId !== "string" || sessionId === "") return;
				pending.set({ sessionId, title });
			};

			const menuInjected = () => ({ requestDelete });

			const dialogInjected = () => ({
				deleteSession: (sessionId) => call("delete", { sessionId }),
				settleDelete: () => pending.set(null),
				hooks: { pendingDelete: pending },
			});

			try {
				ctx.slots.inject("sidebar.workspaces.session.menu.item", () =>
					ctx.slots.register(
						{
							name: "sidebar.workspaces.session.menu.item",
							id: "dsh-delete.session-delete",
							order: 500,
							locale: NS,
							inject: menuInjected,
						},
						DeleteSessionMenuItem,
					),
				);
			} catch (error) {
				fail("注册菜单项", error);
			}

			try {
				ctx.slots.inject("shell.overlay", () =>
					ctx.slots.register(
						{
							name: "shell.overlay",
							id: "dsh-delete.confirm",
							locale: NS,
							inject: dialogInjected,
						},
						DeleteConfirmDialog,
					),
				);
			} catch (error) {
				fail("注册确认框", error);
			}

			const currentSession = () => {
				const sessions = ctx.get("sessions");
				if (sessions === undefined || sessions === null) return undefined;
				const snapshot = sessions.list.getSnapshot();
				if (snapshot === null || snapshot === undefined || snapshot.byId === undefined) {
					return undefined;
				}
				return Object.values(snapshot.byId).find(
					(row) => (row.retainedBy?.mainView ?? 0) > 0,
				);
			};

			try {
				ctx.effect(() => {
					try {
						return ctx.shortcuts.register({
							id: SHORTCUT_ID,
							label: () => t("deleteSession"),
							aliases: ["delete session", "delete conversation"],
							defaults: {
								"desktop:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
								"desktop:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
								"desktop:linux": { code: "KeyD", modifiers: ["primary", "alt"] },
								"web:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
								"web:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
							},

							regions: ["page"],
							modals: [],
							resolve: (context) => {
								const target = currentSession();
								if (target === undefined || target.blank === true) {
									return { status: "blocked", reason: t("noSession") };
								}
								if (context.modal !== null && context.modal !== undefined) {
									return { status: "blocked", reason: t("noSession") };
								}
								return {
									status: "handled",
									run: () => requestDelete(target.id, target.title),
								};
							},
						});
					} catch (error) {

						console.error("[dsh-delete] 快捷键注册失败（菜单项仍然可用）:", error);
						return () => {};
					}
				}, "dsh-delete: 快捷键");
			} catch (error) {
				fail("安装快捷键", error);
			}

			console.info("[dsh-delete] 已挂载：菜单项 + 确认框 + Ctrl+Alt+D");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
