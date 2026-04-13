import type {ErrorRequestHandler} from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, next)=> {
  console.error(err.stack || err.message);

  res.status(500).json({
    status: "INTERNAL SERVER ERROR",
    timestamp: new Date().toISOString(),
    error:err.message
  });
}

