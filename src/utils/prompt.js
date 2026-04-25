const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

async function promptForCredentials(currentUsername, currentPassword) {
  const rl = readline.createInterface({ input, output });

  try {
    const username = currentUsername || (await rl.question("Usuario IOL: "));
    const password = currentPassword || (await rl.question("Password IOL: "));
    return {
      username: username.trim(),
      password: password.trim()
    };
  } finally {
    rl.close();
  }
}

module.exports = {
  promptForCredentials
};
