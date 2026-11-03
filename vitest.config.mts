import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    alias: {
      "@/": path.resolve(__dirname, "./") + "/",
      "server-only": path.resolve(__dirname, "./__tests__/empty-mock.js"),
    },
    resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
  },
});
