"""Agent loop tests with a scripted fake LLM — no network, no database."""

import json

from trails.services.planner import run_agent


class ScriptedClient:
    def __init__(self, replies):
        self.replies = list(replies)
        self.seen = []

    def complete(self, messages, tools):
        self.seen.append([dict(m) for m in messages])
        return self.replies.pop(0)


def call(id_, name, **args):
    return {"id": id_, "type": "function", "function": {"name": name, "arguments": json.dumps(args)}}


def test_agent_calls_tools_then_answers():
    client = ScriptedClient(
        [
            {"content": None, "tool_calls": [call("1", "search_trails", region="chui")]},
            {"content": None, "tool_calls": [call("2", "get_trail_details", slug="ala-archa-ratsek")]},
            {"content": "## План\n[Рацек](/trails/ala-archa-ratsek) — 1 күн.", "tool_calls": []},
        ]
    )
    calls = []
    tools = {
        "search_trails": lambda **kw: calls.append(("search", kw))
        or [{"slug": "ala-archa-ratsek"}, {"slug": "ala-archa-ak-sai-waterfall"}],
        "get_trail_details": lambda slug: calls.append(("detail", slug)) or {"slug": slug},
    }

    result = run_agent("1 күндүк маршрут", "ky", client, tools)

    assert calls == [("search", {"region": "chui"}), ("detail", "ala-archa-ratsek")]
    assert result.trail_slugs == ["ala-archa-ratsek"]  # only the one actually linked
    assert "План" in result.answer
    assert [c["tool"] for c in result.tool_calls] == ["search_trails", "get_trail_details"]
    # tool results are fed back to the model
    last_messages = client.seen[-1]
    assert last_messages[-1]["role"] == "tool"
    assert "Kyrgyz" in last_messages[0]["content"]


def test_tool_errors_are_reported_not_raised():
    def boom(**kw):
        raise ValueError("db down")

    client = ScriptedClient(
        [
            {"content": None, "tool_calls": [call("1", "search_trails")]},
            {"content": "Кечиресиз, маалымат жок.", "tool_calls": []},
        ]
    )
    result = run_agent("x" * 10, "ru", client, {"search_trails": boom})
    tool_msg = client.seen[-1][-1]
    assert "db down" in tool_msg["content"]
    assert result.answer == "Кечиресиз, маалымат жок."


def test_step_limit():
    looping = {"content": None, "tool_calls": [call("1", "search_trails")]}
    client = ScriptedClient([looping] * 3)
    result = run_agent("loop", "en", client, {"search_trails": lambda **k: []}, max_steps=3)
    assert result.trail_slugs == []
    assert len(result.tool_calls) == 3
