/**
 * Custom status footer for pi (developed alongside the tencent-copilot
 * provider, but provider-agnostic — works with any model).
 *
 * Toggle with /tc-footer. Not enabled by default; the built-in footer
 * stays untouched until you opt in.
 *
 * Layout (single line, ANSI-safe truncation on narrow terminals):
 *
 *   ~/proj  42% █████░░░░░   model-id ⚡high (git-branch)
 *   └─ cwd ─┘  └ context bar ─┘    └─ right-aligned ─┘
 *
 * - Working directory: ~-relative inside $HOME, otherwise the last two
 *   path segments; from ctx.sessionManager.getCwd().
 * - Context bar uses ctx.getContextUsage() and is color-coded by pressure:
 *   green < 60%, yellow < 85%, red >= 85%.
 * - Git branch re-renders reactively via footerData.onBranchChange().
 * - Thinking level (⚡high) shown when the model supports reasoning;
 *   re-renders reactively via the thinking_level_select event.
 * - Re-applied on session_start so the footer closure always captures a
 *   live ctx (session replacement invalidates the old one).
 */

import { isAbsolute, relative, resolve, sep } from "node:path"
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent"
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

/** Shorten cwd for display: ~-relative inside $HOME, otherwise the last two path segments. */
function formatCwd(cwd: string): string {
	const home = process.env.HOME || process.env.USERPROFILE
	if (home) {
		const rel = relative(resolve(home), resolve(cwd))
		const inside = rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
		if (inside) return rel === "" ? "~" : `~${sep}${rel}`
	}
	const segments = resolve(cwd).split(sep).filter(Boolean)
	return segments.slice(-2).join(sep) || sep
}

/** 10-cell bar, color by context pressure: green < 60%, yellow < 85%, red above. */
function contextBar(pct: number, theme: Theme): string {
	const filled = Math.round((pct / 100) * 10)
	const color = pct >= 85 ? "error" : pct >= 60 ? "warning" : "success"
	return theme.fg(color, "█".repeat(filled) + "░".repeat(10 - filled))
}

export default function (pi: ExtensionAPI) {
	let enabled = false
	// Latest render-request callback for the active footer (if any).
	// pi.on subscriptions cannot be removed, so the handler stays for the
	// extension lifetime and only forwards to the current footer.
	let requestFooterRender: (() => void) | null = null

	const apply = (ctx: ExtensionContext) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const dispose = footerData.onBranchChange(() => tui.requestRender())
			requestFooterRender = () => tui.requestRender()
			return {
				dispose() {
					dispose()
					requestFooterRender = null
				},
				invalidate() {},
				render(width: number): string[] {
					const cwd = formatCwd(ctx.sessionManager.getCwd())
					const left = theme.fg("dim", cwd)

					let context = ""
					const usage = ctx.getContextUsage()
					if (usage && usage.percent !== null) {
						const pct = Math.min(100, Math.round(usage.percent))
						const color = pct >= 85 ? "error" : pct >= 60 ? "warning" : "success"
						context = ` ${theme.fg(color, `${pct}%`)} ${contextBar(pct, theme)}`
					}

					const thinking =
						ctx.thinkingLevel && ctx.model?.reasoning
							? ` ${theme.fg("accent", `⚡${ctx.thinkingLevel}`)}`
							: ""

					const branch = footerData.getGitBranch()
					const model = ctx.model?.id ?? "no-model"
					const right = model + thinking + (branch ? theme.fg("dim", ` (${branch})`) : "")

					const pad = " ".repeat(
						Math.max(1, width - visibleWidth(left) - visibleWidth(context) - visibleWidth(right)),
					)
					return [truncateToWidth(left + context + pad + right, width)]
				},
			}
		})
	}

	pi.registerCommand("tc-footer", {
		description: "Toggle the custom status footer (cwd, context, thinking, branch, model)",
		handler: async (_args, ctx) => {
			enabled = !enabled
			if (enabled && ctx.hasUI) {
				apply(ctx)
				ctx.ui.notify("Custom footer enabled", "info")
			} else {
				enabled = false
				ctx.ui.setFooter(undefined)
				if (ctx.hasUI) ctx.ui.notify("Default footer restored", "info")
			}
		},
	})

	// Re-render the footer when the thinking level changes (Tab, /thinking, model switch).
	pi.on("thinking_level_select", async () => {
		requestFooterRender?.()
	})

	// Re-apply after session switches/reloads with a fresh ctx.
	pi.on("session_start", async (_event, ctx) => {
		if (enabled && ctx.hasUI) apply(ctx)
	})
}
