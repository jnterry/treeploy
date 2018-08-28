/**
 * Test suite for when treeploy is called on a single input file, rather
 * than an input directory
 */

"use strict";

require('../common.js');

afterEach(() => {
	mockfs.restore();
});

it('Standard File', () => {
	mockfs({
		'test.txt' : mockfs.file({
			content : 'Hello world!',
			uid     : 1122,
			gid     : 2211,
			mode    : parseInt('765', 8),
		})
	});

	return treeploy('test.txt', 'out.txt').then(() => {
		expectFile('out.txt', {
			uid  : 1122,
			gid  : 2211,
			mode : '0765',
			content : 'Hello world!'
		});
	});
});


describe('tree.yaml', () => {
	it('To cwd', () => {
		mockfs({
			'tree.yaml' : '- test.txt\n- dir/',
		});

		return treeploy('tree.yaml', '.').then(() => {
			expectFile('tree.yaml', { content: '- test.txt\n- dir/' } );
			expectFile('test.txt',  { content: ''                   } );
			expectDir ('dir');
		});
	});


	it('To cwd - no overwrite existing file', () => {
		mockfs({
			'tree.yaml' : '- test.txt\n- dir/',
			'test.txt'  : 'Hi',
		});

		return treeploy('tree.yaml', '.').then(() => {
			expectFile('tree.yaml', { content: '- test.txt\n- dir/' } );
			expectFile('test.txt',  { content: 'Hi'                 } );
			expectDir ('dir');
		});
	});

	it('To dir - no trailing slash', () => {
		mockfs({
			'tree.yaml' : '- test.txt\n- dir/',
		});

		return treeploy('tree.yaml', 'output').then(() => {
			expectFile('tree.yaml');
			expectDir ('output/');
			expectNone('output/tree.yaml');
			expectFile('output/test.txt');
			expectDir ('output/dir');
		});
	});

	it('To dir - with slash', () => {
		mockfs({
			'tree.yaml' : '- test.txt\n- dir/',
		});

		return treeploy('tree.yaml', 'output/').then(() => {
			expectFile('tree.yaml');
			expectDir ('output/');
			expectNone('output/tree.yaml');
			expectFile('output/test.txt');
			expectDir ('output/dir');
		});
	});
});

describe('doT Template', () => {
	beforeEach(() => {
		mockfs({
			'a.dot' : 'Hi {{= it.name }}',
		});
	});

	it('Dot Template', () => {
		return treeploy('a.dot', 'a', {
			dot_models: {
				it: { name: 'bob' }
			}
		}).then(() => {
			expectFile('a.dot', { content: 'Hi {{= it.name }}' });
			expectFile('a',     { content: 'Hi bob'            });
		});
	});

	it('Dot Template - Non standard output name', () => {
		return treeploy('a.dot', 'test.txt', {
			dot_models: {
				it: { name: 'bob' }
			}
		}).then(() => {
			expectFile('a.dot',   { content: 'Hi {{= it.name }}' });
			expectNone('a');
			expectFile('test.txt',{ content: 'Hi bob'            });
		});
	});
});
