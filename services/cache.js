const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const redisUrl = 'reddis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options ={}) {
  this._cache = true;
  this.hashKey= JSON.stringify(options.key ||" ")
  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this._cache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );
  //check if the ky exist in redis
  const cachedValue = await client.hget(key,this.hashKey);
  //if yes return that
  // client.FLUSHALL()
  if (cachedValue) {
    const doc = JSON.parse(cachedValue);
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }
  //else aget dat from mongoose
  const result = await exec.apply(this, arguments);
  client.hset(this.hashKey,key, JSON.stringify(result));
  return result;
};

module.exports = {
    clearCache : function (hashKey) {
        client.del(JSON.stringify(hashKey))
    }
}