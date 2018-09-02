import fs            from 'fs';
import *  as pathlib from 'path';

import { IReader, IWriter, PathAttr, PathType } from './FileDriverTypes';
import log from '../log';

export { PathAttr, PathType } from './FileDriverTypes';

export interface FileDriverOptions {
	/**
	 * If set then treeploy is permitted to overwrite existing files
	 * with new content
	 */
	overwrite?     : boolean;

	/**
	 * Overwrite on steroids - if set then treeploy is permitted to take any
	 * measures necessary to get the target's state to be as it should, in
	 * essence this means removing files in order to write directories with the
	 * same name, or vice-versa
	 */
	force?         : boolean;

	/**
	 * The root path that the file driver can operate on
	 */
	path           : string;

	/**
	 * Whether the driver is allowed to make modifications to the filesystem
	 */
	writes_enabled : boolean;

	/** Driver specific option to be used by the IFileDriverFactory */
	driver : {
		// Which options are required depends entirely on the driver in use
		[key: string] : any,
	};

};

/**
 * Represents a set of actions that can be ran against some file system
 */
export class FileDriver {

	private options   : FileDriverOptions;
	private reader    : IReader;
	private writer    : IWriter;
	private root_path : string;

	/**
	 * Creates a new FileDriver which internally uses the specified reader and
	 * writer for all file operations
	 *
	 * @param options   Additional options affecting the [[FileDriver]]'s behaviour
	 * @param root_path The root path that the file driver is set to operate on
	 * @param reader    Implementation for file system querying functions
	 * @param writer    Implementation for file system modification functions
	 * If set to undefined then will silently convert all write operations to
	 * no-ops
	 *
	 */
	constructor(options   : FileDriverOptions,
							root_path : string,
							reader    : IReader,
							writer    : IWriter | undefined){

		this.options   = options;
		this.reader    = reader;
		this.root_path = root_path;

		if(writer === undefined){
			log.debug("Creating driver for: " + root_path + " as read only");

			this.writer = {
				writeFile      : async () => { return; },
				remove         : async () => { return; },
				setAttributes  : async () => { return; },
				mkdirComponent : async () => { return; },
			};
		} else {
			this.writer = writer;
		}
	}

	getRootPath() : string { return this.root_path; }

	/**
	 * Reads the contents of a file at some location
	 *
	 * @param path - The location of the file to read
	 */
	readFile(path : string) : Promise<Buffer> {
		log.trace("Reading file: " + path);
		return this.reader.readFile(path);
	}

	/**
	 * Determines if a path exists, and if so what type it is
	 *
	 * @param path The path to check
	 *
	 * @return Promise which resolves to [[PathType]] or rejects if we do not
	 * have sufficent permissions to check the type of the path
	 */
	getPathType(path : string) : Promise<PathType> {
		log.trace("Retrieving type of path: " + path);
		return this.reader.getPathType(path);
	}

	/**
	 * Lists the contents of a directory, excluding '.' and '..'
	 *
	 * @param path - Path to directory to read
	 *
	 * @return Promise which resolves to array of strings representing the
	 * entities in the directory, or rejects if either the directory does not
	 * exist, or we don't have permission to read it
	 */
	readdir(path : string) : Promise<Array<string>>{
		log.trace("Reading directory contents: " + path);
		return this.reader.readdir(path);
	}

	/**
	 * Reads the [[PathAttr]] for some path
	 *
	 * @param path - The path to query
	 *
	 * @return Promise which resolves to [[PathAttr]] object for the path,
	 * will reject if path does not exist or we do not have permission to
	 * check it
	 */
	getAttributes(path : string) : Promise<PathAttr> {
		log.trace("Retrieving path attributes: " + path);
		return this.reader.getAttributes(path);
	}

	/**
	 * Makes a directory, recursively creating any required parents
	 *
	 * Obeys the options.overwrite and options.force values passed to
	 * the constructor of this class
	 *
	 * @param path Path of directory to create
	 */
	async mkdir(path : string) : Promise<void> {
		let path_type = await this.getPathType(path);

		if(path_type === PathType.Directory){
			return;
		}

		log.debug("Creating directory: " + path);

		if(path_type !== PathType.NoExist){
			// The path component exists as a non-directory
			if(!this.options.force){
				throw new Error("Failed to create directory at '" + path +
												"' due to conflicting " + path_type.toString().toLowerCase() +
												" and force flag is not set"
											 );
			}
			log.info("Overwritting conflicting non-directory with directory: " + path);
			await this.writer.remove(path);
		}

		await  this.mkdir(pathlib.dirname(path));
		return this.writer.mkdirComponent(path);
	}

	/**
	 * Writes a file
	 *
	 * Obeys the options.overwrite and options.force values passed to
	 * the constructor of this class
	 *
	 * @param path    The path of the file to write
	 * @param content The content for the file
	 */
	async writeFile(path : string, content : string | Buffer) : Promise<void> {

		let cur_target_type = await this.getPathType(path);

		switch(cur_target_type){
			case PathType.File:
				if(this.options.overwrite){
					log.info("Overwriting file: " + path);
				} else {
					throw new Error("Cannot write file as already exists and " +
													"--overwrite flag is not set: " + path
												 );
				}
				break;
			case PathType.Directory:
			case PathType.Other:
				if(this.options.force){
					log.info("Removing conflicting " + cur_target_type +
									 " to make way for a file at: " + path);
					await this.writer.remove(path);
				} else {
					throw new Error("Cannot write file as there exists a non-file at the " +
													"target path and --force flag is not set: " + path
												 );
				}
				break;
			case PathType.NoExist:
				break;
			default:
				throw new Error("Internal programming error - missing case statement");
		}

		log.debug("Writing file: " + path);
		return this.writer.writeFile(path, content);
	}

	/**
	 * Removes a file or directory at specified path if it exists. Will
	 * also delete any contents if the path is a directory. If the path
	 * does not already exist then this function is a no-op, and resolves
	 * to true regardless
	 *
	 * @param path - Path of the directory to create
	 *
	 * @return Promise which either resolves to indicate success,
	 * or which is rejected to indicate an error, eg we do not have permissions to
	 * remove the entity
	 */
	remove(path : string) : Promise<void> {
		log.debug("Deleting path: " + path);
		return this.writer.remove(path);
	}

	/**
	 * Applies a mode, owner and group to an existing file path
	 *
	 * @param path - Path of file or directory to modify
	 * @param PathAttr - The set of attributes to apply to the File
	 *
	 * @return Promise which always either resolves to true to indicate success,
	 * or which is rejected to indicate an error, eg, path does not exist or
	 * we do not have permission to modify its attributes
	 */
	setAttributes(path : string, attributes : PathAttr) : Promise<void>{
		log.trace("Setting path attributes on: " + path);
		return this.writer.setAttributes(path, attributes);
	}
};

export interface IFileDriverFactory {
	/**
	 * Creates a new instance of a [[FileDriver]] of the type
	 * supported by this factory
	 */
	create(options : FileDriverOptions) : Promise<FileDriver>;

	/**
	 * Set of valid path strings that the file driver can handle
	 */
	path_regex : RegExp;

	/**
	 * Human readable string describing the name of this file driver
	 */
	name       : string;
};
