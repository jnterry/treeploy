/**
 * Exports a file driver which manipulates a remote file system over SSH2
 */

import { promisify }      from 'util';
import os                 from 'os';

const NodeSsh = require('node-ssh');

import { FileDriver, FileDriverOptions, IFileDriverFactory } from './FileDriver';
import { PathAttr, PathType, IWriter, IReader }              from './FileDriverTypes';
import log                                                   from './../log';

class Ssh2Reader implements IReader {

	async readFile(path : string) : Promise<Buffer> {
		return Buffer.from([]);
	}

	async readdir(path : string) : Promise<any[]> {
		return [];
	}

	async getPathType(path : string) : Promise<PathType> {
		return PathType.File;
	}

	async getAttributes(path : string) : Promise<PathAttr> {
		return {} as PathAttr;
	};
};

class Ssh2Writer implements IWriter {
	async writeFile(path : string, content : String | Buffer) : Promise<void>{
		return;
	}

	async mkdirComponent(path : string) : Promise<void>{
		return;
	}

	async remove(path : string) : Promise<void> {
		return;
	};

	async setAttributes(path : string, attributes : PathAttr) : Promise<void> {
		return;
	}
};


interface SshTarget {
	username : string,
	hostname : string,
	path     : string,
};

/**
 * Parses a string of the form user@host:/path to
 * create an SshTarget
 */
function parseSshTarget(path: string) : SshTarget {
	let parts = path.match(path_regex);

	if(parts == null){
		throw new Error("Failed to parse '" + path + "' as valid Ssh2 target");
	}

	let username    = parts[1];
	let hostname    = parts[2];
	let remote_path = parts[3];

	if(username == null){
		username = os.userInfo().username;
	} else {
		// trim off the trailing @
		username = username.substring(0, username.length-1);
	}

	if(remote_path == null){
		remote_path = './';
	}

	return {
		username : username,
		hostname : hostname,
		path     : remote_path,
	};
}


function createSsh2Driver(options : FileDriverOptions) : Promise<FileDriver> {

	let ssh_target = parseSshTarget(options.path);

	let client = new NodeSsh();

	return client
		.connect({
			host     : ssh_target.hostname,
			port     : 22, // :TODO: support non-standard ports
			username : ssh_target.username,
			agent    : process.env['SSH_AUTH_SOCK'],
		}).catch((err : any) => {
			throw new Error("Failed to connect to " + ssh_target.username + "@"
											+ ssh_target.hostname + ": " + err.message
										 );
		}).then(() => {
			log.info("Connection to " + ssh_target.hostname +
							 " established as user: " + ssh_target.username
							);

			let reader : IReader = new Ssh2Reader();
			let writer : IWriter | undefined;

			if(options.writes_enabled){
				writer = new Ssh2Writer();
			}

			return new FileDriver(options, reader, writer);
		});
}

// To quote the output of 'adduser' on ubuntu 18.04:
//
// adduser: To avoid problems, the username should consist only of
// letters, digits, underscores, full stops, at signs and dashes, and not start
// with a dash (as defined by IEEE Std 1003.1-2001). For compatibility with Samba
// machine accounts $ is also supported at the end of the username
//
// Note this may be too restrictive (see: https://stackoverflow.com/a/6949914/1313573)
// but if we allow any user name then 'thing/test@here.dir:name' could be parsed
// as both a ssh2 target, and a local file target so we'll err on the side of
// being too restrictive and then if a user really wants to use a stupid
// filename like above they will need to specify the driver manually
let path_regex_username = '[^-][A-Za-z0-9\.@-]*\\$?';

let path_regex_hostname = '[a-zA-Z0-9\._\-]+';

// disallow two slashes right at the start, since that probably implies
// a protocol, eg http://thing
let path_regex_filename = '/|/?[^/].*';

let path_regex = new RegExp('^' +
														'(' + path_regex_username + '@)?' +
														'(' + path_regex_hostname + '):' +
														'(' + path_regex_filename + ')' +
														'$'
													 );

export default {
	create     : createSsh2Driver,
	path_regex : path_regex,
	name       : 'ssh2',
} as IFileDriverFactory;
