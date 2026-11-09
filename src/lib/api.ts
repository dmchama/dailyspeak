import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth";
import { getProfile } from "./lessons/context";
import type { Profile } from "./types";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Wrap an API handler that requires a signed-in user (and optionally their profile). */
export function withUser<A extends unknown[]>(handler: (user: CurrentUser, profile: Profile | null, req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => {
    const user = await getCurrentUser();
    if (!user) return error("Please sign in", 401);
    try {
      return await handler(user, await getProfile(user.id), req, ...rest);
    } catch (e) {
      console.error(e);
      return error((e as Error).message || "Something went wrong", 500);
    }
  };
}
