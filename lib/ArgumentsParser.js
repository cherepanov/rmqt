"use strict";

var yargs = require('yargs');

class ArgumentsParser {
	static parse(args) {
		var argv;

		try {
			argv = yargs(args)
				.exitProcess(false)
				.usage("Usage: $0 --config PATH [--dumpErrors]")
				.options({
					"config": {
						"alias": "c",
						"demand": true,
						"describe": "path to config",
						"type": "string"
					},
					"dumpErrors": {
						"alias": "d",
						"describe": "dump not handled messages and exit",
						"type": "boolean"
					},
					"reset": {
						"alias": "r",
						"descibe": "reset system state and exit",
						"type": "boolean"
					}
				})
				.argv
			;
		} catch (e) {
			argv = null;
		}

		return argv;
	}
}

module.exports = ArgumentsParser;