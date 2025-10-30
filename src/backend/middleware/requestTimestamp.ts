//middleware is a special function following format that has access to request and response objects
import { NextFunction, Request, Response } from "express";

const requestTimestampMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  console.log(
    `Request received for ${_req.url} at ${new Date().toLocaleString()}`,
  );

  next(); // Call next() to pass control to the next middleware or route handler
};

export { requestTimestampMiddleware };
