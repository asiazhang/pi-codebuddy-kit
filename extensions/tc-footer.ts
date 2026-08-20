/**
 * Custom status footer for pi (developed alongside the tencent-copilot
 * provider, but provider-agnostic — works with any model).
 *
 * Enabled by default; applied on session_start (startup, new, resume,
 * fork, reload) so the footer closure always captures a live ctx
 * (session replacement invalidates the old one). The built-in footer
 * is replaced for the whole session.
 *
 * Layout (single line, ANSI-safe truncation on narrow terminals):
 *
 *   ~/proj  42% █████░░░░░   model-id ⚡high (git-branch)
 *   └─ cwd ─┘  └ context bar ─┘    └─ right-aligned ─┘
 *
 * - Working directory: ~-relative inside $HOME, otherwise the last two
 *   path segments; from ctx.sessionManager.getCwd().
 * - Context bar uses ctx.getContextUsage(). Percent is computed against the
 *   EFFECTIVE window min(contextWindow, EFFECTIVE_CONTEXT_TOKENS): research
 *   (Chroma "context rot", LangWatch compaction study) shows quality degrades
 *   long before large windows fill, so a 1M-token model is treated as 450k.
 *   Color thresholds track pi's auto-compaction trigger
 *   (tokens > window - RESERVE_TOKENS): red at the trigger point of the
 *   effective window, yellow halfway below it. Windows capped by the
 *   450k ceiling relax red to 65% of the effective window.
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

/**
 * Effective-context ceiling (tokens). Research on context rot (Chroma, 18
 * frontier models) and real-world Claude Code traces (LangWatch) shows model
 * quality degrades measurably long before large windows fill; recommended
 * compaction ranges land in 200k–450k. Windows larger than this are capped
 * so the bar reflects usable context, not the marketing number.
 */
const EFFECTIVE_CONTEXT_TOKENS = 450_000

/** pi's default compaction reserve (settings.json: compaction.reserveTokens). */
const RESERVE_TOKENS = 16_384

/**
 * Color thresholds relative to the effective window. Small windows track
 * pi's auto-compaction trigger (tokens > window - RESERVE_TOKENS): red
 * right at it, yellow halfway below. When the window is capped by
 * EFFECTIVE_CONTEXT_TOKENS (e.g. a 1M model treated as 450k), the cap is
 * already conservative, so red relaxes to 65% of the effective window.
 */
function thresholds(effectiveWindow: number): { red: number; yellow: number } {
	const capped = effectiveWindow >= EFFECTIVE_CONTEXT_TOKENS
	const red = capped ? 65 : ((effectiveWindow - RESERVE_TOKENS) / effectiveWindow) * 100
	return { red, yellow: red / 2 }
}

/** Percent of the effective window (0–100), or null when unknown. */
function effectivePercent(tokens: number, contextWindow: number): number | null {
	const eff = Math.min(contextWindow, EFFECTIVE_CONTEXT_TOKENS)
	if (eff <= 0) return null
	return (tokens / eff) * 100
}

/** 10-cell bar, color by context pressure against the given thresholds. */
function contextBar(pct: number, th: { red: number; yellow: number }, theme: Theme): string {
	const filled = Math.round((Math.min(100, pct) / 100) * 10)
	const color = pct >= th.red ? "error" : pct >= th.yellow ? "warning" : "success"
	return theme.fg(color, "█".repeat(filled) + "░".repeat(10 - filled))
}

export default function (pi: ExtensionAPI) {
	const enabled = true
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
					if (usage && usage.tokens !== null && usage.contextWindow > 0) {
						const effWindow = Math.min(usage.contextWindow, EFFECTIVE_CONTEXT_TOKENS)
						const th = thresholds(effWindow)
						const pct = effectivePercent(usage.tokens, usage.contextWindow)
						if (pct !== null) {
							const shown = Math.min(100, Math.round(pct))
							const color = pct >= th.red ? "error" : pct >= th.yellow ? "warning" : "success"
							context = ` ${theme.fg(color, `${shown}%`)} ${contextBar(pct, th, theme)}`
						}
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

	// Re-render the footer when the thinking level changes (Tab, /thinking, model switch).
	pi.on("thinking_level_select", async () => {
		requestFooterRender?.()
	})

	// Re-apply on startup and after session switches/reloads with a fresh ctx.
	pi.on("session_start", async (_event, ctx) => {
		if (enabled && ctx.hasUI) apply(ctx)
	})
}
