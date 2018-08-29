import fs            from 'fs';
import *  as pathlib from 'path';

import { IReader, IWriter, PathAttr, PathType } from './FileDriverTypes';
import log from '../log';

export { PathAttr, PathType } from './FileDriverTypes';

/**
 * Represents a set of actions that can be ran against some file system
 */
export class FileDriver {

	private reader : IReader;
	private writer : IWriter;

	/**
	 * Creates a new FileDriver which internally uses the specified reader and
	 * writer for all file operations
	 *
	 * @param IReader Implementation for file system querying functions
	 * @param IWriter Implementation for file system modification functions
	 * If set to undefined then will silently convert all write operations to
	 * no-ops
	 *
	 */
	constructor(reader : IReader,
							writer : IWriter | undefined){
		this.reader = reader;

		if(writer === undefined){
			log.info("Creating read only file driver");
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
	 * Checks whether a path exists, this says nothing about the type of entity
	 * at the path, eg could be a directory, file, symlink, socket, etc
	 *
	 * @param path - The location to check
	 *
	 * @return Promise which resolves to true or false, of rejects if it cannot
	 * be determined whether the path exists
	 */
	exists(path : string) : Promise<Boolean>{
		log.trace("Checking path existance: " + path);
		return this.reader.exists(path);
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
	 * Makes a directory, recursively creates any required parents and
	 * also deletes any conflicts if a parent component of the path already
	 * exists but as a something other than a directory
	 *
	 * @param path Path of directory to create
	 * @param opts.overwrite If set will overwrite parent path components which
	 * currently exist but are not directories
	 * @param opts.recursive If set creates non-existent parent path components
	 */
	async mkdir( path : string,
							 opts : {
								 overwrite? : boolean,
								 recursive? : boolean,
							 }
						 ) : Promise<void> {
		let path_type = await this.getPathType(path);

		if(path_type === PathType.Directory){
			return;
		}

		log.debug("Creating directory: " + path);

		if(path_type !== PathType.NoExist){
			// The path component exists as a non-directory
			if(!opts.overwrite){
				throw new Error("Failed to create directory: " + path +
												" due to conflicting " + path_type.toString().toLowerCase()
											 );
			}
			log.info("Overwritting conflicting non-directory with directory: " + path);
			await this.writer.remove(path);
		}

		await  this.mkdir(pathlib.dirname(path), opts);
		return this.writer.mkdirComponent(path);
	}

	/**
	 * Writes a file
	 *
	 * @param path    The path of the file to write
	 * @param content The content for the file
	 */
	writeFile(path : string, content : string | Buffer) : Promise<void> {
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
		log.debug("Setting path attributes on: " + path);
		return this.writer.setAttributes(path, attributes);
	}
};

export interface IFileDriverFactory {
	create( path         : string,
					enable_write : boolean,
					options      : { [propIndex : string] : any }
				) : FileDriver,

	/**
	 * Set of valid path strings that the file driver can handle
	 */
	path_regex : RegExp,
};
