/**
 * Custom status footer for pi (developed alongside the tencent-copilot
 * provider, but provider-agnostic — works with any model).
 *
 * Toggle with /tc-footer. Not enabled by default; the built-in footer
 * stays untouched until you opt in.
 *
 * Layout (single line, ANSI-safe truncation on narrow terminals):
 *
 *   ↑in ↓out  42% █████░░░░░   model-id ⚡high (git-branch)
 *   └─ session token totals ─┘└ context bar ─┘    └─ right-aligned ─┘
 *
 * - Token totals come from assistant messages on the current session branch.
 * - Context bar uses ctx.getContextUsage() and is color-coded by pressure:
 *   green < 60%, yellow < 85%, red >= 85%.
 * - Git branch re-renders reactively via footerData.onBranchChange().
 * - Thinking level (⚡high) shown when the model supports reasoning;
 *   re-renders reactively via the thinking_level_select event.
 * - Re-applied on session_start so the footer closure always captures a
 *   live ctx (session replacement invalidates the old one).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const STATUS_KEY = "tc-footer";

function fmtTokens(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

/** 10-cell bar, color by context pressure: green < 60%, yellow < 85%, red above. */
function contextBar(pct: number, theme: Theme): string {
	const filled = Math.round((pct / 100) * 10);
	const color = pct >= 85 ? "error" : pct >= 60 ? "warning" : "success";
	return theme.fg(color, "█".repeat(filled) + "░".repeat(10 - filled));
}

export default function (pi: ExtensionAPI) {
	let enabled = false;
	// Latest render-request callback for the active footer (if any).
	// pi.on subscriptions cannot be removed, so the handler stays for the
	// extension lifetime and only forwards to the current footer.
	let requestFooterRender: (() => void) | null = null;

	const apply = (ctx: ExtensionContext) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const dispose = footerData.onBranchChange(() => tui.requestRender());
			requestFooterRender = () => tui.requestRender();
			return {
				dispose() {
					dispose();
					requestFooterRender = null;
				},
				invalidate() {},
				render(width: number): string[] {
					// Session token totals from assistant messages.
					let input = 0;
					let output = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message?.role === "assistant" && e.message.usage) {
							input += e.message.usage.input;
							output += e.message.usage.output;
						}
					}

					const left = theme.fg("dim", `↑${fmtTokens(input)} ↓${fmtTokens(output)}`);

					let context = "";
					const usage = ctx.getContextUsage();
					if (usage && usage.percent !== null) {
						const pct = Math.min(100, usage.percent);
						context = ` ${theme.fg("dim", `${pct}%`)} ${contextBar(pct, theme)}`;
					}

					const thinking =
						ctx.thinkingLevel && ctx.model?.reasoning
							? ` ${theme.fg("accent", `⚡${ctx.thinkingLevel}`)}`
							: "";

					const branch = footerData.getGitBranch();
					const right = theme.fg(
						"dim",
						`${ctx.model?.id ?? "no-model"}${thinking}${branch ? ` (${branch})` : ""}`,
					);

					const pad = " ".repeat(
						Math.max(1, width - visibleWidth(left) - visibleWidth(context) - visibleWidth(right)),
					);
					return [truncateToWidth(left + context + pad + right, width)];
				},
			};
		});
	};

	pi.registerCommand("tc-footer", {
		description: "Toggle the custom status footer (tokens, context, thinking, branch, model)",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled && ctx.hasUI) {
				apply(ctx);
				ctx.ui.notify("Custom footer enabled", "info");
			} else {
				enabled = false;
				ctx.ui.setFooter(undefined);
				if (ctx.hasUI) ctx.ui.notify("Default footer restored", "info");
			}
		},
	});

	// Re-render the footer when the thinking level changes (Tab, /thinking, model switch).
	pi.on("thinking_level_select", async () => {
		requestFooterRender?.();
	});

	// Re-apply after session switches/reloads with a fresh ctx.
	pi.on("session_start", async (_event, ctx) => {
		if (enabled && ctx.hasUI) apply(ctx);
	});
}
