/**
 * Next.js Instrumentation Hook
 * 在服务启动时配置全局代理，使所有 server-side fetch 自动走代理。
 * 适用于国内环境访问 Google OAuth、OpenAI 等被墙服务。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxy) {
      const { ProxyAgent, setGlobalDispatcher } = await import("undici");
      setGlobalDispatcher(new ProxyAgent(proxy));
      console.log(`[instrumentation] Global proxy set: ${proxy}`);
    }
  }
}
