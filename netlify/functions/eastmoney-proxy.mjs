const ROUTES = {
  push2: "https://push2.eastmoney.com",
  push2his: "https://push2his.eastmoney.com",
  fundgz: "https://fundgz.1234567.com.cn",
  fund: "https://fund.eastmoney.com"
};

function buildTargetUrl(rawUrl, service, restPath) {
  const origin = ROUTES[service];
  if (!origin) return null;
  const reqUrl = new URL(rawUrl);
  return `${origin}${restPath}${reqUrl.search}`;
}

export const handler = async (event) => {
  try {
    const path = event.path || "";
    const match = path.match(/\/\.netlify\/functions\/eastmoney-proxy\/([^/]+)(\/.*)?$/);
    if (!match) {
      return {
        statusCode: 400,
        body: "Invalid proxy path"
      };
    }

    const service = match[1];
    const restPath = match[2] || "";
    const targetUrl = buildTargetUrl(event.rawUrl, service, restPath);
    if (!targetUrl) {
      return {
        statusCode: 404,
        body: `Unknown service: ${service}`
      };
    }

    const upstream = await fetch(targetUrl, {
      method: event.httpMethod || "GET",
      headers: {
        "User-Agent":
          event.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://fund.eastmoney.com",
        Referer: "https://fund.eastmoney.com/",
        Accept: event.headers.accept || "*/*",
        "Accept-Language": event.headers["accept-language"] || "zh-CN,zh;q=0.9"
      },
      redirect: "follow"
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
    const cacheControl = upstream.headers.get("cache-control") || "no-store";

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": contentType,
        "cache-control": cacheControl
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: `Proxy failed: ${err?.message || "unknown error"}`
    };
  }
};
