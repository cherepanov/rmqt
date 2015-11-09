"use strict";

var EventEmitter = require('events').EventEmitter;

class Checker extends EventEmitter {
	constructor(redis, config) {
		super();

		this.redis = redis;
		this.config = config;
		this.checkTimer = null;
		this._started = false;

		this.setup();
	}

	setup() {
		var config = this.config,
			redis = this.redis;

		redis.defineCommand('check', {
			numberOfKeys: 0,
			lua:
				`if redis.call('exists', '${NS_EMITTER_PRESENCE}') == 1 then
					return true
				else
				   redis.call('psetex', '${NS_EMITTER_PRESENCE}', ${config.SENDER_ALIVE_TIMEOUT}, '1')
				   return false
				end`
		});
	}

	get started() {
		return this._started;
	}

	check() {
		var redis = this.redis;

		return redis
			.check()
			.then((result) => {
				if(!result) {
					this.emit('fail', false);
					this.stop();
				} else {
					this.checkTimer = setTimeout(() => this.check(), this.config.SENDER_CHECK_INTERVAL);
				}

				return result;
			})
		;
	}

	start() {
		this.checkTimer = setTimeout(
			this.check.bind(this),
			this.config.SENDER_CHECK_INTERVAL);

		this._started = true;

		this.emit('start');

		return new Promise((resolve, reject) => resolve());
	}

	stop() {
		if(!this._started) {
			return new Promise((resolve) => resolve());
		}

		return new Promise((resolve, reject) => {
			if (this.checkTimer) {
				clearTimeout(this.checkTimer);
			}
			this.checkTimer = null;

			this._started = false;

			this.emit('stop');

			resolve();
		});
	}
}

module.exports = Checker;