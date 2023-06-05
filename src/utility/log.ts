// imports
import util from "util";
import path from "path";
import fs, { WriteStream } from "fs";
import utility from "./utility.js";

// get data
import config from "../../config/config.json" assert { type: "json" };

// console colors
const consoleColor = {
	Red: "\x1b[31m%s\x1b[0m",
	Green: "\x1b[32m%s\x1b[0m",
	Yellow: "\x1b[33m%s\x1b[0m",
	Blue: "\x1b[34m%s\x1b[0m",
	Magenta: "\x1b[35m%s\x1b[0m",
	Cyan: "\x1b[36m%s\x1b[0m",
	White: "\x1b[39m%s\x1b[0m",
};

// get log path
const logPath: string = path.join(process.cwd(), config.paths.logs);

// log file write streams references
let logFile: {
	[key: string]: WriteStream;
} = {};

// current day
let currentDay: string = utility.time.currentDate();

// save console functions
let consoleLog = console.log;
let consoleError = console.error;
let consoleWarn = console.warn;
let consoleInfo = console.info;
let consoleDebug = console.debug;

// get log file
function getLog(logType: string): WriteStream {
	// init log directory
	if (!fs.existsSync(logPath)) utility.createDirectory(logPath);

	// get current day
	const date = utility.time.currentDate();

	// if its a new day, refresh stored write streams
	if (currentDay !== date) {
		// end every stored write stream
		for (const writeStream of Object.entries(logFile))
			(writeStream[1] as WriteStream).close();

		// reset stored write streams
		logFile = {};

		// store new day
		currentDay = date;
	}

	// create log file type directory if it does not already exist
	if (!fs.existsSync(path.join(logPath, logType)))
		utility.createDirectory(path.join(logPath, logType));

	// create log file write stream if it does not already exist
	if (!logFile[logType]) {
		// get path
		const filePath = path.join(logPath, logType, date + ".log");

		// store log file stream
		logFile[logType] = fs.createWriteStream(filePath, {
			flags: "a",
		});

		// log debug
		debug("New Write Stream: " + logType);
	}

	// return log file
	return logFile[logType];
}

// prefix
function getPrefix(): string {
	return utility.time.currentTimestamp() + " |";
}

// format and log
function logToFile(...args: any[]): void {
	// format message
	const formattedMessage = util.format.apply(null, ...args) + "\n";

	// log to server and debug file
	getLog("server").write(formattedMessage);
	getLog("debug").write(formattedMessage);
}

let message = function (...args: any[]): void {
	// prepend prefix
	args.unshift(getPrefix());

	// log to file
	logToFile(args);

	// log to console
	consoleLog.apply(console, args);
};

let error = function (...args: any[]) {
	// prepend prefix
	args.unshift(getPrefix());

	// log to file
	logToFile(["🛑", ...args]);

	// prepend colors
	args.unshift(consoleColor.Red);

	// log to console
	consoleError.apply(console, args);
};

let warn = function (...args: any[]) {
	// prepend prefix
	args.unshift(getPrefix());

	// log to file
	logToFile(["⚠️", ...args]);

	// prepend colors
	args.unshift(consoleColor.Yellow);

	// log to console
	consoleWarn.apply(console, args);
};

let info = function (...args: any[]) {
	// prepend prefix
	args.unshift(getPrefix());

	// log to file
	logToFile(["ℹ️", ...args]);

	// prepend colors
	args.unshift(consoleColor.Cyan);

	// log to console
	consoleInfo.apply(console, args);
};

let debug = function (...args: any[]) {
	// prepend prefix
	args.unshift(getPrefix());

	// log to debug file ONLY
	getLog("debug").write(util.format.apply(null, ["🐛", ...args]) + "\n");

	// prepend colors
	args.unshift(consoleColor.Magenta);

	// log to console (if debug mode is enabled)
	if (config.debug) consoleDebug.apply(console, args);
};

// override console functions
console.log = message;
console.error = error;
console.warn = warn;
console.info = info;
console.debug = debug;

export default {
	message,
	error,
	warn,
	info,
	debug,
};
