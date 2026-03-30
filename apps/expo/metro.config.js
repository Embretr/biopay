const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

const pnpmModules = path.join(
  workspaceRoot,
  "node_modules",
  ".pnpm",
  "node_modules",
);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  ...(fs.existsSync(pnpmModules) ? [pnpmModules] : []),
  path.resolve(workspaceRoot, "node_modules"),
];

try {
  const babelRuntime = path.join(projectRoot, "node_modules", "@babel", "runtime");
  if (fs.existsSync(babelRuntime)) {
    config.resolver.extraNodeModules = {
      ...config.resolver.extraNodeModules,
      "@babel/runtime": fs.realpathSync(babelRuntime),
    };
  }
} catch {
  // keep defaults
}

module.exports = config;
