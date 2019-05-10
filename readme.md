## sog-gulp-rename

基于gulp的插件，从gulp-rename-rev上改造，抽取了[gulp-rename](https://www.npmjs.com/package/gulp-rename)的修改文件名的功能（不包含修改路径）+ [gulp-rev](https://www.npmjs.com/package/gulp-rev)的manifest功能

[gulp-rev](https://www.npmjs.com/package/gulp-rev)
## Installation安装

```bash
npm i sog-gulp-rename --save-dev
```

## Usage

### Example

- 引入：const sogRename = require('sog-gulp-rename');
- sogRename(option)
- sogRename.manifest('manifest.json')

```js
var gulp = require('gulp');
var sogRename = require('gulp-rename-rev');

var fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('./package.json'));

gulp.task('js-release', function () {
    var stream =
        gulp.src(['src/**/*.js'])
            .pipe(sogRename({ suffix: '-' + packageJson.version })) //添加后缀未应用的版本号
            .pipe(gulp.dest('dist'))
            .pipe(sogRename.manifest('js-manifest.json')) //将重命名的对照字典写入json文件
            .pipe(gulp.dest('rev'));
    return stream;
});
```
### options

* options可以是非空字符串、function、和对象，对象有以下参数
```
{
  basename: "my-name",
  prefix: "v.",
  suffix: ".min",
  extname: ".md"
}
```