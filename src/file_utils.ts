/**
 * Various utilities for manipulating the file system
 */

"use strict";

import { execFileSync } from 'child_process';
import fs               from 'fs';

import log from './log'

function getStatPermissionString(stats : fs.Stats){
	return '0' + (stats.mode & parseInt('777', 8)).toString(8);
}

export { getStatPermissionString };
export default { getStatPermissionString };
