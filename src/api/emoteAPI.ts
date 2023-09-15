import express from "express";
import v1 from "./v1.js";

export default function () {
	const app = express();

	// run v1 api
	v1("api/v1/", app);

	const port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log(`API server listening on port ${port}`);
	});
}
