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
	importTest('file_utils');

	describe('treeploy', () => {
		importTest('treeploy/copy');
		importTest('treeploy/tree_yaml');
		importTest('treeploy/dot_files');
		importTest('treeploy/mixed');
		importTest('treeploy/single_file');
	});

	describe('cli', () => {
		importTest('cli/core');
		importTest('cli/model');
		importTest('cli/modelfile');
	});
});
