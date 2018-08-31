/**
 * Tests dryrun action prevents writes
 */

"use strict";

require('../common.js');
const fs = require('fs');

describe('Copy deploy', () => {
	it('Copy deploy w/ --overwrite', () => {
		mockfs({
			source: {
				'test.txt' : 'Hello!',
			},
			target: {
				'test.txt' : 'Important data!',
			}
		});

		return treeploy('source', 'target', { dryrun: true, overwrite: true })
			.then(() => {
				expectFile('target/test.txt', 'Important data!');
			});
	});

	it('Copy deploy w/ --force', () => {
		mockfs({
			source: {
				'test.txt' : 'Hello!',
			},
			target: {
				'test.txt' : 'Important data!',
			}
		});

		return treeploy('source', 'target', { dryrun: true, force: true })
			.then(() => {
				expectFile('target/test.txt', 'Important data!');
			});
	});

	it('Copy deploy - permissions unchanged', () => {
		mockfs({
			source: {
				'test.txt' : mockfs.file({
					content :  'Hello!',
					uid     : 1000,
					gid     : 2000,
					mode    : parseInt('0777', 8),
				}),
			},
			target: {
				'test.txt' : mockfs.file({
					content :  'Important data!',
					uid     : 3000,
					gid     : 4000,
					mode    : parseInt('0400', 8),
				}),
			}
		});

		return treeploy('source', 'target', { dryrun: true, force: true })
			.then(() => {
				expectFile('target/test.txt', {
					content :  'Important data!',
					uid     : 3000,
					gid     : 4000,
					mode    : '0400',
				});
			});
	});
});


it('tree.yaml', () => {
	mockfs({
		source: {
			'tree.yaml' : "- thing.txt:\n    owner: 1234\n    group: 4321\n    mode: '0432'",
		},
		target: {
			'thing.txt' : mockfs.file({
				content : 'text here',
				gid  : 1000,
				uid  : 2000,
				mode : parseInt('0432', 8),
			}),
		}
	});

	return treeploy('source', 'target', { dryrun: true, overwrite: true })
		.then(() => {
			expectFile('target/thing.txt', {
				content : 'text here',
				gid     : 1000,
				uid     : 2000,
				mode    : '0432',
			});
		});
});
