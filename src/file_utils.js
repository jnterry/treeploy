/**
 * Various utilities for manipulating the file system
 */

"use strict";

const execFileSync = require('child_process').execFileSync;
const fs           = require('fs');

require('./log.js');

function getStatPermissionString(stats){
	return '0' + (stats.mode & parseInt('777', 8)).toString(8);
}

module.exports = {
	getStatPermissionString,
};
