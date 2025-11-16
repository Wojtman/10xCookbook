import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  define: {
    "import.meta.env.PUBLIC_SUPABASE_DB_URL": JSON.stringify("https://example.supabase.co"),
    "import.meta.env.PUBLIC_SUPABASE_DB_ANON_KEY": JSON.stringify("test-anon-key"),
    "import.meta.env.PROD": JSON.stringify(false),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["tests/e2e/**"],
  },
});
