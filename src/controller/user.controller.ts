
import type {Request, Response} from "express";
import {cacheService} from "../services/cache-service.ts";


// simulate a slow database call
const mockDbFetching = async (id:string ) => {
  console.log(`Fetching user ${id} from Db`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    id,
    name:"Mohammed",
    role:"Senior Engineer"
  }
}

export const getUserProfile =
  async  (req:Request, res:Response)=> {
    const userId = req.params.id as string;

    const cachedKey= `user:${userId}:profile`;

    const user = await cacheService.getOrSet(
      cachedKey,
      300,
      () => mockDbFetching(userId)
    );

    return res.status(200).json({
      data:user
    })
}