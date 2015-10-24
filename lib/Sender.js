"use strict";

var EventEmitter = require('events').EventEmitter;

class Sender extends EventEmitter {

	constructor(redis, config) {
		super();

		this.config = config;
		this.redis = redis;

		this.sendTimer = null;
		this.updateAliveTimer = null;

		this._started = false;

		this.setup();
	}

	get started() {
		return this._started;
	}

	setup() {
		var redis = this.redis;

		redis.defineCommand('send', {
			numberOfKeys: 0,
			lua:
			`local cnt = redis.call('incr', '${NS_MSG_COUNTER}')
			redis.call('lpush', '${NS_MSG_QUEUE}', '{id:' .. cnt .. ', payload: ' .. ARGV[1] .. '}')
			return cnt`
		});
	}

	updateAlive() {
		var redis = this.redis,
			config = this.config,
			self = this;

		redis
			.psetex(NS_EMITTER_PRESENCE, config.SENDER_ALIVE_TIMEOUT, 1)
			.then((result) => self.emit('alive', result))
		;
	}

	send(payload) {
		var redis = this.redis,
			self = this;

		redis
			.send(payload)
			.then((result) => {
				self.emit('sent', result);
			})
		;
	}

	start() {
		var config = this.config,
			self = this;

		this.sendTimer = setInterval(
			() => self.send(+ new Date),
			config.EMIT_INTERVAL);

		this.updateAliveTimer = setInterval(
			this.updateAlive.bind(this),
			config.SENDER_ALIVE_TIMEOUT / 2);

		this._started = true;

		this.emit('start');

		return new Promise((resolve, reject) => resolve());
	}

	stop() {
		var self = this,
			redis = this.redis;

		if(!this._started) {
			return new Promise((resolve) => resolve());
		}

		return redis
			.del(NS_EMITTER_PRESENCE)
			.then(function() {
				if(self.sendTimer) {
					clearInterval(self.sendTimer);
				}
				self.sendTimer = null;

				if(self.updateAliveTimer) {
					clearInterval(self.updateAliveTimer);
				}
				self.updateAliveTimer = null;

				self._started = false;

				self.emit('stop');
			})
		;
	}
}

module.exports = Sender;
