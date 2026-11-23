import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getMe, type User } from "./api";
import { DEFAULT_LANG, DICTS, isLang, type Lang } from "./i18n";

export const TOKEN_COOKIE = "tooarna_token";
export const LANG_COOKIE = "tooarna_lang";

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : DEFAULT_LANG;
});

export type Theme = "dark" | "light";
export const THEME_COOKIE = "theme";

/** Colour theme from the cookie set by ThemeToggle; dark is the default look. */
export const getTheme = cache(async (): Promise<Theme> =>
  (await cookies()).get(THEME_COOKIE)?.value === "light" ? "light" : "dark",
);

export async function getDict() {
  return DICTS[await getLang()];
}

/** Current user or null. Cached per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = await getToken();
  if (!token) return null;
  try {
    return await getMe(token);
  } catch {
    return null;
  }
});
