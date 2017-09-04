# Remove duplicate files

## install

```
$ yarn
```

## helpers

```
$ yarn start -- --help

  Usage: index [options] <dir> [otherDirs...]


  Options:

    -V, --version                  output the version number
    -E, --extensions <extensions>  Limit to a list of extensions (odt,zip,gpx)
    -h, --help                     output usage information
```

## build

```
$ yarn build
```

## example

```
$ yarn start .

Start:
 - Scan /home/chezmoi/remove-duplicate-file:
 - There are 8 files.
 - Create Hashs file [========] 8/8 100%
 - There are 0 folders with duplicate files.
```

or

```
$ node build .

Start:
 - Scan /home/chezmoi/remove-duplicate-file:
 - There are 8 files.
 - Create Hashs file [========] 8/8 100%
 - There are 0 folders with duplicate files.
```
