# mongomap

A CLI to store/fetch bug bounty information in mongodb!

## Install

`npm i @zbo14/mongomap`

## Usage

```
 .--------.-----.-----.-----.-----.--------.---.-.-----.
 |        |  _  |     |  _  |  _  |        |  _  |  _  |
 |__|__|__|_____|__|__|___  |_____|__|__|__|___._|   __|
                      |_____|                    |__|

Usage: mongomap [options] [command]

Options:
  -V, --version                       output the version number
  -h, --help                          display help for command

Commands:
  push <program> <collection> <file>  store the contents of a file in the database
  pull <program> <collection>         pull documents that were added to the database today
  help [command]                      display help for command
```

## Document models

### Domain

```js
/**
 * @typedef {Object}  Domain
 *
 * @property {Date}    created
 * @property {String}  name
 * @property {String}  parent
 * @property {String}  program
 */
```

### IP address

```js
/**
 * @typedef {Object}  IP
 *
 * @property {String}  address
 * @property {Date}    created
 * @property {String}  program
 */
```

### IP Range

```js
/**
 * @typedef {Object}  Range
 *
 * @property {Number}  asn
 * @property {String}  cidr
 * @property {Date}    created
 * @property {String}  program
 */
```

### URL

```js
/**
 * @typedef {Object}  URL
 *
 * @property {Date}     created
 * @property {String}   domain
 * @property {String}   href
 * @property {String}   program
 * @property {Boolean}  secure
 */
```
