import { NextRequest, NextResponse } from "next/server";

/**
 * 通用代理路由（hackathon-plan §4.1）：浏览器只跟同源 /api/* 打交道，
 * 服务端再 HTTP 转发到后端 —— 后端无需域名/证书/CORS。
 * 转发时去掉 /api 前缀：后端接口形如 /stories 而非 /api/stories。
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.BACKEND_URL?.replace(/\/$/, "");

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!BACKEND) {
    return NextResponse.json({ code: 500, data: null, message: "BACKEND_URL 未配置" }, { status: 500 });
  }
  const url = `${BACKEND}/${params.path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  const hasBody = !["GET", "HEAD"].includes(req.method);

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error Node fetch 流式转发需要
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
    });
    const resHeaders = new Headers(res.headers);
    resHeaders.delete("content-encoding");
    resHeaders.delete("transfer-encoding");
    return new NextResponse(res.body, { status: res.status, headers: resHeaders });
  } catch (e) {
    return NextResponse.json(
      { code: 502, data: null, message: e instanceof Error ? e.message : "后端请求失败" },
      { status: 502 }
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
