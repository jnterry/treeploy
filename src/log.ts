/**
 * Simple logging helper
 */

import cli from 'colors/safe';

console.dir(cli);

interface LoggerWriteFunc {
	(str : string): void,
}

export interface Logger {
	readonly level : number,

	error    : LoggerWriteFunc,
	warn     : LoggerWriteFunc,
	debug    : LoggerWriteFunc,
	info     : LoggerWriteFunc,
	trace    : LoggerWriteFunc,

	setLevel : ((level : number) => void)
}

function writeError  (str : string): void { console.error(cli.red   ("ERROR | ") + str); }
function writeWarning(str : string): void { console.log  (cli.yellow("WARN  | ") + str); }
function writeInfo   (str : string): void { console.log  (cli.cyan  ("INFO  | " + str)); }
function writeDebug  (str : string): void { console.log  (cli.white ("DEBUG | " + str)); }
function writeTrace  (str : string): void { console.log  (cli.grey  ("TRACE | " + str)); }
function noop        (str : string): void {                                              }

let global_instance = {
	level    : 0,
	error    : writeError,
	warn     : noop,
	debug    : noop,
	info     : noop,
	trace    : noop,
	setLevel : setLevel,
};

function setLevel(level : number) : void {
	global_instance.warn  = noop;
	global_instance.debug = noop;
	global_instance.info  = noop;
	global_instance.trace = noop;

	if(level >= 1){
		global_instance.warn = writeWarning;
	}
	if(level >= 2){
		global_instance.info  = writeInfo;
		global_instance.debug = writeDebug;
	}
	if(level >= 3){
		global_instance.trace = writeTrace;
	}
}

export { global_instance as log };
