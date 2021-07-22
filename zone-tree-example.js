/* global dns */ // example

// example tree for hellomouse.net
module.exports = {
  A: { type: 'static', data: [{ address: '91.92.144.105' }] },
  AAAA: { type: 'static', data: [{ address: '2a07:1c44:3980::2' }] },

  child: {
    'tinc': {
      A: { type: 'static', data: [{ address: '172.19.24.1' }] },
      AAAA: { type: 'static', data: [{ address: '2a07:1c44:39f3::' }] }
    },

    'fancy-dynamic-zone': {
      all: {
        type: 'dynamic',
        handler: async function fancyDynamicZoneHandler(ctx) {
          ctx.answer.push(new dns.TXT(['hello!']));
          console.log('dynamic zone called');
        }
      }
    },

    // not that this will actually work but meh
    'google': {
      all: { type: 'CNAME', destination: 'www.google.com' }
    },

    'technically-tinc': {
      // internal alias relative to zone root (hellomouse.net)
      all: { type: 'internalAlias', destination: 'tinc' }
    },

    'gns': {
      // external alias used to point to other zones perhaps
      all: { type: 'externalAlias', destination: 'github-notifications.app' },
      child: {
        '*': {
          all: { type: 'externalAlias', destination: 'github-notifications.app' }
        }
      }
    }
  }
};
