/**
 * Adapted from documentation at:
 * https://github.com/steelbrain/node-ssh/blob/v5.1.2/README.md#api
 */

declare module 'node-ssh' {
	export interface PutFilesOptions {
		sftp? :object;
		sftpOptions?: object;
		concurrency?: number;
	}
	export interface PutDirectoryOptions {
		sftp? :object;
		sftpOptions?: object;
		concurrency?: number;
		recursive?: boolean;
		tick?: ((localPath: string, remotePath: string, error? :Error) => void);
		validate?: ((localPath: string) => boolean);
	}
	export interface  ExecOptions {
		cwd?: string;
		options?: object;
		stdin?: string;
		stream?: 'stdout' | 'stderr' | 'both';
		onStdout?: ((chunk: Buffer) => void);
		onStderr?: ((chunk: Buffer) => void);
	}

	export interface SSH {
		new() : SSH;
		connect(config: object): Promise<this>;
		requestSFTP(): Promise<any>;
		requestShell(): Promise<any>;
		mkdir(path: string, method: 'sftp' | 'exec', givenSftp?: object): Promise<string>;
		exec(command: string, parameters: Array<string>, options: ExecOptions): Promise<object | string>;
		execCommand(command: string, options: { cwd: string, stdin: string }): Promise<{ stdout: string, options?: object, stderr: string, signal? :string, code: number }>;
		putFile(localFile: string, remoteFile: string, sftp?: object, opts?: object): Promise<void>;
		getFile(localFile: string, remoteFile: string, sftp?: object, opts?: object): Promise<void>;
		putFiles(files: Array<{ local: string, remote: string }>, options: PutFilesOptions): Promise<void>;
		putDirectory(localDirectory: string, remoteDirectory: string, options: PutDirectoryOptions): Promise<boolean>;
		dispose(): void;
	}

	export default SSH;
}
