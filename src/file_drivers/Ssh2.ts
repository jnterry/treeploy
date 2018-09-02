/**
 * Exports a file driver which manipulates a remote file system over SSH2
 *
 * Note that this driver actually runs shell commands, rather than starting a
 * SFTP session over the SSH connection in order to manipulate the file system
 *
 * This is because we want to support the use case where we login as user A,
 * and then use sudo privledges to make changes to root owned parts of the
 * file system, or set file owners, etc. This is not possible using SFTP unless
 * you log in as root as you cannot somehow start the session as sudo, and you
 * cannot use sudo within SFTP. However we don't want to have to force root
 * logins as some servers may not permit root login
 *
 * See:
 * - https://github.com/mscdex/ssh2/issues/287
 * - https://github.com/mscdex/ssh2/issues/626
 *
 * If we ever want to support file streams with this method rather than
 * reading/writing entire contents at once we would have to use tee/cat
 * commands as per: https://github.com/mscdex/ssh2/issues/626#issuecomment-337250142
 *
 * Note that the user we log in as MUST be setup as being able to use sudo
 * without a password in order for this to work
 *
 */

import os                 from 'os';

import * as SSH from 'node-ssh';
const NodeSsh = require('node-ssh') as SSH.SSH;


import { FileDriver, FileDriverOptions, IFileDriverFactory } from './FileDriver';
import { PathAttr, PathType, IWriter, IReader }              from './FileDriverTypes';
import log                                                   from './../log';

class Ssh2Reader implements IReader {

	private client          : any;
	private use_sudo        : boolean;
	private sudo_successful : boolean;

	constructor(client : any, use_sudo : boolean){
		this.client          = client;
		this.use_sudo        = use_sudo;
		this.sudo_successful = false;
	}

	protected async execCmdMaybeSudo(cmd : Array<string>) : Promise<SSH.ExecCommandResult>{
		if(this.use_sudo){

			if(!this.sudo_successful){
				// lets test we can actually sudo, since if we can't but
				// use_sudo is set we sometimes get we get stuck in infinite
				// loops where we keep trying to make a directories parents, but
				// a directory not existing looks the same as the error of
				// "sudo: no tty present and no askpass program specified"
				// as both exit with code 1
				//
				// :TODO: ideally if running treeploy interactively we should
				// somehow pipe the password to sudo from local terminal...
				let result = await this.client.execCommand('sudo /bin/true');
				if(result.code === 0){
					this.sudo_successful = true;
				} else {
					throw new Error("Sudo failed: " + result.stderr);
				}
			}

			// We can't just stick sudo in front of the command as it may contains
			// pipes etc, and we want to run the whole thing as root, not just the
			// first part
			return this.client.execCommand(
				"sudo /bin/sh -c '" + cmd.join(' ').replace("'", "/'") + "'"
			);
		} else {
			return this.client.execCommand(cmd.join(' '), {});
		}
	}

	async readFile(path : string) : Promise<Buffer> {
		return this
			.execCmdMaybeSudo(['cat', path])
			.then((result) => {
				if(result.code === 0){
					return Buffer.from(result.stdout);
				} else {
					throw new Error("Failed to read file '" + path +
													"': " + result.stderr
												 );
				}
			});
	}

	async readdir(path : string) : Promise<any[]> {
		return this
			.execCmdMaybeSudo(['ls', path, '-a'])
			.then((result) => {
				return result.stdout
					.split('\n')
					.filter((x) => x !== '.' && x !== '..');
			});
	}

	async getPathType(path : string) : Promise<PathType> {
		return this.
			execCmdMaybeSudo(['stat', path, '--format="%F"'])
			.then((result) => {
				if(result.code === 0){
					// then path exists, and we've stat-ed it
					switch(result.stdout){
						case 'directory'          : return PathType.Directory;
						case 'regular file'       : return PathType.File;
						case 'regular empty file' : return PathType.File;
						default:              return PathType.Other;
					}
				} else {
					// we have no way of determining if the path does not exist, or if we
					// just don't have permission to see it
					return PathType.NoExist;
				}
			});
	}

	async getAttributes(path : string) : Promise<PathAttr> {
		return this
			.execCmdMaybeSudo(['stat', path, '--format="%u|%g|%f"'])
			.then((result) => {
				if(result.code !== 0){
					throw new Error("Failed to determine attributes for: "
													+ path + ": " + result.stderr
												 );
				} else {
					let parts = result.stdout.split("|");
					if(parts.length !== 3){
						throw new Error("Failed to determine attributes for: " +
														path + ": Remote stat result was of invalid format"
													 );
					} else {
						return {
							owner : parseInt(parts[0]),
							group : parseInt(parts[1]),
							mode  : '0' + (parseInt(parts[2], 16) & parseInt('777', 8)).toString(8),
						};
					}
				}
			});
	};
};

class Ssh2Writer extends Ssh2Reader implements IWriter {
	constructor(client : any, use_sudo : boolean){
		super(client, use_sudo);
	}

	async writeFile(path : string, content : String | Buffer) : Promise<void>{
		return this
			.execCmdMaybeSudo(['echo', content.toString(), '>', path])
			.then((result) => {
				if(result.code === 0){
					return;
				}
				throw new Error("Failed to write file: " + path + ": " + result.stderr);
			});
	}

	async mkdirComponent(path : string) : Promise<void>{
		return this
			.execCmdMaybeSudo(['[ -d foo ] || mkdir', '-p', path])
			.then((result) => {
				if(result.code === 0){
					return;
				}
				throw new Error("Failed to create directory: " + path + ": " + result.stderr);

			});
		return;
	}

	async remove(path : string) : Promise<void> {
		return this
			.execCmdMaybeSudo(['rm', '-r', path])
			.then((result) => {
				if(result.code === 0){
					return;
				}
				throw new Error("Failed to delete path: " + path + ": " + result.stderr);
			});
	};

	async setAttributes(path : string, attributes : PathAttr) : Promise<void> {
		try {
			if(attributes.owner != null) {
				await this
					.execCmdMaybeSudo(['chown', '' + attributes.owner, path])
					.then((result) => {
						if(result.code === 0){ return; }
						throw new Error(result.stderr);
					});
			}


			if(attributes.group != null){
				await this
					.execCmdMaybeSudo(['chgrp', '' + attributes.group, path])
					.then((result) => {
						if(result.code === 0){ return; }
						throw new Error(result.stderr);
					});
			}

			if(attributes.mode != null){
				await this
					.execCmdMaybeSudo(['chmod', attributes.mode, path])
					.then((result) => {
						if(result.code === 0){ return; }
						throw new Error(result.stderr);
					});
			}
		} catch (e) {
			throw new Error("Failed to modifiy attributes of: " + path + ": " + e.message);
		}
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


async function createSsh2Driver(options : FileDriverOptions) : Promise<FileDriver> {

	let ssh_target = parseSshTarget(options.path);

	let client = new NodeSsh();

	if(options.driver.key_file != null && options.driver.key_string != null){
		throw new Error("Cannot specifiy both key_file and key_string simultaniously");
	}

	return client
		.connect({
			host       : ssh_target.hostname,
			port       : 22, // :TODO: support non-standard ports
			username   : ssh_target.username,
			agent      : options.driver.agent_socket || process.env['SSH_AUTH_SOCK'],
			password   : options.driver.password != null ? options.driver.password.toString() : undefined,
			privateKey : options.driver.key_file || options.driver.key_string // node-ssh will automatically load the file if its a path
		}).catch((err : any) => {
			throw new Error("Failed to connect to " + ssh_target.username + "@"
											+ ssh_target.hostname + ": " + err.message
										 );
		}).then(() => {
			log.info("Connection to " + ssh_target.hostname +
							 " established as user: " + ssh_target.username
							);

			let use_sudo = false;
			if(options.driver != null && options.driver.use_sudo){
				use_sudo = true;
			}

			if(!options.writes_enabled){
				let reader = new Ssh2Reader(client, use_sudo);
				return new FileDriver(options, ssh_target.path, reader, undefined);
			} else {
				let writer = new  Ssh2Writer(client, use_sudo);
				return new FileDriver(options, ssh_target.path, writer, writer);
			}
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
