const Zone = require('../../src/module').Zone;

module.exports = new Zone('example.com', {
  child: {
    'www': {
      A: { type: 'static', data: [{ data: '91.92.144.105' }] },
      TXT: { type: 'static', data: Array(500).fill(0).map((v, i) => ({ data: `TXT record #${i}!` })) },
      all: {
        type: 'dynamic',
        handler: async ctx => {
          console.log('!!!!!!', ctx.request.additionals[0].options);
          ctx.response.pushAnswer({ name: ctx.question.name, type: 'A', data: '127.0.0.1' });
        }
      },
      child: {
        'crashey': {
          all: {
            type: 'dynamic',
            handler: async ctx => {
              throw new Error('whoops!');
            }
          }
        }
      }
    }
  }
}, {
  mname: 'example.com',
  rname: 'contact.example.com',
  serial: 2,
  refresh: 86400,
  retry: 3600,
  expire: 3600000,
  minimum: 86400
});
