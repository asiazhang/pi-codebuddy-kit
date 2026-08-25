/**
 * Tencent Copilot (CodeBuddy gateway) provider for pi.
 *
 * Gateway: https://copilot.tencent.com/v2/chat/completions
 * OpenAI Chat Completions compatible + SSE, auth via `Authorization: Bearer <key>`.
 *
 * Setup: either export TENCENT_INTRANET_API_KEY, or run `/login` and select
 * "Tencent Copilot (CodeBuddy Gateway)" to store the key in auth.json (the
 * stored credential wins over the environment variable). Then select a
 * `tencent-copilot/<model>` entry via /model.
 *
 * Model snapshot and gateway quirks verified against the live gateway
 * on 2026-08-18. Hot-reloadable via /reload after edits.
 */

import {
	createProvider,
	envApiKeyAuth,
	type Model,
	openAICompletionsApi,
} from "@earendil-works/pi-ai/compat"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const BASE_URL = "https://copilot.tencent.com/v2"

// Headers the gateway expects on every request (CodeBuddy CLI identity).
const GATEWAY_HEADERS = {
	"User-Agent": "CLI/2.113.0 CodeBuddy/2.113.0 CLI/2.113.0 CodeBuddy/2.113.0",
	"x-codebuddy-request": "1",
	"x-agent-intent": "craft",
	"x-agent-purpose": "conversation",
	"x-private-data": "false",
	"x-ide-type": "CLI",
	"x-ide-name": "CLI",
	"x-ide-version": "2.113.0",
}

// Gateway quirks vs standard OpenAI Chat Completions.
const COMPAT = {
	supportsStore: false, // no `store` field
	supportsDeveloperRole: false, // use "system" role
	supportsReasoningEffort: true, // `reasoning_effort` accepted
	supportsStrictMode: false, // no `strict` on tools
	maxTokensField: "max_tokens", // not `max_completion_tokens`
} as const

const ALL_EFFORTS = {
	off: null,
	minimal: null,
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
}

// [id, name, contextWindow, maxTokens, supportsImages, efforts]
// efforts: "all" | null (null = no effort control, gateway rejects it)
const SNAPSHOT: Array<[string, string, number, number, boolean, "all" | null]> = [
	["claude-sonnet-5-1m", "Claude Sonnet 5 (1M)", 1000000, 128000, true, "all"],
	["claude-sonnet-4.6-1m", "Claude Sonnet 4.6 (1M)", 1000000, 24000, true, "all"],
	["claude-opus-5", "Claude Opus 5", 1000000, 128000, true, "all"],
	["claude-opus-4.8-1m", "Claude Opus 4.8 (1M)", 1000000, 128000, true, "all"],
	["claude-opus-4.7-1m", "Claude Opus 4.7 (1M)", 1000000, 128000, true, "all"],
	["claude-opus-4.6-1m", "Claude Opus 4.6 (1M)", 1000000, 64000, true, "all"],
	["gemini-3.1-pro", "Gemini 3.1 Pro", 400000, 64000, true, "all"],
	["gemini-3.5-flash", "Gemini 3.5 Flash", 1000000, 65536, true, "all"],
	["gpt-5.6-sol", "GPT-5.6 Sol", 1000000, 128000, true, "all"],
	["gpt-5.6-terra", "GPT-5.6 Terra", 1000000, 128000, true, "all"],
	["gpt-5.6-luna", "GPT-5.6 Luna", 1000000, 128000, true, "all"],
	["glm-5.3-ioa", "GLM-5.3", 1000000, 48000, true, "all"],
	["minimax-m3-ioa", "MiniMax M3", 512000, 48000, true, "all"],
	["kimi-k3-ioa", "Kimi K3", 1000000, 32000, true, "all"],
	["hy3-ioa", "Hy3", 192000, 64000, true, "all"],
	["deepseek-v4-flash-ioa", "DeepSeek V4 Flash", 1000000, 50000, true, "all"],
	["deepseek-v4-pro-ioa", "DeepSeek V4 Pro", 1000000, 50000, true, "all"],
]

const models: Model<"openai-completions">[] = SNAPSHOT.map(
	([id, name, contextWindow, maxTokens, supportsImages, efforts]) => ({
		id,
		name,
		api: "openai-completions" as const,
		provider: "tencent-copilot",
		baseUrl: BASE_URL,
		reasoning: efforts !== null,
		input: (supportsImages ? ["text", "image"] : ["text"]) as ("text" | "image")[],
		contextWindow,
		maxTokens,
		// Gateway is not billed per token; keep usage tracking cost-free.
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		compat: COMPAT,
		...(efforts === "all" ? { thinkingLevelMap: ALL_EFFORTS } : {}),
	}),
)

export default function (pi: ExtensionAPI) {
	pi.registerProvider(
		createProvider({
			id: "tencent-copilot",
			name: "Tencent Copilot (CodeBuddy Gateway)",
			baseUrl: BASE_URL,
			headers: GATEWAY_HEADERS,
			// Standard api-key auth: a key stored via /login wins, otherwise the
			// TENCENT_INTRANET_API_KEY environment variable is used. The key is
			// only persisted to ~/.pi/agent/auth.json when /login is used.
			auth: {
				apiKey: envApiKeyAuth("Tencent Copilot (CodeBuddy) API key", ["TENCENT_INTRANET_API_KEY"]),
			},
			models,
			api: openAICompletionsApi(),
		}),
	)
}
