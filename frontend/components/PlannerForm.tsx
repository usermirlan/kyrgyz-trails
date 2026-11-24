"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { planTrip, type PlanState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";

export default function PlannerForm({ t }: { t: Dict }) {
  const [state, action, pending] = useActionState<PlanState, FormData>(planTrip, {});
  const textarea = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <textarea
          ref={textarea}
          name="prompt"
          required
          minLength={5}
          maxLength={1000}
          rows={3}
          defaultValue={state.prompt}
          placeholder={t.plannerPlaceholder}
          className="w-full rounded-2xl border border-line bg-ink p-4 text-base outline-none focus:border-sky"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={pending}
            className="rounded-full bg-white px-6 py-2.5 font-bold text-ink disabled:opacity-50"
          >
            {pending ? t.planning : t.plan}
          </button>
          {t.plannerExamples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                if (textarea.current) textarea.current.value = ex;
              }}
              className="rounded-full border border-line bg-ink px-3 py-1.5 text-xs text-muted hover:border-sky hover:text-stone"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {pending && (
        <div className="space-y-2" aria-live="polite">
          {[80, 95, 60].map((w) => (
            <div key={w} className="h-4 animate-pulse rounded bg-stone/10" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {!pending && state.error && (
        <p className="rounded-xl bg-ember/10 px-4 py-3 text-sm text-ember">
          {t.error}: {state.error}
        </p>
      )}

      {!pending && state.result && (
        <article className="rounded-3xl border border-line bg-ink p-6">
          <div className="prose-plan">
            <ReactMarkdown
              components={{
                a: ({ href = "", children }) =>
                  href.startsWith("/") ? (
                    <Link href={href} className="font-medium text-sky underline">{children}</Link>
                  ) : (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky underline">{children}</a>
                  ),
              }}
            >
              {state.result.answer}
            </ReactMarkdown>
          </div>
          {state.result.tool_calls.length > 0 && (
            <details className="mt-6 text-xs text-muted">
              <summary className="cursor-pointer">{t.toolsUsed} ({state.result.tool_calls.length})</summary>
              <ul className="mt-2 space-y-1 font-mono">
                {state.result.tool_calls.map((c, i) => (
                  <li key={i}>
                    {c.tool}({c.args})
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
      )}
    </div>
  );
}
