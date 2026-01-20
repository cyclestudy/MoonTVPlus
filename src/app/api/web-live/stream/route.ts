import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function getAntiCode(oldAntiCode: string, streamName: string): string {
  const paramsT = 100;
  const sdkVersion = 2403051612;
  const t13 = Date.now();
  const sdkSid = t13;
  const initUuid = (Math.floor(t13 % 10000000000 * 1000) + Math.floor(1000 * Math.random())) % 4294967295;
  const uid = Math.floor(Math.random() * (1400009999999 - 1400000000000 + 1)) + 1400000000000;
  const seqId = uid + sdkSid;
  const targetUnixTime = Math.floor((t13 + 110624) / 1000);
  const wsTime = targetUnixTime.toString(16).toLowerCase();

  const urlQuery = new URLSearchParams(oldAntiCode);
  const fm = urlQuery.get('fm');
  if (!fm) return oldAntiCode;

  const wsSecretPf = Buffer.from(decodeURIComponent(fm), 'base64').toString().split('_')[0];
  const wsSecretHash = crypto.createHash('md5').update(`${seqId}|${urlQuery.get('ctype')}|${paramsT}`).digest('hex');
  const wsSecret = `${wsSecretPf}_${uid}_${streamName}_${wsSecretHash}_${wsTime}`;
  const wsSecretMd5 = crypto.createHash('md5').update(wsSecret).digest('hex');

  return `wsSecret=${wsSecretMd5}&wsTime=${wsTime}&seqid=${seqId}&ctype=${urlQuery.get('ctype')}&ver=1&fs=${urlQuery.get('fs')}&uuid=${initUuid}&u=${uid}&t=${paramsT}&sv=${sdkVersion}&sdk_sid=${sdkSid}&codec=264`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const roomId = searchParams.get('roomId');

    if (!platform || !roomId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (platform === 'huya') {
      const res = await fetch(`https://www.huya.com/${roomId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const html = await res.text();

      const match = html.match(/stream:\s*(\{"data".*?),"iWebDefaultBitRate"/);
      if (!match) {
        return NextResponse.json({ error: '未找到直播数据' }, { status: 404 });
      }

      const jsonData = JSON.parse(match[1] + '}');
      const streamInfo = jsonData.data?.[0]?.gameStreamInfoList?.[0];

      if (!streamInfo) {
        return NextResponse.json({ error: '直播未开启' }, { status: 404 });
      }

      const { sFlvUrl, sStreamName, sFlvUrlSuffix, sFlvAntiCode } = streamInfo;
      const newAntiCode = getAntiCode(sFlvAntiCode, sStreamName);
      const url = `${sFlvUrl}/${sStreamName}.${sFlvUrlSuffix}?${newAntiCode}`;

      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: '不支持的平台' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
