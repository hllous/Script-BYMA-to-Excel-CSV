const { Confirm, Input, Password } = require("enquirer");

async function promptForCredentials(currentUsername, currentPassword) {
  const username =
    currentUsername || (await new Input({ name: "username", message: "Usuario IOL:" }).run());
  const password =
    currentPassword || (await new Password({ name: "password", message: "Password IOL:" }).run());

  return {
    username: username.trim(),
    password: password.trim()
  };
}

async function promptToSaveToVault() {
  return new Confirm({
    name: "saveToVault",
    message: "Guardar password en el almacen de credenciales de Windows para la proxima vez?"
  }).run();
}

async function promptToDeleteApplicationData(appDataDir) {
  return new Confirm({
    name: "deleteAppData",
    message: `¿Eliminar todos los datos de ScriptIOLExcel en ${appDataDir}?`,
    initial: false
  }).run();
}

async function promptToDeleteCustomOutputDirectory(outputDirectory) {
  return new Confirm({
    name: "deleteCustomOutput",
    message: `¿Eliminar también la carpeta de salida personalizada y su contenido? ${outputDirectory}`,
    initial: false
  }).run();
}

module.exports = {
  promptForCredentials,
  promptToSaveToVault,
  promptToDeleteApplicationData,
  promptToDeleteCustomOutputDirectory
};
