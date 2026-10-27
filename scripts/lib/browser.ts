/**
 * Playwright só é usado pelos scripts de captura de tela (shots, record-demo).
 * Não é dependência do app: se não estiver instalado, o erro explica como resolver.
 */
export async function getChromium(): Promise<any> {
  const mod = process.env.PLAYWRIGHT_CORE ?? "playwright-core";
  try {
    const m: any = await import(mod);
    const c = m.chromium ?? m.default?.chromium;
    if (!c) throw new Error("módulo sem chromium");
    return c;
  } catch {
    throw new Error(
      "Playwright não encontrado. Instale com:\n" +
        "  bun add -d playwright-core && bunx playwright install chromium\n" +
        "ou aponte PLAYWRIGHT_CORE=/caminho/para/playwright-core/index.js",
    );
  }
}
