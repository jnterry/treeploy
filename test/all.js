/**
 * File which imports and runs all other test scripts
 */

"use strict";

const path = require('path');

/////////////////////////////////////////////////////////////////////
/// \brief Helper function which imports a file containing a test suite
/////////////////////////////////////////////////////////////////////
function importTest(file_path){
	describe(path.basename(file_path), function(){
		require("./" + file_path + '.js');
	});
}

describe('all', () => {
	describe('file_drivers', () => {
		importTest('file_drivers/path_regex');
		importTest('file_drivers/local');
	});

	describe('treeploy', () => {
		importTest('treeploy/copy');
		importTest('treeploy/tree_yaml');
		importTest('treeploy/dot_files');
		importTest('treeploy/mixed');
		importTest('treeploy/single_file');
		importTest('treeploy/dryrun');
	});

	describe('cli', () => {
		importTest('cli/core');
		importTest('cli/model');
		importTest('cli/modelfile');
		importTest('cli/modelcmd');
		importTest('cli/model_overwrites');
		importTest('cli/dryrun');
		importTest('cli/driver_options');
	});
});
