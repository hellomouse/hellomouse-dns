const DnsPacket = require('dns-packet');

/** Light wrapper around packet with a bunch of utility methods */
module.exports = class Packet {
  /**
   * The constructor
   * @param {DnsPacket} packet
   */
  constructor(packet) {
    this.packet = packet;
  }
  /** Marks the packet as a response */
  setResponse() {
    this.packet.type = 'response';
  }
  /** Marks the packet as a query */
  setQuery() {
    this.packet.type = 'query';
  }
  /** Clears all the flag bits */
  clearFlags() {
    this.packet.flags = 0;
  }
  /** Sets the authoritative bit (aa) */
  setAuthoritative() {
    this.packet.flags |= DnsPacket.AUTHORITATIVE_ANSWER;
  }
  /** Clears the authoritative bit (aa) */
  clearAuthoritative() {
    this.packet.flags &= ~DnsPacket.AUTHORITATIVE_ANSWER;
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
};
