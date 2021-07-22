const DnsPacket = require('dns-packet');
const rcodes = require('dns-packet/rcodes');
const QueryProcessor = require('./src/query');
const config = require('./src/config');

const proto = './pb/dns.proto';
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const protocolDefinition = protoLoader.loadSync(proto);
const DnsProto = grpc.loadPackageDefinition(protocolDefinition).coredns.dns;
const queryProcessor = new QueryProcessor();
queryProcessor.reload();

/**
 * Top-level query processor that promisifies the system and (de)serializes
 *
 * @param {object} call - gRPC call object
 * @param {Buffer} call.msg - contains the serialized DNS packet
 * @param {function} callback - callback called with (error, result)
 */
function processQuery(call, callback) {
  const packet = DnsPacket.decode(call.request.msg);
  queryProcessor.answer(packet).then(response => {
    console.log(response.answers[0]);
    callback(null, { msg: DnsPacket.encode(response) });
  }).catch(err => {
    packet.type = 'response';
    packet.flags |= rcodes.toRcode('SERVFAIL');
    console.error('ERROR', err, packet);
    callback(null, { msg: DnsPacket.encode(packet) });
  });
}

const server = new grpc.Server();
server.addService(DnsProto.DnsService.service, { Query: processQuery });
server.bind(config.bind, grpc.ServerCredentials.createInsecure());
server.start();

process.on('SIGHUP', () => queryProcessor.reload());
