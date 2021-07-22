const { Client } = require('pg');
const os = require('os');

const client = new Client({
  host: '/var/run/postgresql',
  database: 'dns',
  user: os.userInfo().username
});

!async function main() {
  await client.connect();
  console.log('database connection established');
  switch (process.argv[2]) {
    case 'add': {
      let domain = process.argv[3];
      let token = process.argv[4];
      if (!token) {
        console.error('missing arguments');
        process.exitCode = 1;
      }
      console.log(`adding for domain ${domain} token ${token}`);
      let result = await client.query('INSERT INTO acme (domain, token) VALUES ($1, $2)', [domain, token]);
      console.log('done');
      break;
    }
    case 'remove': {
      let domain = process.argv[3];
      let token = process.argv[4];
      if (!token) {
        console.error('missing arguments');
        process.exitCode = 1;
      }
      console.log(`remove domain ${domain} token ${token}`);
      let result = await client.query('DELETE FROM acme WHERE lower(domain) = lower($1) AND token = $2', [domain, token]);
      console.log('done');
      break;
    }
    default: {
      console.error('unknown subcommand');
      process.exitCode = 1;
    }
  }
  await client.end();
}();
