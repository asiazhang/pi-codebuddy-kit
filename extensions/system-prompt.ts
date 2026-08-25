/**
 * System prompt customization for pi.
 *
 * Injects user-preference instructions into the system prompt every turn via
 * `before_agent_start` (chained across extensions in load order).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

// User preferences injected into the system prompt every turn.
// Loads on every turn — kept minimal and positive (no negated tools).
const USER_INSTRUCTIONS = [
	"",
	"## Language",
	"Reply in Simplified Chinese unless the user writes in another language.",
	"",
	"## Bash search",
	"Use `rg` (respects .gitignore); add `--hidden` only when you must include hidden files.",
].join("\n")

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event, _ctx) => {
		return {
			systemPrompt: event.systemPrompt + USER_INSTRUCTIONS,
		}
	})
}
