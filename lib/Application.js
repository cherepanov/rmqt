"use strict";

var EventEmitter = require('events').EventEmitter;
var Redis = require('ioredis');

var Sender = require("./Sender");
var Receiver = require("./Receiver");
var Checker = require("./Checker");

class Application extends EventEmitter {
	constructor(redis, config) {
		super();

		this.redis = redis;
		this.sender = new Sender(redis, config.rmqt);
		this.receiver = new Receiver(redis, config.rmqt);
		this.checker = new Checker(redis, config.rmqt);

		this.messageHandlers = [];

		//TODO: move somewhere
		this.checker.on('start', () => console.log('CHECKER STARTED'));
		this.checker.on('stop', () => console.log('CHECKER STOPPED'));
		this.checker.on('fail', (result) => console.log('CHECKER CHECK::', result));

		this.sender.on('start', () => console.log('SENDER STARTED'));
		this.sender.on('stop', () => console.log('SENDER STOPPED'));
		this.sender.on('sent', (result) => console.log('SENDER SENT', result));
		this.sender.on('alive', (result) => console.log('SENDER ALIVE'));

		this.receiver.on('start', () => console.log('RECEIVER STARTED'));
		this.receiver.on('message', (msg) => console.log('RECEIVER MESSAGE', msg));
		this.receiver.on('ack_error', (msg) => console.error('RECEIVER ACK ERROR', msg));
		this.receiver.on('ack', (msg) => console.log('RECEIVER ACK', msg));
		this.receiver.on('stop', () => console.log('RECEIVER STOPPED'));
	}

	switchToSender() {
		var sender = this.sender,
			receiver = this.receiver,
			checker = this.checker;

		return Promise
			.all([receiver.stop(), checker.stop()])
			.then(() => {
				return sender.start();
			})
			.catch((err) => {
				console.error(err);
			})
		;
	}

	switchToReceiver() {
		var self = this,
			receiver = this.receiver,
			checker = this.checker;

		receiver.start();
		receiver.on('message', (evt) => {
			var delay = (Math.random() * 1000).toFixed(),
				err = (Math.random() > 0.85) ? true : null,
				msg = evt.message,
				ack = evt.ack;

			console.log('start ack', msg);
			var t = setTimeout(() => {
				console.log('end ack', msg);
				self.messageHandlers.splice(self.messageHandlers.indexOf(t), 1);
				ack(err);
			}, delay);

			self.messageHandlers.push(t);
		});

		checker.start();
		checker.on('fail', () => self.switchToSender());
	}

	run() {
		var redis = this.redis,
			self = this;

		redis
			.exists(NS_EMITTER_PRESENCE)
			.then((result) => {
				console.log('app start, emitter presence', result);

				if(!result) {
					self.switchToSender();
				} else {
					self.switchToReceiver();
				}
			})
		;
	}

	stop() {
		var receiver = this.receiver,
			sender = this.sender,
			checker = this.checker,
			self = this,
			stopPromise = [
				receiver.stop(),
				sender.stop(),
				checker.stop()];

		console.log("shutdown..");

		if(this.messageHandlers.length > 0) {
			console.log('wait message handlers');
			stopPromise.push(new Promise((resolve,reject) => {
				//TODO: dear god, help me to find better solution
				var i = setInterval(()=>{
					if(self.messageHandlers.length === 0) {
						clearInterval(i);
						resolve();
					}
				}, 0);
			}));
		}

		return Promise.all(stopPromise);

	}
}

module.exports = Application;