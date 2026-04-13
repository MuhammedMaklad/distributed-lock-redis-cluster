import {Router} from "express";
import {getUserProfile} from "../controller/user.controller.ts";


const router = Router();

router.get('/fetch-user-profile/:userId', getUserProfile);

export {
  router as userRouter
}