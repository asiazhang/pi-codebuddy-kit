/**
 * System prompt customization for pi.
 *
 * Injects user-preference instructions into the system prompt every turn via
 * `before_agent_start` (chained across extensions in load order).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

// User preference: bash searches must use `rg` — GNU `grep` ignores
// .gitignore and can crawl node_modules, stalling the search.
const GREP_INSTRUCTION = [
	"",
	"## Bash search",
	"Use `rg`: it respects .gitignore — `grep` ignores it and can stall crawling node_modules.",
	"Add `--hidden` only when you must include hidden files.",
].join("\n")

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, _ctx) => {
		return {
			systemPrompt: event.systemPrompt + GREP_INSTRUCTION,
		}
	})
}
