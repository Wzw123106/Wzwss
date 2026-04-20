/**
 * Netlify Edge：把前端的 /__em-* 同源请求转发到东方财富 / 天天基金（带常见浏览器头），避免仅靠 redirect 代理不稳定或被拒。
 * 文档：https://docs.netlify.com/edge-functions/overview/
 */
export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const routes = [
    ["/__em-push2", "https://push2.eastmoney.com"],
    ["/__em-push2his", "https://push2his.eastmoney.com"],
    ["/__em-fundgz", "https://fundgz.1234567.com.cn"],
    ["/__em-fund", "https://fund.eastmoney.com"]
  ];

  for (const [prefix, origin] of routes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const targetUrl = `${origin}${path.slice(prefix.length)}${url.search}`;
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent":
            request.headers.get("User-Agent") ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Origin: "https://fund.eastmoney.com",
          Referer: "https://fund.eastmoney.com/",
          Accept: request.headers.get("Accept") || "*/*",
          "Accept-Language": request.headers.get("Accept-Language") || "zh-CN,zh;q=0.9"
        },
        redirect: "follow"
      });

      const headers = new Headers(upstream.headers);
      headers.delete("set-cookie");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
    }
  }

  return context.next();
};
