const fs = require("node:fs");
const path = require("node:path");

async function uninstallExecutableData({
  runtimePaths,
  readSettings = () => ({}),
  confirmAppDataDeletion,
  confirmCustomOutputDeletion,
  exists = fs.existsSync,
  removeDirectory = (directory) => fs.rmSync(directory, { recursive: true, force: true })
}) {
  if (!runtimePaths.isPackaged) {
    throw new Error("La desinstalación solo está disponible desde el ejecutable distribuido.");
  }

  const appDataDir = path.resolve(runtimePaths.rootDir);
  if (!(await confirmAppDataDeletion(appDataDir))) {
    return { removedAppData: false, removedCustomOutput: false };
  }

  const settings = readSettings() || {};
  const customOutputDir = getDeletableCustomOutputDirectory(settings.salida, runtimePaths, exists);
  const shouldRemoveCustomOutput =
    customOutputDir && (await confirmCustomOutputDeletion(customOutputDir));

  if (exists(appDataDir)) {
    removeDirectory(appDataDir);
  }
  if (shouldRemoveCustomOutput && exists(customOutputDir)) {
    removeDirectory(customOutputDir);
  }

  return { removedAppData: true, removedCustomOutput: Boolean(shouldRemoveCustomOutput) };
}

function getDeletableCustomOutputDirectory(savedOutputDirectory, runtimePaths, exists) {
  if (!savedOutputDirectory) return null;

  const outputDir = path.resolve(savedOutputDirectory);
  const appDataDir = path.resolve(runtimePaths.rootDir);
  const defaultOutputDir = path.resolve(runtimePaths.outputDir);
  if (outputDir === defaultOutputDir || isWithinDirectory(appDataDir, outputDir) || !exists(outputDir)) {
    return null;
  }

  // Never permit a prompt to remove an entire drive. Other chosen folders are
  // shown verbatim to the user before deletion.
  if (path.parse(outputDir).root === outputDir) {
    return null;
  }
  return outputDir;
}

function isWithinDirectory(parentDirectory, candidateDirectory) {
  const relative = path.relative(parentDirectory, candidateDirectory);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

module.exports = {
  uninstallExecutableData,
  getDeletableCustomOutputDirectory
};
