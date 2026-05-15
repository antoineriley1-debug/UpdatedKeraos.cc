#!/usr/bin/env node
// Usage: node scripts/add-user.js
// Interactive prompts for email, name, password, role. Outputs a JSON entry
// ready to paste into the USERS env var.

const crypto = require('crypto');
const readline = require('readline');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

(async () => {
  console.log('\n=== Add user to Priority Tasks ===\n');
  const email = (await ask('Email: ')).trim().toLowerCase();
  const name = (await ask('Full name: ')).trim();
  const password = await ask('Password (will be hashed): ');
  const roleRaw = (await ask('Role [admin/manager/user/readonly] (default: user): ')).trim().toLowerCase();
  const role = ['admin', 'manager', 'user', 'readonly'].includes(roleRaw) ? roleRaw : 'user';
  rl.close();

  if (!email || !name || !password) {
    console.error('\nMissing required field. Aborting.');
    process.exit(1);
  }

  const entry = { email, name, role, passwordHash: hashPassword(password) };

  console.log('\n--- ADD THIS to your USERS env var (JSON array) ---\n');
  console.log(JSON.stringify(entry, null, 2));
  console.log('\n--- For a fresh USERS env var with one user, paste this: ---\n');
  console.log(JSON.stringify([entry]));
  console.log('');
})();
