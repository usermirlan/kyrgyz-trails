"""AI trip planner: an LLM agent that answers only from our own trail database.

The agent loop is provider-agnostic (any OpenAI-compatible endpoint: Gemini,
Groq, OpenRouter, a local Ollama…). Tools are plain Python callables, so the
loop can be unit-tested with a fake client.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

MAX_STEPS = 6

SYSTEM_PROMPT = """You are Too Arna, a trip planner for hiking in Kyrgyzstan.

Rules:
- Recommend ONLY trails returned by your tools. Never invent trails, distances or facts.
- Always call search_trails first. Call get_trail_details for trails you recommend,
  and get_weather_forecast when the trip is within the next 7 days.
- Link every recommended trail as a markdown link: [Title](/trails/<slug>).
- Give a day-by-day plan, a rough budget in Kyrgyz som (KGS) clearly marked as an
  estimate, what to pack, and safety notes (altitude, weather, border permits).
- If nothing in the database fits, say so honestly and suggest the closest options.
- Reply in the user's language ({lang_name}). Be concise and use markdown headings and lists.
- Never use markdown tables (they are not rendered); use bullet lists instead.
- Prices, fees and transport costs are not in the database: present them only as rough estimates.
- Currency is always Kyrgyz som (write "сом" / "KGS"). Never use rubles (₽) or other currencies.
- Do not invent place names, camps, distances or route details. Use only facts returned by the tools;
  if a detail is unknown, say so briefly instead of guessing.
"""

LANG_NAMES = {"ky": "Kyrgyz", "ru": "Russian", "en": "English"}

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_trails",
            "description": "Search the trail database. All filters optional.",
            "parameters": {
                "type": "object",
                "properties": {
                    "region": {
                        "type": "string",
                        "enum": ["chui", "issyk_kul", "naryn", "jalal_abad", "osh", "talas", "batken"],
                    },
                    "difficulty": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["easy", "moderate", "hard", "expert"]},
                    },
                    "max_days": {"type": "integer", "minimum": 1},
                    "month": {"type": "integer", "minimum": 1, "maximum": 12},
                    "max_distance_km": {"type": "number"},
                    "q": {"type": "string", "description": "Text search in trail titles"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trail_details",
            "description": "Full details for one trail, including how to get there.",
            "parameters": {
                "type": "object",
                "properties": {"slug": {"type": "string"}},
                "required": ["slug"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_forecast",
            "description": "7-day weather forecast at the trailhead.",
            "parameters": {
                "type": "object",
                "properties": {"slug": {"type": "string"}},
                "required": ["slug"],
            },
        },
    },
]


class ChatClient(Protocol):
    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        """Return an assistant message dict: {"content": str|None, "tool_calls": [...]}"""


@dataclass
class PlanResult:
    answer: str
    trail_slugs: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)  # for UI transparency/debugging


class PlannerUnavailable(RuntimeError):
    pass


def run_agent(
    prompt: str,
    lang: str,
    client: ChatClient,
    tools: dict[str, Callable[..., Any]],
    max_steps: int = MAX_STEPS,
) -> PlanResult:
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT.format(lang_name=LANG_NAMES.get(lang, "Russian"))},
        {"role": "user", "content": prompt},
    ]
    seen_slugs: list[str] = []
    log: list[dict] = []

    for _ in range(max_steps):
        msg = client.complete(messages, TOOLS)
        calls = msg.get("tool_calls") or []
        if not calls:
            answer = (msg.get("content") or "").strip()
            mentioned = [s for s in seen_slugs if f"/trails/{s}" in answer]
            return PlanResult(answer=answer, trail_slugs=mentioned, tool_calls=log)

        messages.append({"role": "assistant", "content": msg.get("content"), "tool_calls": calls})
        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
                result = tools[name](**args) if name in tools else {"error": f"unknown tool {name}"}
            except Exception as e:  # report tool errors back to the model instead of crashing
                result = {"error": str(e)}
            log.append({"tool": name, "args": call["function"].get("arguments")})
            for item in result if isinstance(result, list) else [result]:
                if isinstance(item, dict) and item.get("slug") and item["slug"] not in seen_slugs:
                    seen_slugs.append(item["slug"])
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps(result, ensure_ascii=False, default=str),
                }
            )

    return PlanResult(
        answer="Кечиресиз, план түзүү өтө көп кадамды талап кылды. Сурооңузду тагыраак жазып көрүңүз.",
        tool_calls=log,
    )


class OpenAICompatClient:
    """Works with any OpenAI-compatible chat API. Configured via env vars."""

    def __init__(self) -> None:
        api_key = os.environ.get("LLM_API_KEY")
        if not api_key:
            raise PlannerUnavailable("LLM_API_KEY коюлган эмес")
        from openai import OpenAI

        self.client = OpenAI(
            api_key=api_key,
            base_url=os.environ.get(
                "LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"
            ),
            timeout=60,
        )
        self.model = os.environ.get("LLM_MODEL", "gemini-2.5-flash")

    def complete(self, messages: list[dict], tools: list[dict]) -> dict:
        r = self.client.chat.completions.create(
            model=self.model, messages=messages, tools=tools, temperature=0.4
        )
        m = r.choices[0].message
        return {
            "content": m.content,
            "tool_calls": [
                {
                    "id": c.id,
                    "type": "function",
                    "function": {"name": c.function.name, "arguments": c.function.arguments},
                }
                for c in (m.tool_calls or [])
            ],
        }
