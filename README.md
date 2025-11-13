# rollup-hash-skip
A Rollup plugin to skip file generation when the source is unmodified.

For example, if you have a cache-busting value replaced with a Rollup plugin like this...

```
replace({ values: { __BUILD_TIME__: Date.now() } })
```

...then all the output files will appear to be modified after Rollup runs, even if you didn't change anything in the input files.
All those files will show up as modified in Git.
This is annoying when you have a long list of output files that are processed automatically by `rollup -cw` whenever a single input file changes.

Running this `hashSkip()` plugin before the `replace()` plugin causes unmodified source files to be removed from the output list.

```
export default [
  {
	  input: 'src/js/my-file.js',
	  output: {
      dir: 'static/js',
      format: 'es',
    },
    plugins: [
      hashSkip(),
      replace({ values: { __BUILD_TIME__: Date.now() } }),
    ],
  },
  // Lots more files...
];
```

All of a source file's dependencies are factored into the hash, so it will not be skipped if a dependency changes (even if the file itself has not changed).

This plugin requires the xxhash CLI tool to be installed. Check this list for your system/package manager: [https://repology.org/project/xxhash/versions](https://repology.org/project/xxhash/versions).

Currently this plugin only works on modules and has only been tested for my personal use cases.
