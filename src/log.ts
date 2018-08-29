/**
 * Simple logging helper
 */

import cli from 'colors/safe';

interface LoggerWriteFunc {
	(str : string): void,
}

export interface Logger {
	/** The verbosity level of this logger:
		* - 0: errors only
		* - 1: above and warnings
		* - 2: above, info and debug
		* - 3: above and trace
	 **/
	readonly level : number,

	/** Writes error message to console */
	error    : LoggerWriteFunc,

	/** Writes warning to console */
	warn     : LoggerWriteFunc,

	/** Writes info message to console */
	info     : LoggerWriteFunc,

	/** Writes debug message to console */
	debug    : LoggerWriteFunc,

	/** Writes trace message to console */
	trace    : LoggerWriteFunc,

	setLevel : ((level : number) => void)
}

function writeError  (str : string): void { console.error(cli.red   ("ERROR | ") + str); }
function writeWarning(str : string): void { console.log  (cli.yellow("WARN  | ") + str); }
function writeInfo   (str : string): void { console.log  (cli.cyan  ("INFO  | " + str)); }
function writeDebug  (str : string): void { console.log  (cli.white ("DEBUG | " + str)); }
function writeTrace  (str : string): void { console.log  (cli.grey  ("TRACE | " + str)); }
function noop        (str : string): void {                                              }

/**
 * The global Logger instance, this is the default export of this module
 */
let global_instance : Logger = {
	level    : 0,
	error    : writeError,
	warn     : noop,
	debug    : noop,
	info     : noop,
	trace    : noop,
	setLevel : setLevel,
};

/**
 * Sets the level of the global logger
 */
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

export default global_instance;
