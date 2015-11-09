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
			config = this.config;

		redis
			.psetex(NS_EMITTER_PRESENCE, config.SENDER_ALIVE_TIMEOUT, 1)
			.then((result) => this.emit('alive', result))
		;
	}

	send(payload) {
		var redis = this.redis;

		redis
			.send(payload)
			.then((result) => {
				this.emit('sent', result);
			})
		;
	}

	start() {
		var config = this.config;

		this.sendTimer = setInterval(
			() => this.send(+ new Date),
			config.EMIT_INTERVAL);

		this.updateAliveTimer = setInterval(
			this.updateAlive.bind(this),
			config.SENDER_ALIVE_TIMEOUT / 2);

		this._started = true;

		this.emit('start');

		return new Promise((resolve, reject) => resolve());
	}

	stop() {
		var redis = this.redis;

		if(!this._started) {
			return new Promise((resolve) => resolve());
		}

		return redis
			.del(NS_EMITTER_PRESENCE)
			.then(() => {
				if(this.sendTimer) {
					clearInterval(this.sendTimer);
				}
				this.sendTimer = null;

				if(this.updateAliveTimer) {
					clearInterval(this.updateAliveTimer);
				}
				this.updateAliveTimer = null;

				this._started = false;

				this.emit('stop');
			})
		;
	}
}

module.exports = Sender;
