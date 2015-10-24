"use strict";

var EventEmitter = require('events').EventEmitter;

class Receiver extends EventEmitter {
	constructor(redis, config) {
		super();

		this.config = config;
		this.redis = redis;

		this.checkTimer = null;

		this._started = false;

		this.processing = false;
	}

	get started() {
		return this._started;
	}

	start() {
		var config = this.config,
			self = this;

		return new Promise((resolve, reject) => {
			self.checkTimer = setInterval(
								self.receive.bind(self),
								config.RECEIVER_POOL_INTERVAL);

			self._started = true;

			self.emit('start');

			resolve();
		});
	}

	receive() {
		var redis = this.redis,
			config = this.config,
			self = this;

		if(self.processing) {
			return;
		}

		return redis
			.rpoplpush(NS_MSG_QUEUE, NS_MSG_RECEIVED)
			.then((msg) => {
				if(msg !== null) {
					self.emit('message', {
						"message": msg,
						"ack": (err) => self.ack(err, msg)
					});
				}
			})
		;
	}

	ack(err, msg) {
		var redis = this.redis,
			self = this;

		if(err) {
			return redis
				.multi()
				.lrem(NS_MSG_RECEIVED, 0, msg)
				.lpush(NS_MSG_ERROR, msg)
				.exec()
				.then(() => self.emit('ack_error', ''))
				.catch((err) => {
					console.error(err);
					//process.exit();
				})
			;
		}

		return redis
			.lrem(NS_MSG_RECEIVED, 0, msg)
			.then((cnt) => self.emit('ack', msg))
			.catch((err) => {
				console.error(err);
				//process.exit();
			});
	}

	stop() {
		var self = this;

		if(!this._started) {
			return new Promise((resolve) => resolve());
		}

		return new Promise((resolve, reject) => {
			if(self.checkTimer) {
				clearInterval(this.checkTimer);
			}

			self.checkTimer = null;

			self._started = false;

			self.emit('stop');

			resolve();
		});
	}
}

module.exports = Receiver;
