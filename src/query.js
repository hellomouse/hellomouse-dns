const DnsPacket = require('dns-packet');
const rcodes = require('dns-packet/rcodes');
const fs = require('fs');
const v8 = require('v8');
const config = require('./config');

/** Light wrapper around packet with a bunch of utility methods */
class Response {
  /**
   * The constructor
   * @param {DnsPacket} packet Query packet which this response is for
   */
  constructor(packet) {
    // deep cloning but v8 does it for us instead
    this.packet = v8.deserialize(v8.serialize(packet));
    this.packet.type = 'response';
    this.packet.flags = 0;

    this.rcode = 'NOERROR';
    this.flags = {
      authoritative: false, // aa
      truncated: false, // tc
      recursionDesired: false, // rd
      recursionAvailable: false, // ra
      authenticData: false, // ad
      checkingDisabled: false, // cd
      dnssecOk: false
    };
  }
  /**
   * Adds an answer to the answer section
   * @param {object} answer - Resource Record to add
   */
  pushAnswer(answer) {
    this.packet.answers.push(answer);
  }
  /**
   * Adds an answer to the authority section
   * @param {object} authority - Resource Record to add
   */
  pushAuthority(authority) {
    this.packet.authorities.push(authority);
  }
  /** Write changes (rcode, flags, etc) back to DnsPacket object */
  _write() {
    let flags = this.flags;
    let packet = this.packet;
    packet.flags = rcodes.toRcode(this.rcode);
    if (flags.authoritative) packet.flags |= DnsPacket.AUTHORITATIVE_ANSWER;
    if (flags.truncated) packet.flags |= DnsPacket.TRUNCATED_RESPONSE;
    if (flags.recursionDesired) packet.flags |= DnsPacket.RECURSION_DESIRED;
    if (flags.recursionAvailable) packet.flags |= DnsPacket.RECURSION_AVAILABLE;
    if (flags.authenticData) packet.flags |= DnsPacket.AUTHENTIC_DATA;
    if (flags.checkingDisabled) packet.flags |= DnsPacket.CHECKING_DISABLED;
    if (flags.dnssecOk) packet.flags |= DnsPacket.DNSSEC_OK;
  }
}

/** Represents a context for handler execution */
class Context {
  /**
   * The constructor
   * @param {any} question
   * @param {DNSPacket} request
   * @param {Response} response
   * @param {Config} config
   */
  constructor(question, request, response, config) {
    this.question = question;
    this.request = request;
    this.response = response;
    this.config = config;
  }
}

/** Processes queries */
class QueryProcessor {
  /** The constructor */
  constructor() {
    this.resolverTree = { child: {} };
    this.middlewareTree = { child: {} };
    this.middlewares = [];
  }
  /** Reloads the modules, loading index from all the folders in the modules folder */
  reload() {
    // reload configuration provide
    config.reload();
    this.middlewares = [];
    fs.readdirSync(__dirname + '/../modules').forEach(moduleFile => {
      console.log('Loading module ' + moduleFile);
      moduleFile = require.resolve(`../modules/${moduleFile}`);
      delete require.cache[moduleFile];
      const module = require(moduleFile);
      if (module === null) return; // ignore
      if (!module) {
        console.error('Invalid module: ' + moduleFile);
        return;
      }
      if (typeof module.name !== 'string') {
        console.error(`Module ${moduleFile} does not specify the required "name" attribute, ignoring`);
        return;
      }
      let modules;
      switch (module.type) {
        case 'middleware': {
          modules = this.middlewares;
          if (!module.name.length) return modules.push(module);
          break;
        }
        case 'resolver': {
          modules = this.resolverTree;
          break;
        }
        default: return;
      }
      module.name.split('.').reverse().reduce((cursor, key, index, namearr) => {
        if (index === namearr.length - 1) {
          if (cursor.child[key] && cursor.child[key].handler) {
            cursor[key].handler.unload();
          }
          cursor.child[key] = { child: {}, handler: module };
        } else cursor.child[key] = cursor.child[key] || { child: {} };
        return cursor.child[key];
      }, modules);
    });
  }
  /**
   * Finds a list of resolvers and middlewares
   * @param {string} name - Domain name of the question
   * @return {Array} - List of resolvers to use
   */
  findResolver(name) {
    let resolvers = [...this.middlewares];
    name.split('.').reverse().reduce((cursor, key) => {
      if (!cursor) return;
      if (cursor.handler) resolvers.push(cursor.handler);
      if (cursor.child[key] && cursor.child[key].handler) resolvers.push(cursor.child[key].handler);
      return cursor.child[key];
    }, this.resolverTree);
    resolvers = resolvers.reverse();
    name.split('.').reverse().reduce((cursor, key) => {
      if (!cursor) return;
      if (cursor.handler) resolvers.push(cursor.handler);
      if (cursor.child[key] && cursor.child[key].handler) resolvers.push(cursor.child[key].handler);
      return cursor.child[key];
    }, this.middlewareTree);
    return resolvers;
  }
  /**
   * Gives an answer to a dns packet
   * @param {DnsPacket} packet - DNS packet to answer
   * @return {DnsPacket} - Response DNS packet
   */
  async answer(packet) {
    const response = new Response(packet);
    response.flags.authoritative = true;
    for (const question of packet.questions) {
      question.normalizedName = question.name.toLowerCase();
      question.originalName = question.name;
      question.redirectCount = 0;
      const resolvers = this.findResolver(question.normalizedName);
      const ctx = new Context(question, packet, response, config);
      /** Closure that czs the next resolver */
      let next = async () => {
        if (resolvers.length) await resolvers.pop().handle(ctx);
      };
      ctx.next = next;
      // handle errors
      // errors can also additionally be handled by middleware
      try {
        await ctx.next();
      } catch (err) {
        response.rcode = 'SERVFAIL';
        if (config.debug && err.stack) {
          // why not lols
          for (let line of err.stack.split('\n')) {
            response.pushAnswer({
              name: ctx.question.name,
              type: 'TXT',
              data: line
            });
          }
        }
      }
    }
    response._write();
    if (response.packet.answers.length === 0 && response.rcode === 'NOERROR' && response.soa) {
      response.pushAuthority(response.soa);
    }
    return response.packet;
  }
}

module.exports = QueryProcessor;
