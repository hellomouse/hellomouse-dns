const toData = v => ({
  data: v
});
const staticData = v => ({
  type: 'static',
  data: (v instanceof Array ? v : [v]).map(toData)
});
const dataMap = arr => staticData(arr.filter(Boolean).flat());
const host = (ipv4 = null, ipv6 = null) => {
  if (!(ipv4 instanceof Array)) ipv4 = [ipv4];
  if (!(ipv6 instanceof Array)) ipv6 = [ipv6];
  return {
    A: dataMap(ipv4),
    AAAA: dataMap(ipv6)
  };
};
const sshfpAlgorithms = {
  'reserved': 0,
  'rsa': 1,
  'dsa': 2,
  'ecdsa': 3,
  'ed25519': 4,
  'ed448': 6
};
const sshfpHashes = {
  'reserved': 0,
  'sha1': 1,
  'sha-1': 1,
  'sha256': 2,
  'sha-256': 2
};
const sshfp = (algorithm, hash, fingerprint) => ({
  algorithm: sshfpAlgorithms[algorithm.toLowerCase()],
  hash: sshfpHashes[hash.toLowerCase()],
  fingerprint: fingerprint
});
const txt = text => dataMap([text]);
const uri = (priority, weight, target) => ({
  priority,
  weight,
  target
});
const singleResource = (type, data) => ({ [type]: data });
const staticResource = (type, data) => ({ [type]: data });
const wildself = data => Object.assign({}, data, {
  child: {
    '*': data
  }
});
const cname = destination => ({
  ANY: {
    type: 'CNAME',
    data: { destination }
  }
});

const singleChild = (names, data) => {
  let obj = {};
  if (!(names instanceof Array)) names = [names];
  let ptr = names.reverse().slice(1).reverse().reduce((ptr, name) => {
    ptr.child = {};
    ptr.child[name] = {};
    return ptr.child[name];
  }, obj);
  ptr.child = {};
  ptr.child[names[0]] = data;
  return obj;
};
const apply = (parent, children) => {
  return Object.assign({}, parent, {
    child: children
  });
};
const srv = (priority, weight, port, target) => staticData({
  priority,
  weight,
  port,
  target
});
const any = data => ({ ANY: data });

module.exports = {
  staticData, dataMap, host, sshfp, txt, singleResource, staticResource,
  uri, wildself, cname, singleChild, apply, srv, any
};
