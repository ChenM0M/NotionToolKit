import { NextRequest, NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";

const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const fetchOptions: RequestInit = {};
        if (PROXY_URL) {
            // @ts-expect-error Node.js fetch supports agent option
            fetchOptions.agent = new HttpsProxyAgent(PROXY_URL);
        }
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("Proxy Error:", error);
        return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    }
}
