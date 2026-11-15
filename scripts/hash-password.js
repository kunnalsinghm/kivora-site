// hash-password.js - makes an admin account entry for the ADMIN_USERS setting.
// Run:  npm run admin:hash
// It asks for an email and a password (typing is hidden), then prints "email:hash". The password itself is never stored or printed.
const { hashPassword } = require("../lib/auth");

function ask(label, { hidden = false } = {}) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    if (!hidden) {
      stdin.setEncoding("utf8"); stdin.resume();
      stdin.once("data", (d) => { stdin.pause(); resolve(String(d).split(/\r?\n/)[0].trim()); });
      return;
    }
    let text = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const done = (fn) => { stdin.removeListener("data", onData); stdin.setRawMode(false); stdin.pause(); process.stdout.write("\n"); fn(); };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n") return done(() => resolve(text));
        if (c === "\u0003") return done(() => process.exit(130)); // Ctrl+C
        if (c === "\u007f" || c === "\b") text = text.slice(0, -1);
        else if (c >= " ") text += c;
      }
    };
    stdin.on("data", onData);
  });
}

(async () => {
  if (!process.stdin.isTTY) { console.error("Run this in a terminal: npm run admin:hash"); process.exit(1); }
  const email = (await ask("Admin email: ")).toLowerCase();
  if (!/^[^\s@:,]+@[^\s@:,]+\.[^\s@:,]{2,}$/.test(email)) { console.error("That doesn't look like a valid email."); process.exit(1); }
  const password = await ask("Password (at least 12 characters, hidden): ", { hidden: true });
  if (password.length < 12) { console.error("Use at least 12 characters."); process.exit(1); }
  if (password.length > 200) { console.error("Use 200 characters or fewer."); process.exit(1); }
  if (password !== (await ask("Type it again: ", { hidden: true }))) { console.error("The two passwords don't match."); process.exit(1); }

  console.log("\nPut this in the ADMIN_USERS setting (for several admins, join the entries with a comma):\n");
  console.log(`${email}:${await hashPassword(password)}\n`);
  console.log("Also set SESSION_SECRET to a long random value, for example:");
  console.log(`  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`);
})();
