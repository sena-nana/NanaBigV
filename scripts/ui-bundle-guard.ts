import type { Plugin, Rollup } from "vite";

export function uiBundleGuard(expected: "lilia" | "nana"): Plugin {
  return {
    name: "bigv-ui-bundle-guard",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((entry): entry is Rollup.OutputChunk => entry.type === "chunk");
      const assets = Object.values(bundle).filter((entry): entry is Rollup.OutputAsset => entry.type === "asset");
      const modules = [...new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules)))];
      const layers = {
        lilia: modules.filter((id) => isPackageModule(id, "ui")),
        nana: modules.filter((id) => isPackageModule(id, "nana-ui")),
      };
      const other = expected === "nana" ? "lilia" : "nana";
      if (layers[expected].length === 0) {
        throw new Error(`The ${expected} UI Layer is missing from the production bundle.`);
      }
      if (layers[other].length > 0) {
        throw new Error(`The ${other} UI Layer leaked into the ${expected} production bundle.`);
      }
      const dynamicEntries = chunks
        .filter((chunk) => chunk.isDynamicEntry)
        .map((chunk) => chunk.fileName)
        .sort();
      if (dynamicEntries.length === 0) {
        throw new Error("Preset pages must remain asynchronous chunks.");
      }
      const css = assets.filter((asset) => asset.fileName.endsWith(".css"));
      this.emitFile({
        type: "asset",
        fileName: "ui-bundle-report.json",
        source: `${JSON.stringify({
          preset: expected,
          layerModules: layers[expected].length,
          dynamicEntries,
          bytes: {
            css: css.reduce((sum, asset) => sum + sourceSize(asset.source), 0),
            js: chunks.reduce((sum, chunk) => sum + chunk.code.length, 0),
          },
        }, null, 2)}\n`,
      });
    },
  };
}

function isPackageModule(id: string, name: "ui" | "nana-ui") {
  const normalized = id.replaceAll("\\", "/");
  return normalized.includes(`/node_modules/@lilia/${name}/`)
    || normalized.includes(`/packages/${name}/src/`);
}

function sourceSize(source: string | Uint8Array) {
  return typeof source === "string" ? Buffer.byteLength(source) : source.byteLength;
}
