import express from "express"
import type {Request, Response} from "express";
import {userRouter} from "./routes/user.route.ts";
import {errorHandler} from "./middlewares/error.middleware.ts";

const app = express();

app.use(express.json());

app.use("/api/v1/user", userRouter);


app.use((req: Request, res:Response) => {
  return res.status(404).json({
    status:"This URL NOT FOUND",
    timestamp : new Date().toISOString(),
  })
})

app.use(errorHandler);

export default  app;