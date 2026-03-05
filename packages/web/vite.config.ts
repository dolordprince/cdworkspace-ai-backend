import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import svgr from "vite-plugin-svgr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const workspaceOrigin = env.VITE_WORKSPACE_API_ORIGIN;

  return {
    plugins: [react(), svgr()],
    server: {
      port: 5173,
      ...(workspaceOrigin && {
        proxy: {
          "/workspace-api": {
            target: workspaceOrigin,
            changeOrigin: true,
          },
        },
      }),
    },
  };
});

