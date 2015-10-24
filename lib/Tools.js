"use strict";


class Tools {
	constructor(redis, config) {
		this.config = config;
		this.redis = redis;
	}

	dump() {
		var redis = this.redis;

		//TODO: kinda streaming
		return redis
				.multi()
				.lrange(NS_MSG_ERROR, 0, -1)
				.del(NS_MSG_ERROR)
				.exec()
		;
	}

	reset() {
		var redis = this.redis;

		return redis.del(NS_MSG_COUNTER, NS_MSG_QUEUE, NS_MSG_RECEIVED, NS_MSG_ERROR);
	}
}

module.exports = Tools;