/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

import { getConfig } from "@/lib/config";
import { getBaseUrl, resolveUrl } from "@/lib/live";

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const allowCORS = searchParams.get('allowCORS') === 'true';
  const source = searchParams.get('moontv-source');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const config = await getConfig();
  const liveSource = config.LiveConfig?.find((s: any) => s.key === source);
  if (!liveSource) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }
  const ua = liveSource.ua || 'AptvPlayer/1.4.10';

  let response: Response | null = null;
  let responseUsed = false;

  try {
    const decodedUrl = decodeURIComponent(url);

    response = await fetch(decodedUrl, {
      cache: 'no-cache',
      redirect: 'follow',
      credentials: 'same-origin',
      headers: {
        'User-Agent': ua,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch m3u8' }, { status: 500 });
    }

    const contentType = response.headers.get('Content-Type') || '';
    const finalUrl = response.url; // 重定向后的最终 URL
    const ct = contentType.toLowerCase();

    // 多重检测是否为 M3U8 内容：Content-Type / URL 后缀 / 内容特征
    const isM3U8ByContentType = ct.includes('mpegurl') || ct.includes('octet-stream');
    const isM3U8ByUrl = /\.m3u8?(\?|$)/i.test(finalUrl);

    if (isM3U8ByContentType || isM3U8ByUrl) {
      // Content-Type 或 URL 后缀匹配 M3U8，直接重写
      const m3u8Content = await response.text();
      responseUsed = true;

      const baseUrl = getBaseUrl(finalUrl);
      const modifiedContent = rewriteM3U8Content(m3u8Content, baseUrl, request, allowCORS);

      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
      headers.set('Cache-Control', 'no-cache');
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
      return new Response(modifiedContent, { headers });
    }

    // Content-Type 和 URL 都不匹配，但可能是 302 跳转的 PHP/API 等返回的 M3U8
    // 对文本类型的响应尝试内容检测
    if (ct.includes('text/') || ct === '' || ct.includes('json') || ct.includes('php')) {
      const bodyText = await response.text();
      responseUsed = true;
      const trimmed = bodyText.trimStart();

      if (trimmed.startsWith('#EXTM3U') || trimmed.startsWith('#EXTINF')) {
        // 内容确认是 M3U8，进行重写
        const baseUrl = getBaseUrl(finalUrl);
        const modifiedContent = rewriteM3U8Content(bodyText, baseUrl, request, allowCORS);

        const headers = new Headers();
        headers.set('Content-Type', 'application/vnd.apple.mpegurl');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
        headers.set('Cache-Control', 'no-cache');
        headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
        return new Response(modifiedContent, { headers });
      }

      // 非 M3U8 文本内容，原样返回
      const headers = new Headers();
      headers.set('Content-Type', contentType || 'text/plain');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'no-cache');
      return new Response(bodyText, { headers });
    }

    // 二进制流（视频等），直接代理
    const headers = new Headers();
    headers.set('Content-Type', response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Accept');
    headers.set('Cache-Control', 'no-cache');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch m3u8' }, { status: 500 });
  } finally {
    // 确保 response 被正确关闭以释放资源
    if (response && !responseUsed) {
      try {
        response.body?.cancel();
      } catch (error) {
        // 忽略关闭时的错误
        console.warn('Failed to close response body:', error);
      }
    }
  }
}

function rewriteM3U8Content(content: string, baseUrl: string, req: Request, allowCORS: boolean) {
  // 从 referer 头提取协议信息
  const referer = req.headers.get('referer');
  let protocol = 'http';
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      protocol = refererUrl.protocol.replace(':', '');
    } catch (error) {
      // ignore
    }
  }

  const host = req.headers.get('host');
  const proxyBase = `${protocol}://${host}/api/proxy`;

  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 处理 TS 片段 URL 和其他媒体文件
    if (line && !line.startsWith('#')) {
      const resolvedUrl = resolveUrl(baseUrl, line);
      const proxyUrl = allowCORS ? resolvedUrl : `${proxyBase}/segment?url=${encodeURIComponent(resolvedUrl)}`;
      rewrittenLines.push(proxyUrl);
      continue;
    }

    // 处理 EXT-X-MAP 标签中的 URI
    if (line.startsWith('#EXT-X-MAP:')) {
      line = rewriteMapUri(line, baseUrl, proxyBase);
    }

    // 处理 EXT-X-KEY 标签中的 URI
    if (line.startsWith('#EXT-X-KEY:')) {
      line = rewriteKeyUri(line, baseUrl, proxyBase);
    }

    // 处理嵌套的 M3U8 文件 (EXT-X-STREAM-INF)
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      rewrittenLines.push(line);
      // 下一行通常是 M3U8 URL
      if (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          const resolvedUrl = resolveUrl(baseUrl, nextLine);
          const proxyUrl = `${proxyBase}/m3u8?url=${encodeURIComponent(resolvedUrl)}`;
          rewrittenLines.push(proxyUrl);
        } else {
          rewrittenLines.push(nextLine);
        }
      }
      continue;
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
}

function rewriteMapUri(line: string, baseUrl: string, proxyBase: string) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const proxyUrl = `${proxyBase}/segment?url=${encodeURIComponent(resolvedUrl)}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}

function rewriteKeyUri(line: string, baseUrl: string, proxyBase: string) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const proxyUrl = `${proxyBase}/key?url=${encodeURIComponent(resolvedUrl)}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}