/**
 * Test suite for testing the basic functionality of copying over source files
 * to the output directory
 */

"use strict";

require('../common.js');
const fs = require('fs');

let source_directory = {
	'hello.txt' : mockfs.file({
		content : 'Hello world!',
		uid     : 1000,
		gid     : 1000,
		mode    : parseInt('600', 8),
	}),
	dir_a: {
		nested_dir: {
			'stuff.txt' : mockfs.file({
				content : 'This is an interesting file\n',
				uid     : 1234,
				gid     : 4321,
				mode    : parseInt('777', 8)
			}),
		},
		file_a: '',
		file_b: '',
	},
	dir_b: mockfs.directory({
		uid: 9999,
		gid: 9876,
	}),
};

function assertDirectoryCorrect(root){
	if(!root.endsWith('/')){ root += '/'; }

	expectFile ([root, 'hello.txt'], {
		uid: 1000,
		gid: 1000,
		mode: '0600',
		content: 'Hello world!',
	});
	expectDir ([root, 'dir_a']);
	expectDir ([root, 'dir_a/nested_dir']);
	expectFile([root, 'dir_a/nested_dir/stuff.txt'], {
		uid: 1234,
		gid: 4321,
		mode: '0777',
		content: 'This is an interesting file\n',
	});
	expectFile([root, 'dir_a/file_a'], { content: '' });
	expectFile([root, 'dir_a/file_b'], { content: '' });
	expectDir ([root, 'dir_b'], {
		uid: 9999,
		gid: 9876,
	});
};


beforeEach(() => {
	mockfs({
		source : source_directory
	});
});

afterEach(() => {
	mockfs.restore();
});


it('Deploy to new directory', () => {
	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');
		});
});

it('Deploy to new directory whose parent does not exist', () => {
	return treeploy('source', 'target/nested')
		.then(() => {
			assertDirectoryCorrect('target/nested');
		});
});

it('Deploy to existing empty directory', () => {
	fs.mkdirSync('target');

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');
		});
});

it('Deploy to non-empty directory without confilicting files', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/old_file.txt', "text\ngoes\nhere");

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');

			// check non conflicting file still exists and has not been modified
			expect(fs.existsSync('target/old_file.txt')).is.true;
			expect(fs.readFileSync('target/old_file.txt').toString('utf8')).is.deep.equal('text\ngoes\nhere');
		});
});

it('Deploy to non-empty directory with conflicting files, no overwrite', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/hello.txt', "text\ngoes\nhere");

	expect(treeploy('source', 'target')).is.rejected;
	expect(fs.readFileSync('target/hello.txt').toString()).is.deep.equal("text\ngoes\nhere");
});

it('Deploy to non-empty directory with conflicting files and overwrite flag', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/hello.txt', "text\ngoes\nhere");

	return treeploy('source', 'target', { overwrite: true })
		.then(() => {
			assertDirectoryCorrect('target');
		});
});

it('Conflicting file blocking directory is not overwritten with no flags', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/dir_a', 'I\'m a conflict');

	expect(treeploy('source', 'target')).is.rejected;
	expect(fs.readFileSync('target/dir_a').toString()).is.deep.equal('I\'m a conflict');
});

it('Conflicting file blocking directory is not overwritten with overwrite flag', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/dir_a', 'I\'m a conflict');

	expect(treeploy('source', 'target'), { overwrite: true}).is.rejected;
	expect(fs.readFileSync('target/dir_a').toString()).is.deep.equal('I\'m a conflict');
});

it('Conflicting file blocking directory IS overwritten with force flag', () => {
	fs.mkdirSync('target');
	fs.writeFileSync('target/dir_a', 'I\'m a conflict');

	return treeploy('source', 'target', { force: true })
		.then(() => {
			assertDirectoryCorrect('target');
		});
});

it('Conflicting directory blocking file is not overwritten with no flags', () => {
	fs.mkdirSync('target');
	fs.mkdirSync('target/hello.txt');

	expect(treeploy('source', 'target')).is.rejected;
	expect(fs.statSync('target/hello.txt').isDirectory()).is.true;
});

it('Conflicting directory blocking file is not overwritten with overwrite flag', () => {
	fs.mkdirSync('target');
	fs.mkdirSync('target/hello.txt');

	expect(treeploy('source', 'target'), { overwrite: true }).is.rejected;
	expect(fs.statSync('target/hello.txt').isDirectory()).is.true;
});

it('Conflicting file blocking directory IS overwritten with force flag', () => {
	fs.mkdirSync('target');
	fs.mkdirSync('target/hello.txt');

	return treeploy('source', 'target', { force: true })
		.then(() => {
			assertDirectoryCorrect('target');
		});
});
