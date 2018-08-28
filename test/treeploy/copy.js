/**
 * Test suite for testing the basic functionality of copying over source files
 * to the output directory
 */

"use strict";

const expect     = require('chai').expect;
const mockfs     = require('mock-fs');
const fs         = require('fs');

const file_utils = require('../../src/file_utils.js');
const treeploy   = require('../../src/index.js');

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

	{ // hello.text
		expect(fs.existsSync(root + 'hello.txt')).is.true;

		let stat = fs.statSync(root + 'hello.txt');
		expect(stat.uid).is.deep.equal(1000);
		expect(stat.gid).is.deep.equal(1000);
		expect(file_utils.getStatPermissionString(stat)).is.deep.equal('0600');
		expect(stat.isFile()).is.true;
		expect(fs.readFileSync(root + 'hello.txt').toString('utf8')).is.deep.equal('Hello world!');
	}

	{ // dir_a/
		expect(fs.existsSync(root + 'dir_a')).is.true;

		let stat = fs.statSync(root + 'dir_a');
		expect(stat.isDirectory()).is.true;
	}

	{ // dir_a/nested_dir/
		expect(fs.existsSync(root + 'dir_a/nested_dir')).is.true;

		let stat = fs.statSync(root + 'dir_a/nested_dir');
		expect(stat.isDirectory()).is.true;
	}

	{ // dir_a/nested_dir/stuff.txt
		expect(fs.existsSync(root + 'dir_a/nested_dir/stuff.txt')).is.true;

		let stat = fs.statSync(root + 'dir_a/nested_dir/stuff.txt');
		expect(stat.uid).is.deep.equal(1234);
		expect(stat.gid).is.deep.equal(4321);
		expect(file_utils.getStatPermissionString(stat)).is.deep.equal('0777');
		expect(stat.isFile()).is.true;
		expect(fs.readFileSync(root + 'dir_a/nested_dir/stuff.txt').toString('utf8')).is.deep.equal('This is an interesting file\n');
	}

	{ // dir_a/file_a
		expect(fs.existsSync(root + 'dir_a/file_a')).is.true;

		let stat = fs.statSync(root + 'dir_a/file_a');
		expect(stat.isFile()).is.true;
		expect(fs.readFileSync(root + 'dir_a/file_a').toString('utf8')).is.deep.equal('');
	}

	{ // dir_a/file_b
		expect(fs.existsSync(root + 'dir_a/file_b')).is.true;

		let stat = fs.statSync(root + 'dir_a/file_b');
		expect(stat.isFile()).is.true;
		expect(fs.readFileSync(root + 'dir_a/file_b').toString('utf8')).is.deep.equal('');
	}

	{ // dir_b
		expect(fs.existsSync(root + 'dir_b')).is.true;

		let stat = fs.statSync(root + 'dir_b');
		expect(stat.uid).is.deep.equal(9999);
		expect(stat.gid).is.deep.equal(9876);
		expect(stat.isDirectory()).is.true;
	}
};

it('Deploy to new directory', () => {
	mockfs({
		source : source_directory
	});

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');
		})
		.finally(() => {
			mockfs.restore();
		});
});

it('Deploy to new directory whose parent does not exist', () => {
	mockfs({
		source : source_directory
	});

	return treeploy('source', 'target/nested')
		.then(() => {
			assertDirectoryCorrect('target/nested');
		})
		.finally(() => {
			mockfs.restore();
		});
});

it('Deploy to existing empty directory', () => {
	mockfs({
		source : source_directory
	});

	fs.mkdirSync('target');

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');
		})
		.finally(() => {
			mockfs.restore();
		});
});

it('Deploy to non-empty directory without confilicting files', () => {
	mockfs({
		source : source_directory
	});

	fs.mkdirSync('target');
	fs.writeFileSync('target/old_file.txt', "text\ngoes\nhere");

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');

			// check non conflicting file still exists and has not been modified
			expect(fs.existsSync('target/old_file.txt')).is.true;
			expect(fs.readFileSync('target/old_file.txt').toString('utf8')).is.deep.equal('text\ngoes\nhere');
		})
		.finally(() => {
			mockfs.restore();
		});
});

it('Deploy to non-empty directory with confilicting files', () => {
	mockfs({
		source : source_directory
	});

	fs.mkdirSync('target');
	fs.writeFileSync('target/hello.txt', "text\ngoes\nhere");

	return treeploy('source', 'target')
		.then(() => {
			assertDirectoryCorrect('target');
		})
		.finally(() => {
			mockfs.restore();
		});
});
