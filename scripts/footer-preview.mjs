/**
 * Preview the tc-footer layout in the terminal without a live session.
 *
 * Usage:
 *   node scripts/footer-preview.mjs [columns]
 *
 * Renders the exact same logic as extensions/tc-footer.ts (cwd shortening,
 * effective-window percent, dynamic color thresholds, colors) for a few
 * representative states, using the real pi theme (dark by default,
 * PI_THEME to override).
 */

import { relative, resolve, sep } from "node:path"
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

const themeMod = await import(
	"../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"
)
const theme = themeMod.getThemeByName(process.env.PI_THEME || "dark")
if (!theme) throw new Error(`theme "${process.env.PI_THEME || "dark"}" not found`)

/** Mirror of EFFECTIVE_CONTEXT_TOKENS in extensions/tc-footer.ts — keep in sync. */
const EFFECTIVE_CONTEXT_TOKENS = 450_000

/** Mirror of RESERVE_TOKENS in extensions/tc-footer.ts — keep in sync. */
const RESERVE_TOKENS = 16_384

/** Mirror of formatCwd() in extensions/tc-footer.ts — keep in sync. */
function formatCwd(cwd) {
	const home = process.env.HOME || process.env.USERPROFILE
	if (home) {
		const rel = relative(resolve(home), resolve(cwd))
		const inside = rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
		if (inside) return rel === "" ? "~" : `~${sep}${rel}`
	}
	const segments = resolve(cwd).split(sep).filter(Boolean)
	return segments.slice(-2).join(sep) || sep
}

/** Mirror of thresholds() in extensions/tc-footer.ts — keep in sync. */
function thresholds(effectiveWindow) {
	const capped = effectiveWindow >= EFFECTIVE_CONTEXT_TOKENS
	const red = capped ? 65 : ((effectiveWindow - RESERVE_TOKENS) / effectiveWindow) * 100
	return { red, yellow: red / 2 }
}

/** Mirror of effectivePercent() in extensions/tc-footer.ts — keep in sync. */
function effectivePercent(tokens, contextWindow) {
	const eff = Math.min(contextWindow, EFFECTIVE_CONTEXT_TOKENS)
	if (eff <= 0) return null
	return (tokens / eff) * 100
}

/** Mirror of contextBar() in extensions/tc-footer.ts — keep in sync. */
function contextBar(pct, th) {
	const filled = Math.round((Math.min(100, pct) / 100) * 10)
	const color = pct >= th.red ? "error" : pct >= th.yellow ? "warning" : "success"
	return theme.fg(color, "█".repeat(filled) + "░".repeat(10 - filled))
}

/** Mirror of render() in extensions/tc-footer.ts — keep in sync. */
function renderLine(cwd, tokens, contextWindow, model, thinking, branch, width) {
	const left = theme.fg("dim", formatCwd(cwd))
	let context = ""
	if (tokens !== null && contextWindow > 0) {
		const effWindow = Math.min(contextWindow, EFFECTIVE_CONTEXT_TOKENS)
		const th = thresholds(effWindow)
		const pct = effectivePercent(tokens, contextWindow)
		if (pct !== null) {
			const shown = Math.min(100, Math.round(pct))
			const color = pct >= th.red ? "error" : pct >= th.yellow ? "warning" : "success"
			context = ` ${theme.fg(color, `${shown}%`)} ${contextBar(pct, th)}`
		}
	}
	const think = thinking ? ` ${theme.fg("accent", `⚡${thinking}`)}` : ""
	const right = model + think + (branch ? theme.fg("dim", ` (${branch})`) : "")
	const pad = " ".repeat(
		Math.max(1, width - visibleWidth(left) - visibleWidth(context) - visibleWidth(right)),
	)
	return truncateToWidth(left + context + pad + right, width)
}

const width = Number(process.argv[2]) || 80
const cwd = process.cwd()

// [label, tokens, contextWindow, model, thinking, branch]
const cases = [
	["128k window @ 30k (green)", 30_000, 131_072, "hunyuan-t1-latest", "high", "master"],
	["128k window @ 70k (yellow)", 70_000, 131_072, "hunyuan-t1-latest", "high", "feature/footer"],
	[
		"128k window @ 116k (red, near compaction)",
		116_000,
		131_072,
		"hunyuan-t1-latest",
		"off",
		"master",
	],
	["200k window @ 100k (yellow)", 100_000, 204_800, "hunyuan-t1-latest", "high", "master"],
	[
		"1M window @ 200k (yellow — red is 65% of effective window)",
		200_000,
		1_048_576,
		"gpt-5",
		null,
		"main",
	],
	[
		"1M window @ 300k (yellow — red is 65% of effective window)",
		300_000,
		1_048_576,
		"gpt-5",
		"low",
		"main",
	],
	[
		"1M window @ 440k (red — effective window nearly full)",
		440_000,
		1_048_576,
		"gpt-5",
		"high",
		"main",
	],
	["non-reasoning model, usage unknown", null, 131_072, "gpt-4o", null, "main"],
]

for (const [label, tokens, contextWindow, model, thinking, branch] of cases) {
	console.log(`${label}:`)
	console.log(renderLine(cwd, tokens, contextWindow, model, thinking, branch, width))
	console.log()
}
console.log(`narrow (50 cols):`)
console.log(renderLine(cwd, 116_000, 131_072, "hunyuan-t1-latest", "high", "master", 50))
