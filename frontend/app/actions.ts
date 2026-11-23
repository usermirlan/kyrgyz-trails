"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiError, type PlanResult, type User } from "@/lib/api";
import { isLang } from "@/lib/i18n";
import { getLang, getToken, LANG_COOKIE, TOKEN_COOKIE } from "@/lib/session";

export type FormState = { error?: string; ok?: boolean };

const YEAR = 60 * 60 * 24 * 365;

async function setSession(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function message(e: unknown): string {
  return e instanceof ApiError ? e.message : "Сервер менен байланыш жок";
}

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email: form.get("email"), password: form.get("password") },
    });
    await setSession(r.token);
  } catch (e) {
    return { error: message(e) };
  }
  redirect(safeNext(form.get("next")));
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  try {
    const r = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email: form.get("email"), password: form.get("password"), name: form.get("name") },
    });
    await setSession(r.token);
  } catch (e) {
    return { error: message(e) };
  }
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  const token = await getToken();
  if (token) {
    try {
      await api("/auth/logout", { method: "POST", token });
    } catch {}
  }
  (await cookies()).delete(TOKEN_COOKIE);
  redirect("/");
}

export async function setLang(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function toggleFavorite(slug: string): Promise<boolean | null> {
  const token = await getToken();
  if (!token) redirect(`/login?next=/trails/${slug}`);
  try {
    const r = await api<{ favorited: boolean }>(`/trails/${encodeURIComponent(slug)}/favorite`, {
      method: "POST",
      token,
    });
    revalidatePath("/favorites");
    return r.favorited;
  } catch {
    return null;
  }
}

export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const token = await getToken();
  const slug = String(form.get("slug"));
  if (!token) redirect(`/login?next=/trails/${slug}`);
  try {
    await api(`/trails/${encodeURIComponent(slug)}/reviews`, {
      method: "POST",
      token,
      body: {
        rating: Number(form.get("rating")),
        text: String(form.get("text") ?? ""),
        hiked_on: form.get("hiked_on") || null,
        conditions: String(form.get("conditions") ?? ""),
      },
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath(`/trails/${slug}`);
  return { ok: true };
}

export async function deleteReview(slug: string, id: number) {
  const token = await getToken();
  if (!token) return;
  try {
    await api(`/reviews/${id}`, { method: "DELETE", token });
  } catch {}
  revalidatePath(`/trails/${slug}`);
}

export type PlanState = { result?: PlanResult; error?: string; prompt?: string };

export async function planTrip(_: PlanState, form: FormData): Promise<PlanState> {
  const prompt = String(form.get("prompt") ?? "").trim();
  if (prompt.length < 5) return { prompt };
  try {
    const result = await api<PlanResult>("/planner", {
      method: "POST",
      body: { prompt, lang: await getLang() },
    });
    return { result, prompt };
  } catch (e) {
    return { error: message(e), prompt };
  }
}
