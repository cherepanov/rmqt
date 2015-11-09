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
		var config = this.config;

		return new Promise((resolve, reject) => {
			this.checkTimer = setInterval(
								this.receive.bind(this),
								config.RECEIVER_POOL_INTERVAL);

			this._started = true;

			this.emit('start');

			resolve();
		});
	}

	receive() {
		var redis = this.redis,
			config = this.config;

		if(this.processing) {
			return;
		}

		return redis
			.rpoplpush(NS_MSG_QUEUE, NS_MSG_RECEIVED)
			.then((msg) => {
				if(msg !== null) {
					this.emit('message', {
						"message": msg,
						"ack": (err) => this.ack(err, msg)
					});
				}
			})
		;
	}

	ack(err, msg) {
		var redis = this.redis;

		if(err) {
			return redis
				.multi()
				.lrem(NS_MSG_RECEIVED, 0, msg)
				.lpush(NS_MSG_ERROR, msg)
				.exec()
				.then(() => this.emit('ack_error', ''))
				.catch((err) => {
					console.error(err);
					//process.exit();
				})
			;
		}

		return redis
			.lrem(NS_MSG_RECEIVED, 0, msg)
			.then((cnt) => this.emit('ack', msg))
			.catch((err) => {
				console.error(err);
				//process.exit();
			});
	}

	stop() {
		if(!this._started) {
			return new Promise((resolve) => resolve());
		}

		return new Promise((resolve, reject) => {
			if(this.checkTimer) {
				clearInterval(this.checkTimer);
			}

			this.checkTimer = null;

			this._started = false;

			this.emit('stop');

			resolve();
		});
	}
}

module.exports = Receiver;
