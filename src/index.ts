// imports
import log from "./utility/log.js";
import stvAPI from "./api.js";
import { AxiosError, AxiosResponse } from "axios";
import utility from "./utility/utility.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// init axios
const sevenTV = new stvAPI(config["7tvUserID"]);

await sevenTV.get(
	(response: AxiosResponse) => {
		log.message(
			`Twitch User ${response.data.display_name} Found: \n` +
				utility.JSON.stringify(
					utility.JSON.getObjectsFromKeyValue(
						response.data.emote_set.emotes,
						"name",
						"OMEGALUL"
					)
				)
		);
	},
	(err: AxiosError) => {
		log.message("Twitch User NOT Found: \n" + err.message);
	}
);
