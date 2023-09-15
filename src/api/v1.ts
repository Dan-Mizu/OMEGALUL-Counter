import { Express, Request, Response } from "express";

export default function (path: string, app: Express) {
	app.get(path, (_req: Request, res: Response) => {
		res.send("Hello, World!");
	});
}
