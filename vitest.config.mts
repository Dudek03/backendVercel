import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    alias: {
      "@/": new URL("./", import.meta.url).pathname,
    },
    server: {
      deps: {
        inline: ["server-only"],
      },
    },
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
  },
  resolve: {
    conditions: ["react-server"],
  },
});
