import path from "path";
import fs, { promises as asyncfs } from "fs";

export default {
    async getFromTempFile(key: string): Promise<any> {
		// temp file does not exist
		if (!fs.existsSync(path.join(process.cwd(), "temp.json") as string))
			return null;

		// temp file exists, read it
		return JSON.parse(
			await asyncfs.readFile(
				path.join(process.cwd(), "temp.json"),
				"utf-8"
			)
		)[key];
	},

	async writeToTempFile(key: string, value: any): Promise<void> {
		// temp file exists
		if (fs.existsSync(path.join(process.cwd(), "temp.json") as string)) {
			// get temp data
			const tempData = JSON.parse(
				await asyncfs.readFile(
					path.join(process.cwd(), "temp.json"),
					"utf-8"
				)
			);

			// edit
			tempData[key] = value;

			// save
			await asyncfs.writeFile(
				path.join(process.cwd(), "temp.json"),
				JSON.stringify(tempData),
				"utf-8"
			);
		}
		// new temp file
		else {
			// save
			await asyncfs.writeFile(
				path.join(process.cwd(), "temp.json"),
				JSON.stringify({ [key]: value }),
				"utf-8"
			);
		}
	}
}