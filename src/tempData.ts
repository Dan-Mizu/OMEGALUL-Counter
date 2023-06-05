// imports
import path from "path";
import fs, { promises as asyncfs } from "fs";
import log from "./utility/log.js";

export default {
	async getFromTempFile(key: string): Promise<any> {
		// temp file does not exist
		if (!fs.existsSync(path.join(process.cwd(), "temp.json") as string))
			return null;

		// temp file exists, read it
		let data;
		try {
			data = await asyncfs.readFile(
				path.join(process.cwd(), "temp.json"),
				"utf-8"
			);
		} catch (error) {
			log.error(error);
			return null;
		}

		return JSON.parse(data)[key];
	},

	async writeToTempFile(key: string, value: any): Promise<void> {
		// temp file exists
		if (fs.existsSync(path.join(process.cwd(), "temp.json") as string)) {
			// get temp data
			let tempData;
			try {
				tempData = await asyncfs.readFile(
					path.join(process.cwd(), "temp.json"),
					"utf-8"
				);
			} catch (error) {
				log.error(error);
				return;
			}
			// parse data
			tempData = JSON.parse(tempData);

			// edit
			tempData[key] = value;

			// save
			try {
				await asyncfs.writeFile(
					path.join(process.cwd(), "temp.json"),
					JSON.stringify(tempData),
					"utf-8"
				);
			} catch (error) {
				log.error(error);
				return;
			}
		}
		// new temp file
		else {
			// save
			try {
				await asyncfs.writeFile(
					path.join(process.cwd(), "temp.json"),
					JSON.stringify({ [key]: value }),
					"utf-8"
				);
			} catch (error) {
				log.error(error);
			}
		}
	},
};
