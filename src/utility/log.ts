// imports
import util from "util";
import path from "path";
import fs, { WriteStream } from "fs";
import utility from "./utility.js";

// get data
import config from "../../config/config.json" assert { type: "json" };

// types
type OptionsConfig = {
	file?: string | Array<string> | undefined | null;
	console?: boolean | undefined;
	color?: string | undefined;
};

export default {
	// colors usable in console
	ConsoleColor: {
		Red: "\x1b[31m%s\x1b[0m",
		Green: "\x1b[32m%s\x1b[0m",
		Yellow: "\x1b[33m%s\x1b[0m",
		Blue: "\x1b[34m%s\x1b[0m",
		Magenta: "\x1b[35m%s\x1b[0m",
		Cyan: "\x1b[36m%s\x1b[0m",
		White: "\x1b[39m%s\x1b[0m",
	},

	// keep track of the day
	currentDay: utility.time.currentDate() as string,

	// log files path
	logPath: path.join(process.cwd(), config.paths.logs) as string,

	// log file write streams
	logFile: {} as {
		[key: string]: WriteStream;
	},

	// initialize logging
	init: function () {
		// init log directory
		utility.createDirectory(this.logPath);

		// get current day
		this.currentDay = utility.time.currentDate();

		// override console function
		console.log = () => {
			//format message
			const message = util.format.apply(null, arguments as any | any[]);

			// log to file
			this.message(message, {
				file: ["server", "debug"],
			});

			// log to console
			process.stdout.write(message + "\n");
		};
		console.error = console.log;
	},

	// get log file
	getLog: function (logType: string) {
		// initialize logs if not already
		if (!fs.existsSync(this.logPath)) this.init();

		// get current day
		const date = utility.time.currentDate();

		// if its a new day, refresh stored write streams
		if (this.currentDay !== date) {
			// end every stored write stream
			for (const writeStream of Object.entries(this.logFile))
				(writeStream[1] as WriteStream).close();

			// reset stored write streams
			this.logFile = {};

			// store new day
			this.currentDay = date;
		}

		// create log file type directory if it does not already exist
		if (!fs.existsSync(path.join(this.logPath, logType)))
			utility.createDirectory(path.join(this.logPath, logType));

		// create log file write stream if it does not already exist
		if (!this.logFile[logType]) {
			// get path
			const filePath = path.join(this.logPath, logType, date + ".log");

			// store log file stream
			this.logFile[logType] = fs.createWriteStream(filePath, {
				flags: "a",
			});

			// log debug
			this.debug("New Write Stream: " + logType);
		}

		// return log file
		return this.logFile[logType];
	},

	message: function (
		message: string | Function,
		options: OptionsConfig | undefined = {
			file: null,
			console: true,
			color: this.ConsoleColor.White,
		}
	) {
		// init options
		if (options === undefined) options = {};

		// if file is specified but console is not, prevent logging to console
		if (options.file && options.console === undefined)
			options.console = false;

		// if file is not specified, prevent logging to file
		if (options.file === undefined) options.file = null;

		// if color is not specified, default to white
		if (options.color === undefined)
			options.color = this.ConsoleColor.White;

		// custom message
		if (typeof message === "function") {
			message = message();
			if (typeof message !== "string") {
				throw new TypeError(
					'Invalid return value of function parameter "message" | Must return a String'
				);
			}
		}
		// apply prefix
		else if (typeof message === "string") {
			message = utility.time.currentTimestamp() + " | " + message;
		}
		// non accepted variable
		else {
			throw new TypeError(
				'Invalid assignment to parameter "message" | Must be a Function or String'
			);
		}

		// log message to log files
		if (options.file) {
			// one log file -> array with single file
			if (typeof options.file === "string") {
				const file = options.file;
				options.file = [];
				options.file.push(file);
			}

			// log to files
			var fileIndex = 0;
			while (fileIndex < options.file.length) {
				// write to log
				this.getLog(options.file[fileIndex]).write(message + "\n");

				// next log file
				fileIndex++;
			}
		}

		// log message to console and server/debug log file
		if (options.console) {
			// log to console
			process.stdout.write(
				util.format.apply(null, [options.color, message]) + "\n"
			);

			// determine files to send to
			var files = [];
			// files were already accessed
			if (options.file) {
				if (!options.file.includes("server")) files.push("server");
				if (!options.file.includes("debug")) files.push("debug");
			}
			// files were not already accessed
			else files = ["server", "debug"];

			// log to server/debug file
			this.message(
				() => {
					return message;
				},
				{ file: files }
			);
		}
	},

	debug: function (
		message: string | Function,
		options?: OptionsConfig | undefined
	) {
		// init options
		if (options === undefined) options = {};

		// log to debug file
		if (options.file === undefined) options.file = "debug";

		// if debug in server config is true (and console option is not set), log to console as well
		if (config.debug === true && options.console === undefined)
			options.console = true;

		// set to debug color
		if (options.color === undefined)
			options.color = this.ConsoleColor.Magenta;

		// log debug
		this.message(message, options);
	},
};
