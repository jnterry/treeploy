const userid = require('userid');
const fs     = require('fs');

function getStatPermissionString(stats){
	return '0' + (stats.mode & parseInt('777', 8)).toString(8);
}

/**
 * Takes the permissions, owner, etc of an input file and applies them
 * to an output file, without changing the file's contents
 *
 * @param in_path {string}  - Path to the file whose meta data you wish to copy
 * @param out_path {string} - Path to file to apply to meta data to
 */
function syncFileMetaData(in_path, out_path){
	let in_stat = fs.statSync(in_path);

	applyFilePermissions(out_path, {
		owner : in_stat.uid,
		group : in_stat.gid,
		mode  : getStatPermissionString(in_stat)
	});
}

/**
 * Applies a mode, owner and group to an existing file path
 *
 * @param {string} path         - Path of the file/directory to modify
 * @param {Object} options      - All options for the file
 * @param {string} options.mode - Representation of file mode, eg: '0644'w
 * @param {(string|number)} options.owner - Username or uid of file owner
 * @param {(string|number)} options.group - Group name or gid of file's group
 */
function applyFilePermissions(path, options){
	if(options.mode != null){
		fs.chmodSync(path, parseInt(options.mode, 8));
	}

	let cur_stats = fs.statSync(path);
	let uid = cur_stats.uid;
	let gid = cur_stats.gid;

	if(options.owner != null){
		if (typeof options.owner === 'number'){
			uid = options.owner;
		} else if(typeof options.owner === 'string'){
			if(options.owner === 'root'){
				uid = 0;
			} else {
 				console.log("WARNING: uid's should be prefered over usernames to ensure " +
										"correct operation on systems where the user does not exist, got: " +
										options.owner);
				uid = userid.uid(options.owner);
			}
		} else {
			throw new Error("Invalid type for options.user, expected number representing uid or string representing username");
		}
}

	if(options.group != null){
		if(typeof options.group === 'number'){
			gid = options.group;
		} else if (typeof options.group === 'string') {
			if(options.group === 'root'){
				gid = 0;
			} else if(typeof options.group === 'string') {
				console.log("WARNING: gid's should be prefered over group names to ensure " +
										"correct operation on systems where the group does not exist, got: " +
										options.group);
				gid = userid.gid(options.group);
			} else {
				throw new Error("Invalid type for options.group, expected number representing uid or string representing group name");
			}
		}
	}

	if(uid != cur_stats.uid || gid != cur_stats.gid){
		fs.chownSync(path, uid, gid);
	}
}

module.exports = {
	syncFileMetaData,
	applyFilePermissions,
	getStatPermissionString,
};
