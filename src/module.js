const config = require('./config');
const debug = require('debug')('dnsd:module');
const MAX_REDIRECTS = config.maxRedirects;

/** Module class for common APIs */
class Module {
  /**
   * The constructor
   * @param {string} name - Name in the DNS hierarchy the module will take
   */
  constructor(name) {
    this.name = name;
  }
  /**
   * Handles a question, mutating as needed
   * @param {Context} ctx - Context for request
   */
  async handle(ctx) {

  }
  /** Removes any modification or hook that the module uses */
  unload() {

  }
}

/** Answers specific zones */
class Zone extends Module {
  /**
   * The constructor
   * @param {string} name - Name of the zone in the DNS hierarchy
   * @param {object} tree - Resolving tree
   * @param {object} authority - Zone authority data (will be put into SOA record)
   */
  constructor(name, tree, authority) {
    super(name);
    this._nameLabels = name.split('.').length;
    this.type = 'resolver';
    this.tree = tree;
    this.authority = {
      type: 'SOA',
      class: 'IN',
      name: authority.mname,
      ttl: authority.refresh,
      data: authority
    }; // Wrap in the required data key
    if (this.authority.data.minimum < this.authority.data.refresh) {
      throw new Error(`Zone ${name}'s SOA records minimum and refresh are conflicting`);
    }
  }

  /**
   * Finds the correct handler inside the zone
   * @param {string} name - Domain name
   * @param {string} type - Resource record asked for in question
   * @return {Function} - Tree leaf with the handler
   */
  findHandler(name, type) {
    let cursor = this.tree;
    let labels = name.split('.').reverse().slice(this._nameLabels);
    for (let label of labels) {
      if (cursor.type || cursor?.['ANY']?.type) break;
      if (cursor?.child?.['*']) {
        cursor = cursor.child['*'];
        break;
      }
      cursor = cursor?.child?.[label];
      if (!cursor) return {};
    }
    return cursor;
  }
  /**
   * Handles a question, mutating as needed
   * @param {Context} ctx - Context for request
   */
  async handle(ctx) {
    let leaf = this.findHandler(ctx.question.normalizedName, ctx.question.type);
    debug('LEAF %O %s', leaf, leaf.toString());
    let handler = leaf[ctx.question.type] || leaf.ANY || leaf || { type: 'next' };
    ctx.response.soa = this.authority;
    if (ctx.question.type == 'SOA') ctx.response.pushAnswer(Object.assign(this.authority, { name: ctx.question.name }));
    switch (handler.type || 'static') {
      case 'static': {
        if (!handler.data) return;
        handler.data.forEach(record => {
          let rr = Object.assign({
            type: ctx.question.type,
            name: ctx.question.name,
            ttl: this.authority.data.refresh
          }, record);
          if (rr.ttl > this.authority.data.minimum) rr.ttl = this.authority.data.minimum;
          if (rr.authority) ctx.response.pushAuthority(rr);
          else ctx.response.pushAnswer(rr);
        });
        break;
      }
      case 'CNAME': {
        ctx.response.pushAnswer({
          type: 'CNAME',
          data: handler.data.destination,
          name: ctx.question.name,
          ttl: this.authority.data.refresh
        });
        let dest = handler.data.destination.toLowerCase();
        // make sure it's in this zone before doing crazy redirects
        if (!(dest.endsWith('.' + this.name) || dest === this.name)) break;
      }
      // fall through (lazy coding)
      case 'internalRedirect': {
        ctx.question.redirectCount++;
        if (ctx.question.redirectCount > MAX_REDIRECTS) {
          throw new Error('Exceeded maximum internal redirects count');
        }
        ctx.question.name = handler.data.destination;
        ctx.question.normalizedName = ctx.question.name.toLowerCase();
        await this.handle(ctx);
        break;
      }
      case 'dynamic': {
        await handler.handler(ctx);
        break;
      }
      case 'next': {
        await ctx.next();
        break;
      }
    }
    // TODO: add SOA record to authority section when we have a NOERROR/NXDOMAIN
    // with an empty answer section
  }
}
/** Modifies the packet for specific trees (and all their childs) */
class Middleware extends Module {
  /**
   * The constructor
   * @param {string} name - Name of the zone in the DNS hierarchy
   * @param {Function} handler - Handler for the middleware
   */
  constructor(name, handler) {
    super(name);
    this.type = 'middleware';
    this.handler = handler;
  }
  /**
   * Handles a question, mutating as needed
   * @param {Context} ctx - Context for request
   */
  async handle(ctx) {
    await this.handler(ctx);
  }
}
module.exports = {
  Zone,
  Middleware
};
