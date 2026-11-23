"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions";
import type { Dict } from "@/lib/i18n";

export default function AuthForm({ mode, next, t }: { mode: "login" | "register"; next: string; t: Dict }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : register, {});
  const field = "w-full rounded-xl border border-stone/15 bg-panel px-3 py-2.5 outline-none focus:border-sky";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {mode === "register" && (
        <label className="block text-sm">
          {t.name}
          <input name="name" required maxLength={60} autoComplete="given-name" className={`${field} mt-1`} />
        </label>
      )}
      <label className="block text-sm">
        {t.email}
        <input name="email" type="email" required autoComplete="email" className={`${field} mt-1`} />
      </label>
      <label className="block text-sm">
        {t.password}
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={`${field} mt-1`}
        />
      </label>
      {state.error && <p className="rounded-lg bg-ember/10 px-3 py-2 text-sm text-ember">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-white py-2.5 font-medium text-ink disabled:opacity-50">
        {mode === "login" ? t.login : t.register}
      </button>
      <p className="text-center text-sm text-stone/60">
        {mode === "login" ? t.noAccount : t.haveAccount}{" "}
        <Link
          href={`/${mode === "login" ? "register" : "login"}?next=${encodeURIComponent(next)}`}
          className="text-sky hover:underline"
        >
          {mode === "login" ? t.register : t.login}
        </Link>
      </p>
    </form>
  );
}
