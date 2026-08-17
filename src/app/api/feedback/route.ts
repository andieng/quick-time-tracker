import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";

const MAX_MESSAGE_LENGTH = 2000;

// Anonymous submissions are keyed by a hashed IP rather than the raw
// address, so the rate-limit table never stores anything identifying.
function getClientIdentifier(request: Request, userId: string | undefined): string {
  if (userId) return `user:${userId}`;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown";
  return `ip:${createHash("sha256").update(ip).digest("hex")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { type, message } = await request.json();
  if (type !== "bug" && type !== "feature") {
    return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
  }
  const trimmed = typeof message === "string" ? message.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const identifier = getClientIdentifier(request, user?.id);
  if (await isRateLimited(identifier)) {
    return NextResponse.json(
      { error: "Too many submissions — try again later" },
      { status: 429 },
    );
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user?.id ?? null,
    type,
    message: trimmed,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
