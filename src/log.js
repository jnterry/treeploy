/**
 * Simple logging helper
 */

const cli = require('colors/safe');

function writeError  (str){ console.error(cli.red   ("ERROR | ") + str); }
function writeWarning(str){ console.log  (cli.yellow("WARN  | ") + str); }
function writeInfo   (str){ console.log  (cli.cyan  ("INFO  | " + str)); }
function writeDebug  (str){ console.log  (cli.white ("DEBUG | " + str)); }
function writeTrace  (str){ console.log  (cli.grey  ("TRACE | " + str)); }
function noop(){}

function makeLogger(level){
	let logger = {
		error : writeError,
		warn  : noop,
		debug : noop,
		info  : noop,
		trace : noop,
	};

	if(level >= 1){
		logger.warn = writeWarning;
	}
	if(level >= 2){
		logger.info  = writeInfo;
		logger.debug = writeDebug;
	}
	if(level >= 3){
		logger.trace = writeTrace;
	}

	return logger;
}

module.exports = makeLogger;
