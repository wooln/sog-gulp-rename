'use strict';
/**
 * @description: 从gulp-rename-rev上改造，抽取了gulp-rename的修改文件名的功能（不包含修改路径）+ gulp-rev的manifest功能
 * @author 徐云金 wooln
 * @data 20190510  
 */

const path = require('path');
const through = require('through2');
const vinylFile = require('vinyl-file');
const revHash = require('rev-hash');
const revPath = require('rev-path');
const sortKeys = require('sort-keys');
const modifyFilename = require('modify-filename');
const Vinyl = require('vinyl');
const PluginError = require('plugin-error');

function relPath(base, filePath) {
	filePath = filePath.replace(/\\/g, '/');
	base = base.replace(/\\/g, '/');

	if (filePath.indexOf(base) !== 0) {
		return filePath;
	}

	const newPath = filePath.slice(base.length);

	if (newPath[0] === '/') {
		return newPath.slice(1);
	}

	return newPath;
}

//更名
function transformFilename(file, obj) {

	file.revOrigPath = file.path;
	file.revOrigBase = file.base;
	file.revHash = revHash(file.contents);

	file.path = modifyFilename(file.path, (filename, extension) => { //修改名称

		//从gulp-rename-rev移植过来的功能
		var options = options || {};

		var Path = require('path');
		function parsePath(path) {
			var extname = options.multiExt ? Path.basename(path).slice(Path.basename(path).indexOf('.')) : Path.extname(path);
			return {
				dirname: Path.dirname(path),
				basename: Path.basename(path, extname),
				extname: extname
			};
		}

		var parsedPath = parsePath(file.relative);
		var newname;

		var type = typeof obj;

		if (type === 'string' && obj !== '') {
			newname = obj;
		} else if (type === 'function') {
			obj(parsedPath, file);
			newname = parsedPath.basename + parsedPath.extname;
		} else if (type === 'object' && obj !== undefined && obj !== null) {
			var prefix = obj.prefix || '',
				suffix = obj.suffix || '',
				basename = 'basename' in obj ? obj.basename : parsedPath.basename,
				extname = 'extname' in obj ? obj.extname : parsedPath.extname;

			newname = prefix + basename + suffix + extname;
		} else {
			callback(new Error('Unsupported renaming parameter type supplied'), undefined);
			return;
		}

		return newname;
	});
}

//获取配置文件
const getManifestFile = opts => vinylFile.read(opts.path, opts).catch(err => {
	if (err.code === 'ENOENT') {
		return new Vinyl(opts);
	}

	throw err;
});

//执行方法
const plugin = (index) => {

	const sourcemaps = [];
	const pathMap = {};
	const indexRev = index || 3; //index默认为3

	return through.obj((file, enc, cb) => {
		if (file.isNull()) {
			cb(null, file);
			return;
		}

		if (file.isStream()) {
			cb(new PluginError('gulp-rev', 'Streaming not supported'));
			return;
		}

		// This is a sourcemap, hold until the end
		if (path.extname(file.path) === '.map') {
			sourcemaps.push(file);
			cb();
			return;
		}

		const oldPath = file.path;
		transformFilename(file, indexRev);
		pathMap[oldPath] = file.revHash;

		cb(null, file);
	}, function (cb) {
		sourcemaps.forEach(file => {
			let reverseFilename;

			// Attempt to parse the sourcemap's JSON to get the reverse filename
			try {
				reverseFilename = JSON.parse(file.contents.toString()).file;
			} catch (err) { }

			if (!reverseFilename) {
				reverseFilename = path.relative(path.dirname(file.path), path.basename(file.path, '.map'));
			}

			if (pathMap[reverseFilename]) {
				// Save the old path for later
				file.revOrigPath = file.path;
				file.revOrigBase = file.base;

				const hash = pathMap[reverseFilename];
				file.path = revPath(file.path.replace(/\.map$/, ''), hash) + '.map';
			} else {
				transformFilename(file, indexRev);
			}

			this.push(file);
		});

		cb();
	});
};

//生成对照配置文件
plugin.manifest = (pth, opts) => {

	if (typeof pth === 'string') {
		pth = { path: pth };
	}

	opts = Object.assign({
		path: 'rev-manifest.json',
		merge: false,
		transformer: JSON
	}, opts, pth);

	let manifest = {};

	return through.obj((file, enc, cb) => {

		if (!file.path || !file.revOrigPath) {
			cb();
			return;
		}

		const revisionedFile = relPath(path.resolve(file.cwd, file.base), path.resolve(file.cwd, file.path));
		const originalFile = path.join(path.dirname(revisionedFile), path.basename(file.revOrigPath)).replace(/\\/g, '/');

		manifest[originalFile] = revisionedFile;

		cb();
	}, function (cb) {

		if (Object.keys(manifest).length === 0) {
			cb();
			return;
		}

		getManifestFile(opts).then(manifestFile => {  //生成json格式配置文件
			if (opts.merge && !manifestFile.isNull()) {

				let oldManifest = {};

				try {
					oldManifest = opts.transformer.parse(manifestFile.contents.toString());
				} catch (err) { }

				manifest = Object.assign(oldManifest, manifest);
			}

			manifestFile.contents = Buffer.from(opts.transformer.stringify(sortKeys(manifest), null, '  '));
			this.push(manifestFile);

			cb();

		}).catch(cb);
	});
};

module.exports = plugin;