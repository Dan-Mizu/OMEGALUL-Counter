// imports
import fs from "fs";

export default {
	// random
	random: {
		// get a random integer (inclusive of both min and max)
		int: function (min: number = 1, max: number = 100): number {
			return Math.floor(Math.random() * (max - min + 1) + min);
		},

		// get random entry from provided array
		fromArray: function (array: Array<any>): any {
			return array[Math.floor(Math.random() * array.length)];
		},
	},

	// time
	time: {
		// get current timestamp
		currentTimestamp: function (): string {
			return new Date(Date.now()).toLocaleString();
		},

		// get todays date
		currentDate: function (): string {
			const today = new Date();
			return this.formatDate(today);
		},

		// format date
		formatDate: function (day: Date): string {
			return (
				day.getFullYear() +
				"-" +
				(day.getMonth() + 1) +
				"-" +
				day.getDate()
			);
		},
	},

	// convert hex color codes
	hex: {
		// from number to string
		toString(hexColor: number): string {
			return "#" + hexColor.toString(16).padStart(6, "0");
		},

		// from string to number
		toDecimal(hexColor: string): number {
			return parseInt(hexColor, 16);
		},

		// from hex to rgb
		toRGB(hexColor: string | number): { r: number; g: number; b: number } {
			// convert to string if number
			if (typeof hexColor !== "string")
				hexColor = this.toString(hexColor);

			// convert to rgb
			const result = String(
				/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
					hexColor as string
				)
			);
			return {
				r: this.toDecimal(result[1]),
				g: this.toDecimal(result[2]),
				b: this.toDecimal(result[3]),
			};
		},
	},

	// sanitize
	sanitize: {
		// strings
		string: function (input: string): string {
			return typeof input === "string" && input.trim().length > 0
				? input.trim()
				: "";
		},
		// booleans
		boolean: function (input: boolean): boolean {
			return typeof input === "boolean" && input === true ? true : false;
		},
		// arrays
		array: function (input: Array<any>): Array<any> {
			return typeof input === "object" && input instanceof Array
				? input
				: [];
		},
		// numbers
		number: function (input: number): number {
			return typeof input === "number" && input % 1 === 0 ? input : 0;
		},
		// objects
		object: function (input: Record<string, any>): Record<string, any> {
			return typeof input === "object" &&
				!(input instanceof Array) &&
				input !== null
				? input
				: {};
		},
	},

	// sort
	sort: {
		// object
		object: function (
			object: Record<string, any>,
			asc: boolean = false
		): Record<string, any> {
			const sortedObject: Record<string, any> = {};
			Object.keys(object)
				.sort((a, b) => object[asc ? a : b] - object[asc ? b : a])
				.forEach((s) => (sortedObject[s] = object[s]));
			return sortedObject;
		},
	},

	// merge two objects, overwriting first one with second one
	mergeObjects: function (
		arrayA: Record<string, any>,
		arrayB: Record<string, any>
	): Record<string, any> {
		// init new merged array
		var mergedArray: Record<string, any> = {};

		// merge provided arrays into new array
		let key: keyof typeof arrayA;
		for (key in arrayA) {
			mergedArray[key] = arrayA[key];
		}
		for (key in arrayB) {
			mergedArray[key] = arrayB[key];
		}

		// return new merged array
		return mergedArray;
	},

	//create directory
	createDirectory: function (dir: string): boolean {
		// if directory doesn't exist, create it
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
			return true;
		} else return false;
	},

	// stringify json with determined depth
	JSON: {
		stringify: function (
			val: Record<string, any> | Array<Record<string, any>>,
			depth: number = 1,
			replacer = null,
			space: string = " "
		): string {
			depth = isNaN(+depth) ? 1 : depth;

			// (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
			function _build(key, val, depth, o?, a?) {
				return !val || typeof val != "object"
					? val
					: ((a = Array.isArray(val)),
					  JSON.stringify(val, function (k, v) {
							if (a || depth > 0) {
								if (replacer) v = replacer(k, v);
								if (!k)
									return (a = Array.isArray(v)), (val = v);
								!o && (o = a ? [] : {});
								o[k] = _build(k, v, a ? depth : depth - 1);
							}
					  }),
					  o || (a ? [] : {}));
			}

			return JSON.stringify(_build("", val, depth), null, space);
		},

		getAllValuesOfKey: function (
			obj: Record<string, any>,
			keyToFind: string
		): string[] {
			return Object.entries(obj).reduce(
				(acc, [key, value]) =>
					key === keyToFind
						? acc.concat(value)
						: typeof value === "object" && value
						? acc.concat(this.findAllByKey(value, keyToFind))
						: acc,
				[]
			);
		},

		getObjectsFromKeyValue: function (
			obj: Record<string, any>,
			key: string,
			value: any
		): Record<string, any>[] {
			return obj.filter((obj: Record<string, any>) => {
				return obj[key] === value;
			});
		},

		getFirstObjectFromKeyValue: function (
			obj: Record<string, any>,
			key: string,
			value: any
		): Record<string, any> {
			return obj.find((obj: Record<string, any>) => {
				return obj[key] === value;
			});
		},
	},
};
