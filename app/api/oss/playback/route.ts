import { NextResponse } from "next/server";
import { getOssPlaybackUrl } from "@/lib/oss-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const objectKey = new URL(request.url).searchParams.get("object_key") || undefined;
    return NextResponse.json({ playback_url: getOssPlaybackUrl(objectKey) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create an OSS playback URL.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
