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

module.exports = {
  promptForCredentials,
  promptToSaveToVault
};
