/**
 * Preview the tc-footer layout in the terminal without a live session.
 *
 * Usage:
 *   node scripts/footer-preview.mjs [columns]
 *
 * Renders the exact same logic as extensions/tc-footer.ts (cwd shortening,
 * context bar thresholds, colors) for a few representative states, using
 * the real pi theme (dark by default, PI_THEME to override).
 */

import { relative, resolve, sep } from "node:path"
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"

const themeMod = await import(
	"../node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"
)
const theme = themeMod.getThemeByName(process.env.PI_THEME || "dark")
if (!theme) throw new Error(`theme "${process.env.PI_THEME || "dark"}" not found`)

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

/** Mirror of contextBar() in extensions/tc-footer.ts — keep in sync. */
function contextBar(pct) {
	const filled = Math.round((pct / 100) * 10)
	const color = pct >= 85 ? "error" : pct >= 60 ? "warning" : "success"
	return theme.fg(color, "█".repeat(filled) + "░".repeat(10 - filled))
}

/** Mirror of render() in extensions/tc-footer.ts — keep in sync. */
function renderLine(cwd, pct, model, thinking, branch, width) {
	const left = theme.fg("dim", formatCwd(cwd))
	let context = ""
	if (pct !== null) {
		const p = Math.min(100, Math.round(pct))
		const color = p >= 85 ? "error" : p >= 60 ? "warning" : "success"
		context = ` ${theme.fg(color, `${p}%`)} ${contextBar(p)}`
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

const cases = [
	["low pressure (green)", 23, "hunyuan-t1-latest", "high", "master"],
	["medium 68% (yellow)", 68, "hunyuan-t1-latest", "high", "feature/footer"],
	["high 91% (red)", 91, "hunyuan-t1-latest", "off", "master"],
	["non-reasoning model", 45, "gpt-4o", null, "main"],
]

for (const [label, pct, model, thinking, branch] of cases) {
	console.log(`${label}:`)
	console.log(renderLine(cwd, pct, model, thinking, branch, width))
	console.log()
}
console.log(`narrow (50 cols):`)
console.log(renderLine(cwd, 91, "hunyuan-t1-latest", "high", "master", 50))
