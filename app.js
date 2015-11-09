#!/usr/bin/env node


"use strict";


// bootstrap

require("./lib/const");

process.title = PROCESS_BASE_NAME;

global.DEBUG = process.env["NODE_ENV"] === "development";

var ArgvParser = require("./lib/ArgumentsParser");

var args = ArgvParser.parse(process.argv);

if(!args) {
	process.exit();
}

var log4js = require("log4js");
log4js.configure({
	appenders: [
		{ type: "console" }
	],
	replaceConsole: true
});


// run

var Redis = require('ioredis');
var Application = require("./lib/Application");
var Tools = require("./lib/Tools");

var config, tools, application, redis;

config = require(args.config);

redis = new Redis(config.redis);

/*
if(DEBUG) {
	redis.monitor((err, monitor) => {
		monitor.on('monitor', (time, args) => {
			console.log(arguments);
		});
	});
}
*/

if(args.dumpErrors) {
	tools = new Tools(redis, config);
	tools
		.dump()
		.then((result) => {
			console.log(result);
			process.exit();
		})
	;
} else if(args.reset) {
	tools = new Tools(redis, config);
	tools
		.reset()
		.then(() => {
			process.exit();
		})
		.catch((error) => {
			console.error(error);
			process.exit();
		})
	;
} else {
	run();
}

function run() {
	application = new Application(redis, config);

	setTimeout(application.run.bind(application), DEBUG ? 6000 : 0);

	//TODO: redis disconnect
	['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGABRT', 'SIGTERM'].forEach((sig) => {
		process.on(sig, () => {
			application
				.stop()
				.then(() => {
					redis.disconnect();
					//process.exit();
				})
				.catch(((error) => {
					console.error(error);
					process.exit();
				}))
			;
		});
	});
}


